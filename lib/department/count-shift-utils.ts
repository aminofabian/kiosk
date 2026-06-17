import { query, queryOne } from "@/lib/db";
import { getCountTolerance } from "@/lib/utils/count-settings";

export { parseDepartmentKeys } from "@/lib/department/purchase-order-access";

export interface CountTolerance {
  tolerancePercent: number;
  toleranceAbsolute: number;
  lowStockFloor: number;
}

export interface CountBatchRow {
  morning_count: number | null;
  morning_count_status: string;
  evening_count: number | null;
  evening_count_status: string;
  system_stock_morning: number;
}

export function resolveCountDepartmentKey(
  departmentKeys: string[],
  requestedKey?: string | null,
): string | null {
  if (departmentKeys.length === 0) return null;
  if (
    requestedKey &&
    departmentKeys.includes(requestedKey)
  ) {
    return requestedKey;
  }
  if (departmentKeys.length === 1) return departmentKeys[0];
  return null;
}

export function allMorningComplete(batches: CountBatchRow[]): boolean {
  return (
    batches.length > 0 &&
    batches.every((b) => b.morning_count_status !== "pending")
  );
}

export function allEveningComplete(batches: CountBatchRow[]): boolean {
  return (
    batches.length > 0 &&
    batches.every((b) => b.evening_count_status !== "pending")
  );
}

export function getToleranceFromSettings(
  settingsJson: string | null | undefined,
): CountTolerance {
  return getCountTolerance(settingsJson);
}

/** Escalate if absolute, percent, or low-stock floor threshold is exceeded. */
export function exceedsTolerance(
  variance: number,
  referenceStock: number,
  tolerance: CountTolerance,
): boolean {
  const abs = Math.abs(variance);
  if (referenceStock <= tolerance.lowStockFloor && abs >= 1) return true;
  if (abs >= tolerance.toleranceAbsolute) return true;
  if (abs / Math.max(referenceStock, 1) * 100 >= tolerance.tolerancePercent) {
    return true;
  }
  return false;
}

export function startOfLocalDay(epochSec: number): number {
  return epochSec - (epochSec % 86400);
}

export function yesterdaySaleRange(now: number): {
  start: number;
  end: number;
} {
  const todayStart = startOfLocalDay(now);
  return { start: todayStart - 86400, end: todayStart };
}

export async function getItemMovementDuringShift(
  businessId: string,
  itemId: string,
  fromTs: number,
  toTs: number,
): Promise<{ soldQty: number; adjustmentNet: number }> {
  const soldRow = await queryOne<{ sold_qty: number }>(
    `SELECT COALESCE(SUM(si.quantity_sold), 0) AS sold_qty
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.business_id = ?
       AND si.item_id = ?
       AND s.status = 'completed'
       AND COALESCE(s.sale_date, s.created_at) >= ?
       AND COALESCE(s.sale_date, s.created_at) < ?`,
    [businessId, itemId, fromTs, toTs],
  );

  const adjRow = await queryOne<{ adjustment_net: number }>(
    `SELECT COALESCE(SUM(difference), 0) AS adjustment_net
     FROM stock_adjustments
     WHERE business_id = ? AND item_id = ?
       AND created_at >= ? AND created_at < ?`,
    [businessId, itemId, fromTs, toTs],
  );

  return {
    soldQty: soldRow?.sold_qty ?? 0,
    adjustmentNet: adjRow?.adjustment_net ?? 0,
  };
}

export function buildItemTypeFilter(
  departmentKeys: string[],
  columnAlias = "i",
): { sql: string; params: string[] } {
  if (departmentKeys.length === 0) {
    return { sql: "", params: [] };
  }
  const col = `${columnAlias}.item_type`;
  return {
    sql: ` AND ${col} IN (${departmentKeys.map(() => "?").join(",")})`,
    params: departmentKeys,
  };
}
