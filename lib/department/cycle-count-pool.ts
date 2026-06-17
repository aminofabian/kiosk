import { query } from "@/lib/db";
import { buildItemTypeFilter, startOfLocalDay } from "@/lib/department/count-shift-utils";
import type { PoolSource } from "@/lib/department/cycle-count-constants";

export type { PoolSource } from "@/lib/department/cycle-count-constants";
export { POOL_SOURCE_LABELS } from "@/lib/department/cycle-count-constants";

export const SELLABLE_ITEM_FILTER = ` AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (
  SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1
))`;

export interface PoolCandidate {
  item_id: string;
  current_stock: number;
  score: number;
  source: PoolSource;
}

const SOURCE_SCORE: Record<PoolSource, number> = {
  pinned: 1000,
  today_sales: 0, // uses sale volume
  yesterday_sales: 0,
  low_stock: 40,
  recent_adjustment: 30,
  recent_delivery: 35,
  backfill: 1,
};

function todaySaleRange(now: number): { start: number; end: number } {
  const start = startOfLocalDay(now);
  return { start, end: start + 86400 };
}

function yesterdaySaleRange(now: number): { start: number; end: number } {
  const todayStart = startOfLocalDay(now);
  return { start: todayStart - 86400, end: todayStart };
}

function mergeCandidate(
  map: Map<string, PoolCandidate>,
  row: { item_id: string; current_stock: number },
  source: PoolSource,
  extraScore = 0,
) {
  const existing = map.get(row.item_id);
  const base = SOURCE_SCORE[source] + extraScore;
  if (!existing || base > existing.score) {
    map.set(row.item_id, {
      item_id: row.item_id,
      current_stock: row.current_stock,
      score: Math.max(existing?.score ?? 0, base),
      source,
    });
  } else if (existing) {
    existing.score += Math.floor(extraScore / 2);
  }
}

function weightedSample(
  candidates: PoolCandidate[],
  count: number,
): PoolCandidate[] {
  const pool = [...candidates];
  const picked: PoolCandidate[] = [];

  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, c) => sum + Math.max(c.score, 1), 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      roll -= Math.max(pool[i].score, 1);
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return picked;
}

/**
 * Build a scored item pool for a count shift.
 * Priority: pinned → today's sales → yesterday's sales → low stock →
 * recent adjustments/deliveries → catalogue backfill.
 */
