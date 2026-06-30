import { query } from '@/lib/db';
import { computeTopup } from '@/lib/utils/inventory-topup';
import { getStockLevelStatus } from '@/lib/inventory/stock-level-status';
import { ONE_WEEK_SECONDS } from '@/lib/utils/format-relative-time';

export interface StockReorderListRow {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  parent_name: string | null;
  parent_item_id: string | null;
  item_type: string;
  unit_type: string;
  barcode: string | null;
  current_stock: number;
  min_stock_level: number | null;
  expected_stock_level: number | null;
  quantity_sold_7d: number;
  stock_status: 'out' | 'low';
  suggested_order_qty: number;
}

const SELLABLE_WHERE = `(
  i.parent_item_id IS NOT NULL
  OR NOT EXISTS (
    SELECT 1 FROM items v
    WHERE v.parent_item_id = i.id AND v.business_id = i.business_id AND v.active = 1
  )
)`;

const LOW_OR_OUT_WHERE = `(
  i.current_stock <= 0
  OR (i.min_stock_level IS NOT NULL AND i.current_stock <= i.min_stock_level)
  OR (i.min_stock_level IS NULL AND i.current_stock < 10)
)`;

export async function fetchStockReorderListRows(opts: {
  businessId: string;
  itemTypes?: string[];
  soldSinceUnix: number;
}): Promise<StockReorderListRow[]> {
  const { businessId, itemTypes, soldSinceUnix } = opts;

  const typeFilter =
    itemTypes && itemTypes.length > 0
      ? ` AND i.item_type IN (${itemTypes.map(() => '?').join(',')})`
      : '';
  const typeParams = itemTypes && itemTypes.length > 0 ? itemTypes : [];

  const rows = await query<{
    item_id: string;
    item_name: string;
    variant_name: string | null;
    parent_name: string | null;
    parent_item_id: string | null;
    item_type: string;
    unit_type: string;
    barcode: string | null;
    current_stock: number;
    min_stock_level: number | null;
    expected_stock_level: number | null;
    quantity_sold_7d: number;
  }>(
    `SELECT
      i.id AS item_id,
      i.name AS item_name,
      i.variant_name,
      p.name AS parent_name,
      i.parent_item_id,
      i.item_type,
      i.unit_type,
      i.barcode,
      i.current_stock,
      i.min_stock_level,
      i.expected_stock_level,
      COALESCE(sales.quantity_sold_7d, 0) AS quantity_sold_7d
    FROM items i
    LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
    INNER JOIN (
      SELECT si.item_id, SUM(si.quantity_sold) AS quantity_sold_7d
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.business_id = ?
        AND s.status = 'completed'
        AND s.sale_date >= ?
      GROUP BY si.item_id
      HAVING quantity_sold_7d > 0
    ) sales ON sales.item_id = i.id
    WHERE i.business_id = ?
      AND i.active = 1
      AND ${SELLABLE_WHERE}
      AND ${LOW_OR_OUT_WHERE}
      ${typeFilter}
    ORDER BY i.name ASC, i.variant_name ASC`,
    [businessId, soldSinceUnix, businessId, ...typeParams],
  );

  return rows.map((row) => {
    const stock_status = getStockLevelStatus(row);
    const suggested_order_qty = computeTopup(
      row.current_stock,
      row.min_stock_level,
      row.expected_stock_level,
    );

    return {
      ...row,
      stock_status: stock_status === 'out' ? 'out' : 'low',
      suggested_order_qty,
    };
  });
}

export function defaultSoldSinceUnix(nowSec = Math.floor(Date.now() / 1000)): number {
  return nowSec - ONE_WEEK_SECONDS;
}
