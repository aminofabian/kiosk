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
 * GET /api/count-shifts/current
 * Returns the current open count shift with all batches and item details.
 */
export async function GET(_request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const shift = await queryOne<CountShift>(
      `SELECT * FROM count_shifts
       WHERE business_id = ? AND user_id = ? AND status IN ('open', 'counting', 'morning_complete')
       ORDER BY opened_at DESC LIMIT 1`,
      [auth.businessId, auth.userId],
    );

    if (!shift) {
      return jsonResponse({ success: true, data: null });
    }

    // Get batches with item details
    const batches = await query<
      CountBatch &
        Item & {
          item_name: string;
          barcode: string | null;
          unit_type: string;
          sell_price: number;
        }
    >(
      `SELECT cb.*,
              i.name as item_name,
              i.barcode,
              i.unit_type,
              i.current_sell_price as sell_price
       FROM count_batches cb
       JOIN items i ON cb.item_id = i.id
       WHERE cb.count_shift_id = ?
       ORDER BY cb.created_at ASC`,
      [shift.id],
    );

    return jsonResponse({
      success: true,
      data: { shift, batches },
    });
  } catch (error) {
    console.error("Error fetching current count shift:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch current count shift",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
