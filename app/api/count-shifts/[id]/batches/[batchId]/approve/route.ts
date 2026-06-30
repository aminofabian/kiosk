import { NextRequest } from "next/server";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { approveEscalatedBatch } from "@/lib/department/count-batch-resolution";

/**
 * POST /api/count-shifts/[id]/batches/[batchId]/approve
 * Approve a stock adjustment from an escalated count batch.
 * Body: { actualStock?: number, notes?: string }
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

    const auth = await requirePermission("adjust_stock");
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { id: shiftId, batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const { actualStock, notes } = body as {
      actualStock?: number;
      notes?: string;
    };

    const result = await approveEscalatedBatch({
      batchId,
      shiftId,
      businessId: auth.businessId,
      userId: auth.userId,
      actualStock,
      notes,
    });

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          message: result.message,
          code: result.code,
        },
        result.status,
      );
    }

    return jsonResponse({
      success: true,
      message: "Stock adjustment approved and applied",
      data: {
        adjustmentId: result.adjustmentId,
        systemStock: result.systemStock,
        actualStock: result.actualStock,
        difference: result.difference,
      },
    });
  } catch (error) {
    console.error("Error approving count escalation:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to approve stock adjustment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
