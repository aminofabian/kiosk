import { NextRequest } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { allMorningComplete } from "@/lib/department/count-shift-utils";

/**
 * POST /api/count-shifts/[id]/start-evening
 * Snapshots current system stock for evening (closing) count after opening count is done.
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;

    const shift = await queryOne<{
      id: string;
      status: string;
      user_id: string;
    }>(
      "SELECT id, status, user_id FROM count_shifts WHERE id = ? AND business_id = ?",
      [shiftId, auth.businessId],
    );

    if (!shift) {
      return jsonResponse(
        { success: false, message: "Count shift not found" },
        404,
      );
    }

    if (shift.status === "closed") {
      return jsonResponse(
        { success: false, message: "Shift is already closed" },
        400,
      );
    }

    if (
      shift.user_id !== auth.userId &&
      !["admin", "owner"].includes(auth.role)
    ) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const batches = await query<{
      id: string;
      morning_count_status: string;
      system_stock_evening: number | null;
      current_stock: number;
    }>(
      `SELECT cb.id, cb.morning_count_status, cb.system_stock_evening,
              i.current_stock
       FROM count_batches cb
       JOIN items i ON cb.item_id = i.id
       WHERE cb.count_shift_id = ?`,
      [shiftId],
    );

    if (!allMorningComplete(batches)) {
      return jsonResponse(
        {
          success: false,
          message: "Complete all opening counts before starting closing count",
        },
        400,
      );
    }

    if (batches.some((b) => b.system_stock_evening !== null)) {
      return jsonResponse({
        success: true,
        message: "Closing count already initialized",
      });
    }

    for (const batch of batches) {
      await execute(
        `UPDATE count_batches SET system_stock_evening = ? WHERE id = ?`,
        [batch.current_stock ?? 0, batch.id],
      );
    }

    return jsonResponse({
      success: true,
      message: "Closing count initialized",
      data: { itemCount: batches.length },
    });
  } catch (error) {
    console.error("Error starting evening count:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to start closing count",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
