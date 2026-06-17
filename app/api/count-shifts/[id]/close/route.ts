import { NextRequest } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import {
  allEveningComplete,
  allMorningComplete,
  exceedsTolerance,
  getItemMovementDuringShift,
  getToleranceFromSettings,
} from "@/lib/department/count-shift-utils";
import type { Business } from "@/lib/db/types";

/**
 * POST /api/count-shifts/[id]/close
 * Closes a count shift, snapshots evening system stock, and runs variance analysis.
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

    const { id: shiftId } = await params;

    const body = await request.json().catch(() => ({}));
    const businessSettings = await queryOne<Business>(
      "SELECT settings FROM businesses WHERE id = ?",
      [auth.businessId],
    );
    const tolerance = getToleranceFromSettings(businessSettings?.settings);
    if (typeof body.tolerancePercent === "number") {
      tolerance.tolerancePercent = body.tolerancePercent;
    }
    if (typeof body.toleranceAbsolute === "number") {
      tolerance.toleranceAbsolute = body.toleranceAbsolute;
    }

    const shift = await queryOne<{
      id: string;
      status: string;
      user_id: string;
      department: string;
      opened_at: number;
    }>(
      "SELECT id, status, user_id, department, opened_at FROM count_shifts WHERE id = ? AND business_id = ?",
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
      item_id: string;
      morning_count: number | null;
      morning_count_status: string;
      evening_count: number | null;
      evening_count_status: string;
      system_stock_morning: number;
      current_stock: number;
    }>(
      `SELECT cb.*, i.current_stock
       FROM count_batches cb
       JOIN items i ON cb.item_id = i.id
       WHERE cb.count_shift_id = ?`,
      [shiftId],
    );

    if (!allMorningComplete(batches)) {
      return jsonResponse(
        { success: false, message: "All morning counts must be completed first" },
        400,
      );
    }

    if (!allEveningComplete(batches)) {
      return jsonResponse(
        { success: false, message: "All evening counts must be completed first" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let escalatedCount = 0;
    let matchedCount = 0;

    for (const batch of batches) {
      const eveningStock = batch.current_stock ?? 0;
      const morningSkipped = batch.morning_count_status === "not_located";
      const eveningSkipped = batch.evening_count_status === "not_located";

      let varianceMorning: number | null = null;
      let varianceEvening: number | null = null;
      let varianceIntraday: number | null = null;
      let batchStatus: "matched" | "escalated" = "matched";
      const escalationReasons: string[] = [];

      if (morningSkipped || eveningSkipped) {
        batchStatus = "escalated";
        if (morningSkipped) escalationReasons.push("Morning: item not located");
        if (eveningSkipped) escalationReasons.push("Evening: item not located");
      }

      if (!morningSkipped && batch.morning_count !== null) {
        varianceMorning = batch.morning_count - batch.system_stock_morning;
        if (
          exceedsTolerance(
            varianceMorning,
            batch.system_stock_morning,
            tolerance,
          )
        ) {
          batchStatus = "escalated";
          escalationReasons.push(
            `Morning: counted ${batch.morning_count} vs system ${batch.system_stock_morning} (diff ${varianceMorning > 0 ? "+" : ""}${varianceMorning})`,
          );
        }
      }

      if (!eveningSkipped && batch.evening_count !== null) {
        varianceEvening = batch.evening_count - eveningStock;
        if (
          exceedsTolerance(varianceEvening, eveningStock, tolerance)
        ) {
          batchStatus = "escalated";
          escalationReasons.push(
            `Evening: counted ${batch.evening_count} vs system ${eveningStock} (diff ${varianceEvening > 0 ? "+" : ""}${varianceEvening})`,
          );
        }
      }

      if (
        !morningSkipped &&
        !eveningSkipped &&
        batch.morning_count !== null &&
        batch.evening_count !== null
      ) {
        const movement = await getItemMovementDuringShift(
          auth.businessId,
          batch.item_id,
          shift.opened_at,
          now,
        );
        const expectedEveningPhysical =
          batch.morning_count - movement.soldQty + movement.adjustmentNet;
        varianceIntraday = batch.evening_count - expectedEveningPhysical;

        if (
          exceedsTolerance(
            varianceIntraday,
            Math.max(batch.morning_count, eveningStock, 1),
            tolerance,
          )
        ) {
          batchStatus = "escalated";
          escalationReasons.push(
            `Intraday: expected ${expectedEveningPhysical.toFixed(2)} after sales (${movement.soldQty}) and adjustments (${movement.adjustmentNet > 0 ? "+" : ""}${movement.adjustmentNet}), counted ${batch.evening_count} (diff ${varianceIntraday > 0 ? "+" : ""}${varianceIntraday.toFixed(2)})`,
          );
        }
      }

      if (batchStatus === "escalated") {
        escalatedCount++;
      } else {
        matchedCount++;
      }

      await execute(
        `UPDATE count_batches
         SET system_stock_evening = ?,
             variance_morning = ?,
             variance_evening = ?,
             variance_intraday = ?,
             status = ?,
             escalation_notes = ?
         WHERE id = ?`,
        [
          eveningStock,
          varianceMorning,
          varianceEvening,
          varianceIntraday,
          batchStatus,
          escalationReasons.length > 0 ? escalationReasons.join("; ") : null,
          batch.id,
        ],
      );
    }

    await execute(
      `UPDATE count_shifts SET status = 'closed', closed_at = ? WHERE id = ?`,
      [now, shiftId],
    );

    logActivity({
      businessId: auth.businessId,
      action: "close",
      entityType: "count_shift",
      entityId: shiftId,
      entityNameSnapshot: `Count shift closed — ${shift.department}`,
      details: {
        department: shift.department,
        totalItems: batches.length,
        matchedCount,
        escalatedCount,
        tolerancePercent: tolerance.tolerancePercent,
        toleranceAbsolute: tolerance.toleranceAbsolute,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: `Count shift closed — ${matchedCount} matched, ${escalatedCount} escalated`,
      data: {
        shiftId,
        matchedCount,
        escalatedCount,
        totalItems: batches.length,
      },
    });
  } catch (error) {
    console.error("Error closing count shift:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to close count shift",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
