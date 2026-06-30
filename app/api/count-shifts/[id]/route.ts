import { NextRequest } from "next/server";
import { queryOne, query } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import type { CountShift, CountBatch, Item } from "@/lib/db/types";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/count-shifts/[id]
 * Returns a single count shift with all batches and item details.
 * Admin/owner can view any shift; department_stock_manager can view their own.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;

    const shift = await queryOne<CountShift & { user_name: string }>(
      `SELECT cs.*, u.name as user_name
       FROM count_shifts cs
       LEFT JOIN users u ON cs.user_id = u.id
       WHERE cs.id = ? AND cs.business_id = ?`,
      [shiftId, auth.businessId],
    );

    if (!shift) {
      return jsonResponse(
        { success: false, message: "Count shift not found" },
        404,
      );
    }

    // Department stock manager can only view their own shifts
    if (
      auth.role === "department_stock_manager" &&
      shift.user_id !== auth.userId
    ) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const batches = await query<
      CountBatch & {
        item_name: string;
        barcode: string | null;
        unit_type: string;
        current_stock: number;
        sell_price: number;
      }
    >(
       `SELECT cb.*,
              i.name as item_name,
              i.barcode,
              i.unit_type,
              i.current_stock,
              i.current_sell_price as sell_price
       FROM count_batches cb
       JOIN items i ON cb.item_id = i.id
       WHERE cb.count_shift_id = ?
       ORDER BY cb.created_at ASC`,
      [shiftId],
    );

    return jsonResponse({
      success: true,
      data: { shift, batches },
    });
  } catch (error) {
    console.error("Error fetching count shift:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch count shift",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