export async function buildCountShiftItemPool({
  businessId,
  departmentKey,
  batchSize,
  now,
  excludeItemIds = [],
}: {
  businessId: string;
  departmentKey: string;
  batchSize: number;
  now: number;
  excludeItemIds?: string[];
}): Promise<PoolCandidate[]> {
  const typeFilter = buildItemTypeFilter([departmentKey], "i");
  const excludeSet = new Set(excludeItemIds);
  const candidateMap = new Map<string, PoolCandidate>();

  const pinnedRows = await query<{ item_id: string; current_stock: number }>(
    `SELECT i.id AS item_id, i.current_stock
     FROM count_item_pool cip
     JOIN items i ON i.id = cip.item_id
     WHERE cip.business_id = ? AND cip.pinned = 1 AND cip.excluded = 0
       AND i.business_id = ? AND i.active = 1
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}`,
    [businessId, businessId, ...typeFilter.params],
  );

  for (const row of pinnedRows) {
    if (!excludeSet.has(row.item_id)) {
      mergeCandidate(candidateMap, row, "pinned");
    }
  }

  const pinned = [...candidateMap.values()].slice(0, batchSize);
  const pinnedIds = new Set(pinned.map((p) => p.item_id));
  const remaining = batchSize - pinned.length;

  if (remaining <= 0) {
    return pinned.slice(0, batchSize);
  }

  const excludedPool = await query<{ item_id: string }>(
    `SELECT item_id FROM count_item_pool WHERE business_id = ? AND excluded = 1`,
    [businessId],
  );
  for (const row of excludedPool) {
    excludeSet.add(row.item_id);
  }
  for (const id of pinnedIds) {
    excludeSet.add(id);
  }

  const poolMap = new Map<string, PoolCandidate>();
  const { start: todayStart, end: todayEnd } = todaySaleRange(now);
  const { start: yesterdayStart, end: yesterdayEnd } = yesterdaySaleRange(now);
  const weekAgo = now - 7 * 86400;

  const todaySold = await query<{
    item_id: string;
    current_stock: number;
    sale_lines: number;
  }>(
    `SELECT si.item_id, i.current_stock, COUNT(si.id) AS sale_lines
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     JOIN items i ON si.item_id = i.id
     WHERE s.business_id = ?
       AND s.status = 'completed'
       AND COALESCE(s.sale_date, s.created_at) >= ?
       AND COALESCE(s.sale_date, s.created_at) < ?
       AND i.business_id = ? AND i.active = 1
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}
     GROUP BY si.item_id
     ORDER BY sale_lines DESC
     LIMIT 80`,
    [businessId, todayStart, todayEnd, businessId, ...typeFilter.params],
  );

  for (const row of todaySold) {
    if (excludeSet.has(row.item_id)) continue;
    mergeCandidate(poolMap, row, "today_sales", row.sale_lines * 12);
  }

  const yesterdaySold = await query<{
    item_id: string;
    current_stock: number;
    sale_lines: number;
  }>(
    `SELECT si.item_id, i.current_stock, COUNT(si.id) AS sale_lines
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     JOIN items i ON si.item_id = i.id
     WHERE s.business_id = ?
       AND s.status = 'completed'
       AND COALESCE(s.sale_date, s.created_at) >= ?
       AND COALESCE(s.sale_date, s.created_at) < ?
       AND i.business_id = ? AND i.active = 1
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}
     GROUP BY si.item_id
     ORDER BY sale_lines DESC
     LIMIT 80`,
    [
      businessId,
      yesterdayStart,
      yesterdayEnd,
      businessId,
      ...typeFilter.params,
    ],
  );

  for (const row of yesterdaySold) {
    if (excludeSet.has(row.item_id)) continue;
    mergeCandidate(poolMap, row, "yesterday_sales", row.sale_lines * 6);
  }

  const lowStock = await query<{ item_id: string; current_stock: number }>(
    `SELECT i.id AS item_id, i.current_stock
     FROM items i
     WHERE i.business_id = ? AND i.active = 1
       AND i.min_stock_level IS NOT NULL
       AND i.current_stock <= i.min_stock_level
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}
     ORDER BY i.current_stock ASC
     LIMIT 40`,
    [businessId, ...typeFilter.params],
  );

  for (const row of lowStock) {
    if (excludeSet.has(row.item_id)) continue;
    mergeCandidate(poolMap, row, "low_stock");
  }

  const outOfStock = await query<{ item_id: string; current_stock: number }>(
    `SELECT i.id AS item_id, i.current_stock
     FROM items i
     WHERE i.business_id = ? AND i.active = 1
       AND i.current_stock <= 0
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}
     LIMIT 20`,
    [businessId, ...typeFilter.params],
  );

  for (const row of outOfStock) {
    if (excludeSet.has(row.item_id)) continue;
    mergeCandidate(poolMap, row, "low_stock", 10);
  }

  const recentAdjustments = await query<{
    item_id: string;
    current_stock: number;
  }>(
    `SELECT DISTINCT i.id AS item_id, i.current_stock
     FROM stock_adjustments sa
     JOIN items i ON i.id = sa.item_id
     WHERE sa.business_id = ?
       AND sa.created_at >= ?
       AND i.active = 1
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}
     LIMIT 30`,
    [businessId, weekAgo, ...typeFilter.params],
  );

  for (const row of recentAdjustments) {
    if (excludeSet.has(row.item_id)) continue;
    mergeCandidate(poolMap, row, "recent_adjustment");
  }

  const recentDeliveries = await query<{
    item_id: string;
    current_stock: number;
  }>(
    `SELECT DISTINCT i.id AS item_id, i.current_stock
     FROM purchase_breakdowns pb
     JOIN items i ON i.id = pb.item_id
     JOIN purchase_items pi ON pi.id = pb.purchase_item_id
     JOIN purchases p ON p.id = pi.purchase_id
     WHERE p.business_id = ?
       AND pb.confirmed_at >= ?
       AND (p.department = ? OR p.department IS NULL)
       AND i.active = 1
       ${SELLABLE_ITEM_FILTER}
       ${typeFilter.sql}
     LIMIT 30`,
    [businessId, weekAgo, departmentKey, ...typeFilter.params],
  );

  for (const row of recentDeliveries) {
    if (excludeSet.has(row.item_id)) continue;
    mergeCandidate(poolMap, row, "recent_delivery");
  }

  let sampled = weightedSample([...poolMap.values()], remaining);

  if (pinned.length + sampled.length < batchSize) {
    const need = batchSize - pinned.length - sampled.length;
    const taken = new Set([
      ...pinnedIds,
      ...sampled.map((s) => s.item_id),
    ]);
    const fallback = await query<{ item_id: string; current_stock: number }>(
      `SELECT i.id AS item_id, i.current_stock
       FROM items i
       WHERE i.business_id = ? AND i.active = 1
         ${SELLABLE_ITEM_FILTER}
         ${typeFilter.sql}
       ORDER BY RANDOM()
       LIMIT ?`,
      [businessId, ...typeFilter.params, need * 4],
    );
    const extra = fallback
      .filter((r) => !taken.has(r.item_id) && !excludeSet.has(r.item_id))
      .slice(0, need)
      .map((r) => ({
        item_id: r.item_id,
        current_stock: r.current_stock,
        score: SOURCE_SCORE.backfill,
        source: "backfill" as const,
      }));
    sampled = [...sampled, ...extra];
  }

  return [...pinned, ...sampled].slice(0, batchSize);
}
