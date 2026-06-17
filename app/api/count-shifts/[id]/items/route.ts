import { NextRequest } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import {
  allMorningComplete,
  allEveningComplete,
} from "@/lib/department/count-shift-utils";

/**
 * PUT /api/count-shifts/[id]/items
 * Submits counts for items in a count shift.
 * Body: { items: Array<{ itemId: string, count: number | null, status: 'counted' | 'not_located' }>, phase: 'morning' | 'evening' }
 */
export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;
    const body = await request.json();
    const { items, phase } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: "Items array is required" },
        400,
      );
    }

    if (!phase || !["morning", "evening"].includes(phase)) {
      return jsonResponse(
        { success: false, message: 'Phase must be "morning" or "evening"' },
        400,
      );
    }

    const shift = await queryOne<{ id: string; status: string; user_id: string }>(
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

    const existingBatches = await query<{
      item_id: string;
      morning_count_status: string;
      evening_count_status: string;
      morning_count: number | null;
      evening_count: number | null;
      system_stock_morning: number;
    }>(
      `SELECT item_id, morning_count_status, evening_count_status,
              morning_count, evening_count, system_stock_morning
       FROM count_batches WHERE count_shift_id = ?`,
      [shiftId],
    );

    if (phase === "evening" && !allMorningComplete(existingBatches)) {
      return jsonResponse(
        {
          success: false,
          message: "Complete all morning counts before evening counts",
        },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const countField = phase === "morning" ? "morning_count" : "evening_count";
    const statusField =
      phase === "morning" ? "morning_count_status" : "evening_count_status";
    const countedAtField =
      phase === "morning" ? "morning_counted_at" : "evening_counted_at";

    for (const item of items) {
      if (!item.itemId) continue;

      const countStatus =
        item.status === "not_located" ? "not_located" : "counted";
      const countValue =
        item.status === "not_located"
          ? null
          : typeof item.count === "number"
            ? item.count
            : null;

      if (countStatus === "counted" && (countValue === null || countValue < 0)) {
        continue;
      }

      await execute(
        `UPDATE count_batches
         SET ${countField} = ?, ${statusField} = ?, ${countedAtField} = ?
         WHERE count_shift_id = ? AND item_id = ?`,
        [countValue, countStatus, now, shiftId, item.itemId],
      );
    }

    const updatedBatches = await query<{
      morning_count_status: string;
      evening_count_status: string;
      morning_count: number | null;
      evening_count: number | null;
      system_stock_morning: number;
    }>(
      `SELECT morning_count_status, evening_count_status,
              morning_count, evening_count, system_stock_morning
       FROM count_batches WHERE count_shift_id = ?`,
      [shiftId],
    );

    let nextStatus = shift.status;
    if (phase === "morning") {
      nextStatus = allMorningComplete(updatedBatches)
        ? "morning_complete"
        : "counting";
    } else if (allEveningComplete(updatedBatches)) {
      nextStatus = "morning_complete";
    }

    if (nextStatus !== shift.status) {
      await execute("UPDATE count_shifts SET status = ? WHERE id = ?", [
        nextStatus,
        shiftId,
      ]);
    }

    return jsonResponse({
      success: true,
      message: `${items.length} items updated for ${phase} count`,
      data: {
        updatedCount: items.length,
        shiftStatus: nextStatus,
        morningComplete: allMorningComplete(updatedBatches),
        eveningComplete: allEveningComplete(updatedBatches),
      },
    });
  } catch (error) {
    console.error("Error submitting counts:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to submit counts",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
