import { execute, query, queryOne, transaction } from "@/lib/db";
import { logActivity } from "@/lib/db/activity-log";
import { applyStockAdjustmentToBatches } from "@/lib/db/batch-stock-sync";
import type { CountBatch } from "@/lib/db/types";
import { generateUUID } from "@/lib/utils/uuid";

export type CountBatchEscalationAction = "dismiss" | "approve_adjustment";

export interface CountBatchWithShift extends CountBatch {
  shift_status: string;
  shift_department: string;
}

export function suggestActualStock(batch: CountBatch): number | null {
  if (
    batch.evening_count_status === "counted" &&
    batch.evening_count !== null
  ) {
    return batch.evening_count;
  }
  if (
    batch.morning_count_status === "counted" &&
    batch.morning_count !== null
  ) {
    return batch.morning_count;
  }
  return null;
}

export function isEscalationResolvable(status: string): boolean {
  return status === "escalated";
}

export function isEscalationResolved(status: string): boolean {
  return (
    status === "acknowledged" ||
    status === "dismissed" ||
    status === "adjusted"
  );
}

async function loadResolvableBatch(
  batchId: string,
  shiftId: string,
  businessId: string,
): Promise<CountBatchWithShift | null> {
  return queryOne<CountBatchWithShift>(
    `SELECT cb.*, cs.status AS shift_status, cs.department AS shift_department
     FROM count_batches cb
     JOIN count_shifts cs ON cb.count_shift_id = cs.id
     WHERE cb.id = ? AND cb.count_shift_id = ? AND cs.business_id = ?`,
    [batchId, shiftId, businessId],
  );
}

async function recordEscalationAction(
  batchId: string,
  businessId: string,
  action: CountBatchEscalationAction,
  reviewedBy: string,
  reviewedAt: number,
  notes: string | null,
  stockAdjustmentId: string | null,
): Promise<void> {
  await execute(
    `INSERT INTO count_batch_escalation_actions (
      id, count_batch_id, business_id, action, reviewed_by, reviewed_at, notes, stock_adjustment_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateUUID(),
      batchId,
      businessId,
      action,
      reviewedBy,
      reviewedAt,
      notes,
      stockAdjustmentId,
    ],
  );
}

export async function dismissEscalatedBatch(input: {
  batchId: string;
  shiftId: string;
  businessId: string;
  userId: string;
  notes?: string | null;
}): Promise<{ success: true } | { success: false; message: string; status: number }> {
  const batch = await loadResolvableBatch(
    input.batchId,
    input.shiftId,
    input.businessId,
  );

  if (!batch) {
    return { success: false, message: "Count batch not found", status: 404 };
  }

  if (batch.shift_status !== "closed") {
    return {
      success: false,
      message: "Shift must be closed before resolving escalations",
      status: 400,
    };
  }

  if (!isEscalationResolvable(batch.status)) {
    return {
      success: false,
      message: "Only escalated batches can be dismissed",
      status: 400,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const notes = input.notes?.trim() || null;

  await execute(
    `UPDATE count_batches SET status = 'dismissed' WHERE id = ?`,
    [input.batchId],
  );

  await recordEscalationAction(
    input.batchId,
    input.businessId,
    "dismiss",
    input.userId,
    now,
    notes,
    null,
  );

  logActivity({
    businessId: input.businessId,
    action: "update",
    entityType: "count_batch",
    entityId: input.batchId,
    entityNameSnapshot: `Count escalation dismissed (${batch.shift_department})`,
    details: { shiftId: input.shiftId, batchId: input.batchId, notes },
    performedBy: input.userId,
  }).catch(() => {});

  return { success: true };
}

export async function approveEscalatedBatch(input: {
  batchId: string;
  shiftId: string;
  businessId: string;
  userId: string;
  actualStock?: number;
  notes?: string | null;
}): Promise<
  | {
      success: true;
      adjustmentId: string;
      systemStock: number;
      actualStock: number;
      difference: number;
    }
  | { success: false; message: string; status: number; code?: string }
> {
  const batch = await loadResolvableBatch(
    input.batchId,
    input.shiftId,
    input.businessId,
  );

  if (!batch) {
    return { success: false, message: "Count batch not found", status: 404 };
  }

  if (batch.shift_status !== "closed") {
    return {
      success: false,
      message: "Shift must be closed before approving adjustments",
      status: 400,
    };
  }

  if (!isEscalationResolvable(batch.status)) {
    return {
      success: false,
      message: "Only escalated batches can be approved",
      status: 400,
    };
  }

  const suggested = suggestActualStock(batch);
  const actualStock =
    typeof input.actualStock === "number" ? input.actualStock : suggested;

  if (actualStock === null || !Number.isFinite(actualStock) || actualStock < 0) {
    return {
      success: false,
      message:
        "actualStock is required when counts are missing (e.g. not located)",
      status: 400,
    };
  }

  const item = await queryOne<{
    id: string;
    current_stock: number;
    name: string;
  }>(
    "SELECT id, current_stock, name FROM items WHERE id = ? AND business_id = ?",
    [batch.item_id, input.businessId],
  );

  if (!item) {
    return { success: false, message: "Item not found", status: 404 };
  }

  const systemStock = item.current_stock;
  const difference = actualStock - systemStock;

  if (Math.abs(difference) < 0.0001) {
    return {
      success: false,
      message:
        "Stock already matches the physical count. Dismiss the escalation instead.",
      status: 400,
      code: "no_adjustment_needed",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const adjustmentId = generateUUID();
  const adminNotes = input.notes?.trim() || null;
  const adjustmentNotes = [
    `Cycle count escalation (shift ${input.shiftId.slice(0, 8)}, batch ${input.batchId.slice(0, 8)})`,
    batch.escalation_notes,
    adminNotes,
  ]
    .filter(Boolean)
    .join(" | ");

  const stockConflict = await transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO stock_adjustments (
        id, business_id, item_id, system_stock, actual_stock,
        difference, reason, notes, adjusted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'counting_error', ?, ?, ?)`,
      [
        adjustmentId,
        input.businessId,
        batch.item_id,
        systemStock,
        actualStock,
        difference,
        adjustmentNotes,
        input.userId,
        now,
      ],
    );

    const stockUpdate = await tx.execute(
      `UPDATE items
       SET current_stock = ?
       WHERE id = ? AND business_id = ? AND ABS(current_stock - ?) < 0.0001`,
      [actualStock, batch.item_id, input.businessId, systemStock],
    );

    if (stockUpdate.rowsAffected === 0) {
      return true;
    }

    await applyStockAdjustmentToBatches(
      tx,
      batch.item_id,
      input.businessId,
      difference,
      now,
    );

    await tx.execute(
      `UPDATE count_batches
       SET status = 'adjusted', stock_adjustment_id = ?
       WHERE id = ?`,
      [adjustmentId, input.batchId],
    );

    await tx.execute(
      `INSERT INTO count_batch_escalation_actions (
        id, count_batch_id, business_id, action, reviewed_by, reviewed_at, notes, stock_adjustment_id
      ) VALUES (?, ?, ?, 'approve_adjustment', ?, ?, ?, ?)`,
      [
        generateUUID(),
        input.batchId,
        input.businessId,
        input.userId,
        now,
        adminNotes,
        adjustmentId,
      ],
    );

    return false;
  });

  if (stockConflict) {
    return {
      success: false,
      message:
        "Stock changed since this escalation was opened. Refresh and try again.",
      status: 409,
      code: "stock_conflict",
    };
  }

  logActivity({
    businessId: input.businessId,
    action: "approve",
    entityType: "stock",
    entityId: batch.item_id,
    entityNameSnapshot: item.name,
    details: {
      shiftId: input.shiftId,
      batchId: input.batchId,
      adjustmentId,
      systemStock,
      actualStock,
      difference,
      reason: "counting_error",
    },
    performedBy: input.userId,
  }).catch(() => {});

  return {
    success: true,
    adjustmentId,
    systemStock,
    actualStock,
    difference,
  };
}

