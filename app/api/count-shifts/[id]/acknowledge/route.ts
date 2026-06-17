import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";

/**
 * POST /api/count-shifts/[id]/acknowledge
 * Acknowledge escalated batches in a count shift.
 * Body: { batchIds?: string[] } — if omitted, acknowledges ALL escalated batches in the shift.
 * Only admin/owner can acknowledge.
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { id: shiftId } = await params;
    const body = await request.json().catch(() => ({}));
    const { batchIds } = body as { batchIds?: string[] };

    // Verify shift exists and is closed
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
        { success: false, message: "Shift must be closed before acknowledging" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (batchIds && batchIds.length > 0) {
      // Acknowledge specific batches
      await execute(
        `UPDATE count_batches
         SET status = 'acknowledged'
         WHERE count_shift_id = ? AND status = 'escalated' AND id IN (${batchIds.map(() => "?").join(",")})`,
        [shiftId, ...batchIds],
      );
    } else {
      // Acknowledge all escalated
      await execute(
        `UPDATE count_batches
         SET status = 'acknowledged'
         WHERE count_shift_id = ? AND status = 'escalated'`,
        [shiftId],
      );
    }

    logActivity({
      businessId: auth.businessId,
      action: "update",
      entityType: "count_batch",
      entityId: shiftId,
      entityNameSnapshot: `Escalations acknowledged for count shift`,
      details: { shiftId, batchIds: batchIds ?? "all", acknowledgedAt: now },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: "Escalations acknowledged",
    });
  } catch (error) {
    console.error("Error acknowledging escalations:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to acknowledge escalations",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
