import { NextRequest } from "next/server";
import { execute, queryOne, transaction } from "@/lib/db";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { enforceDepartmentStaffStockEditPolicy } from "@/lib/auth/department-stock-policy";
import { logActivity } from "@/lib/db/activity-log";
import { applyStockAdjustmentToBatches } from "@/lib/db/batch-stock-sync";

/** Must match CHECK on stock_adjustments.reason */
const STOCK_ADJUSTMENT_REASONS = [
  "restock",
  "spoilage",
  "theft",
  "counting_error",
  "damage",
  "other",
] as const;

function normalizeAdjustmentReason(
  reason: unknown,
  notes: string | null | undefined,
): { reason: string; notes: string | null } {
  const r = typeof reason === "string" ? reason.trim() : "";
  if (
    STOCK_ADJUSTMENT_REASONS.includes(
      r as (typeof STOCK_ADJUSTMENT_REASONS)[number],
    )
  ) {
    return { reason: r, notes: notes?.trim() || null };
  }
  const extra = r ? `Original reason: ${r}` : null;
  const merged = [notes?.trim(), extra].filter(Boolean).join(" | ") || null;
  return { reason: "other", notes: merged };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("adjust_stock");
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const {
      itemId,
      adjustmentType,
      quantity,
      reason: rawReason,
      notes: rawNotes,
    } = body;
    const { reason, notes } = normalizeAdjustmentReason(rawReason, rawNotes);

    const stockPolicyBlock = await enforceDepartmentStaffStockEditPolicy(auth, {
      adjustmentType,
      reason,
    });
    if (stockPolicyBlock) return stockPolicyBlock;

    if (!itemId || !adjustmentType || !quantity || !rawReason) {
      return jsonResponse(
        { success: false, message: "Missing required fields" },
        400,
      );
    }

    if (quantity <= 0) {
      return jsonResponse(
        { success: false, message: "Quantity must be greater than 0" },
        400,
      );
    }

    // Verify item exists
    const item = await queryOne<{
      id: string;
      current_stock: number;
      name: string;
    }>(
      "SELECT id, current_stock, name FROM items WHERE id = ? AND business_id = ?",
      [itemId, auth.businessId],
    );

    if (!item) {
      return jsonResponse({ success: false, message: "Item not found" }, 404);
    }

    const now = Math.floor(Date.now() / 1000);

    // If user is cashier, create a pending approval request instead
    if (auth.role === "cashier") {
      const requestId = generateUUID();

      await execute(
        `INSERT INTO stock_approval_requests (
          id, business_id, item_id, adjustment_type, quantity,
          reason, notes, requested_by, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          requestId,
          auth.businessId,
          itemId,
          adjustmentType,
          quantity,
          reason,
          notes || null,
          auth.userId,
          now,
        ],
      );

      return jsonResponse({
        success: true,
        message:
          "Stock adjustment request submitted. Waiting for admin approval.",
        data: {
          requestId,
          status: "pending",
          requiresApproval: true,
        },
      });
    }

    const adjustmentId = generateUUID();
    const systemStock = item.current_stock;
    const stockChange = adjustmentType === "increase" ? quantity : -quantity;
    const actualStock = Math.max(0, systemStock + stockChange);
    const difference = actualStock - systemStock;

    const stockConflict = await transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO stock_adjustments (
          id, business_id, item_id, system_stock, actual_stock,
          difference, reason, notes, adjusted_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adjustmentId,
          auth.businessId,
          itemId,
          systemStock,
          actualStock,
          difference,
          reason,
          notes || null,
          auth.userId,
          now,
        ],
      );

      const stockUpdate = await tx.execute(
        `UPDATE items
         SET current_stock = ?
         WHERE id = ? AND business_id = ? AND ABS(current_stock - ?) < 0.0001`,
        [actualStock, itemId, auth.businessId, systemStock],
      );

      if (stockUpdate.rowsAffected === 0) {
        return true;
      }

      await applyStockAdjustmentToBatches(
        tx,
        itemId,
        auth.businessId,
        difference,
        now,
      );

      return false;
    });

    if (stockConflict) {
      return jsonResponse(
        {
          success: false,
          message:
            "Stock changed since you loaded this item. Please refresh and try again.",
          code: "stock_conflict",
        },
        409,
      );
    }

    // Use specific entity type for better audit filtering
    const entityType =
      reason === "damage"
        ? "damage"
        : reason === "theft"
          ? "theft"
          : reason === "spoilage"
            ? "expired_writeoff"
            : reason === "counting_error"
              ? "stock"
              : "stock";

    // Check notes for internal_consumption or supplier_return context
    const finalEntityType =
      reason === "other" && typeof rawNotes === "string"
        ? rawNotes.includes("internal_consumption")
          ? "internal_consumption"
          : rawNotes.includes("supplier_return")
            ? "supplier_return"
            : entityType
        : entityType;

    logActivity({
      businessId: auth.businessId,
      action: "update",
      entityType: finalEntityType,
      entityId: itemId,
      entityNameSnapshot: item.name,
      details: {
        quantity,
        adjustmentType,
        reason,
        systemStock,
        actualStock,
        difference,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        adjustmentId,
        systemStock,
        actualStock,
        difference,
        requiresApproval: false,
      },
    });
  } catch (error) {
    console.error("Error adjusting stock:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to adjust stock",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