export interface ApproveAllEscalationsResult {
  approvedCount: number;
  dismissedCount: number;
  skippedCount: number;
  failed: Array<{ batchId: string; itemId: string; message: string }>;
}

/** Approve all escalated batches in a closed shift using each batch's physical count. */
export async function approveAllEscalatedBatches(input: {
  shiftId: string;
  businessId: string;
  userId: string;
  notes?: string | null;
}): Promise<
  | ({ success: true } & ApproveAllEscalationsResult)
  | { success: false; message: string; status: number }
> {
  const shift = await queryOne<{ id: string; status: string; department: string }>(
    "SELECT id, status, department FROM count_shifts WHERE id = ? AND business_id = ?",
    [input.shiftId, input.businessId],
  );

  if (!shift) {
    return { success: false, message: "Count shift not found", status: 404 };
  }

  if (shift.status !== "closed") {
    return {
      success: false,
      message: "Shift must be closed before approving adjustments",
      status: 400,
    };
  }

  const batches = await query<CountBatch>(
    `SELECT * FROM count_batches
     WHERE count_shift_id = ? AND status = 'escalated'
     ORDER BY created_at ASC`,
    [input.shiftId],
  );

  if (batches.length === 0) {
    return {
      success: true,
      approvedCount: 0,
      dismissedCount: 0,
      skippedCount: 0,
      failed: [],
    };
  }

  let approvedCount = 0;
  let dismissedCount = 0;
  let skippedCount = 0;
  const failed: ApproveAllEscalationsResult["failed"] = [];
  const bulkNotes = input.notes?.trim() || null;

  for (const batch of batches) {
    const suggested = suggestActualStock(batch);
    if (suggested === null) {
      skippedCount++;
      failed.push({
        batchId: batch.id,
        itemId: batch.item_id,
        message: "No physical count available (e.g. not located)",
      });
      continue;
    }

    const result = await approveEscalatedBatch({
      batchId: batch.id,
      shiftId: input.shiftId,
      businessId: input.businessId,
      userId: input.userId,
      actualStock: suggested,
      notes: bulkNotes,
    });

    if (result.success) {
      approvedCount++;
      continue;
    }

    if (result.code === "no_adjustment_needed") {
      const dismissResult = await dismissEscalatedBatch({
        batchId: batch.id,
        shiftId: input.shiftId,
        businessId: input.businessId,
        userId: input.userId,
        notes: bulkNotes ?? "Auto-dismissed during bulk approve (stock already matched)",
      });
      if (dismissResult.success) {
        dismissedCount++;
      } else {
        skippedCount++;
        failed.push({
          batchId: batch.id,
          itemId: batch.item_id,
          message: dismissResult.message,
        });
      }
      continue;
    }

    skippedCount++;
    failed.push({
      batchId: batch.id,
      itemId: batch.item_id,
      message: result.message,
    });
  }

  logActivity({
    businessId: input.businessId,
    action: "approve",
    entityType: "count_shift",
    entityId: input.shiftId,
    entityNameSnapshot: `Bulk-approved count escalations (${shift.department})`,
    details: {
      shiftId: input.shiftId,
      approvedCount,
      dismissedCount,
      skippedCount,
      failedCount: failed.length,
    },
    performedBy: input.userId,
  }).catch(() => {});

  return {
    success: true,
    approvedCount,
    dismissedCount,
    skippedCount,
    failed,
  };
}
