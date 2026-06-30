import { NextRequest } from "next/server";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { dismissEscalatedBatch } from "@/lib/department/count-batch-resolution";

/**
 * POST /api/count-shifts/[id]/batches/[batchId]/dismiss
 * Dismiss an escalated count batch without changing stock.
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> },
) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { id: shiftId, batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body as { notes?: string };

    const result = await dismissEscalatedBatch({
      batchId,
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

    return jsonResponse({
      success: true,
      message: "Escalation dismissed",
    });
  } catch (error) {
    console.error("Error dismissing count escalation:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to dismiss escalation",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
