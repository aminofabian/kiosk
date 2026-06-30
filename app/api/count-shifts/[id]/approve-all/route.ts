import { NextRequest } from "next/server";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { approveAllEscalatedBatches } from "@/lib/department/count-batch-resolution";

/**
 * POST /api/count-shifts/[id]/approve-all
 * Approve stock adjustments for all escalated batches in a closed shift.
 * Body: { notes?: string }
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

    const auth = await requirePermission("adjust_stock");
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { id: shiftId } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body as { notes?: string };

    const result = await approveAllEscalatedBatches({
      shiftId,
      businessId: auth.businessId,
      userId: auth.userId,
      notes,
    });

    if (!result.success) {
      return jsonResponse(
        { success: false, message: result.message },
        result.status,
      );
    }

    const { approvedCount, dismissedCount, skippedCount, failed } = result;
    const parts: string[] = [];
    if (approvedCount > 0) parts.push(`${approvedCount} adjusted`);
    if (dismissedCount > 0) parts.push(`${dismissedCount} dismissed (already matched)`);
    if (skippedCount > 0) parts.push(`${skippedCount} skipped`);

    return jsonResponse({
      success: true,
      message:
        parts.length > 0
          ? `Bulk approve complete — ${parts.join(", ")}`
          : "No escalated batches to approve",
      data: { approvedCount, dismissedCount, skippedCount, failed },
    });
  } catch (error) {
    console.error("Error bulk approving count escalations:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to approve all adjustments",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
