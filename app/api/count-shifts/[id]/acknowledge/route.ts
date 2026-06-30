import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import { dismissEscalatedBatch } from "@/lib/department/count-batch-resolution";

/**
 * POST /api/count-shifts/[id]/acknowledge
 * Dismiss escalated batches in a count shift (legacy bulk endpoint).
 * Body: { batchIds?: string[], notes?: string }
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { id: shiftId } = await params;
    const body = await request.json().catch(() => ({}));
    const { batchIds, notes } = body as {
      batchIds?: string[];
      notes?: string;
    };

    const shift = await queryOne<{ id: string; status: string }>(
      "SELECT id, status FROM count_shifts WHERE id = ? AND business_id = ?",
      [shiftId, auth.businessId],
    );

    if (!shift) {
      return jsonResponse(
        { success: false, message: "Count shift not found" },
        404,
      );
    }

    if (shift.status !== "closed") {
      return jsonResponse(
        {
          success: false,
          message: "Shift must be closed before resolving escalations",
        },
        400,
      );
    }

    let targetBatchIds = batchIds;
    if (!targetBatchIds || targetBatchIds.length === 0) {
      const rows = await query<{ id: string }>(
        `SELECT id FROM count_batches
         WHERE count_shift_id = ? AND status = 'escalated'`,
        [shiftId],
      );
      targetBatchIds = rows.map((row) => row.id);
    }

    if (targetBatchIds.length === 0) {
      return jsonResponse({
        success: true,
        message: "No escalated batches to dismiss",
      });
    }

    for (const batchId of targetBatchIds) {
      const result = await dismissEscalatedBatch({
        batchId,
        shiftId,
        businessId: auth.businessId,
        userId: auth.userId,
        notes,
      });
      if (!result.success && result.status !== 400) {
        return jsonResponse(
          { success: false, message: result.message },
          result.status,
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    logActivity({
      businessId: auth.businessId,
      action: "update",
      entityType: "count_batch",
      entityId: shiftId,
      entityNameSnapshot: "Escalations dismissed for count shift",
      details: {
        shiftId,
        batchIds: targetBatchIds,
        dismissedAt: now,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: "Escalations dismissed",
    });
  } catch (error) {
    console.error("Error dismissing escalations:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to dismiss escalations",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
