import { NextRequest } from "next/server";
import { queryOne, query } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { startOfLocalDay } from "@/lib/department/count-shift-utils";
import type { CountShift, CountBatch, Item } from "@/lib/db/types";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/count-shifts/current
 * Returns the active count shift, or today's closed shift if the day is done.
 */
export async function GET(_request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const now = Math.floor(Date.now() / 1000);
    const todayStart = startOfLocalDay(now);
    const tomorrowStart = todayStart + 86400;

    let shift = await queryOne<CountShift>(
      `SELECT * FROM count_shifts
       WHERE business_id = ? AND user_id = ? AND status IN ('open', 'counting', 'morning_complete')
       ORDER BY opened_at DESC LIMIT 1`,
      [auth.businessId, auth.userId],
    );

    if (!shift) {
      shift = await queryOne<CountShift>(
        `SELECT * FROM count_shifts
         WHERE business_id = ? AND user_id = ?
           AND status = 'closed'
           AND opened_at >= ? AND opened_at < ?
         ORDER BY closed_at DESC LIMIT 1`,
        [auth.businessId, auth.userId, todayStart, tomorrowStart],
      );
    }

    if (!shift) {
      return jsonResponse({ success: true, data: null });
    }

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

    const matchedCount = batches.filter((b) => b.status === "matched").length;
    const escalatedCount = batches.filter((b) => b.status === "escalated").length;
    const resolvedEscalationCount = batches.filter((b) =>
      ["acknowledged", "dismissed", "adjusted"].includes(b.status),
    ).length;

    return jsonResponse({
      success: true,
      data: {
        shift,
        batches,
        matchedCount,
        escalatedCount,
        resolvedEscalationCount,
      },
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
