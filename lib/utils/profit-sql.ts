/**
 * Reusable SQL fragments for profit/COGS calculations.
 *
 * All helpers assume the surrounding query has joined:
 *   sale_items AS si ON some sales table AS s
 *
 * Placeholder rules for resolvedBuyPriceSql / saleLineCostSql / saleLineProfitSql:
 * - Each call injects 2 positional placeholders for business_id, because the raw
 *   buy price is evaluated twice inside the CASE expression.
 * Example:
 *   `SELECT SUM(${saleLineProfitSql()}) FROM sale_items si JOIN sales s ... WHERE s.business_id = ?`
 *   params: [businessId, businessId, ...other params...]
 */

import { saleLineAllocatedRevenueSql } from './sales-payment-allocation';

/** Raw buy price fallback chain without outlier cap. Injects 1 placeholder (business_id). */
function rawBuyPriceSql(alias: string = 'si'): string {
  return `
    COALESCE(
      NULLIF(${alias}.buy_price_per_unit, 0),
      (SELECT ib.buy_price_per_unit
       FROM inventory_batches ib
       WHERE ib.item_id = ${alias}.item_id AND ib.received_at <= s.sale_date
       ORDER BY ib.received_at DESC
       LIMIT 1),
      (SELECT pb.buy_price_per_unit
       FROM purchase_breakdowns pb
       JOIN purchase_items pi ON pb.purchase_item_id = pi.id
       JOIN purchases p ON pi.purchase_id = p.id
       WHERE pb.item_id = ${alias}.item_id AND p.business_id = ? AND pb.confirmed_at <= s.sale_date
       ORDER BY pb.confirmed_at DESC
       LIMIT 1),
      ${alias}.sell_price_per_unit * 0.85
    )
  `;
}

/**
 * Resolved buy price per sale item, with outlier cap.
 * If the resolved buy price exceeds the sell price (bad data), fall back to
 * 85% of sell price so profit stays sane.
 * Injects 2 placeholders (business_id twice).
 */
export function resolvedBuyPriceSql(alias: string = 'si'): string {
  const raw = rawBuyPriceSql(alias);
  return `
    CASE
      WHEN ${raw} > ${alias}.sell_price_per_unit
        THEN ${alias}.sell_price_per_unit * 0.85
      ELSE ${raw}
    END
  `;
}

/** 1 if the resolved buy price was capped because it exceeded sell price. Injects 2 placeholders. */
export function isCappedBuyPriceSql(alias: string = 'si'): string {
  const raw = rawBuyPriceSql(alias);
  return `CASE WHEN ${raw} > ${alias}.sell_price_per_unit THEN 1 ELSE 0 END`;
}

/** 1 if the stored buy price is exactly zero (no known cost). */
export function isZeroCostSql(alias: string = 'si'): string {
  return `CASE WHEN ${alias}.buy_price_per_unit = 0 THEN 1 ELSE 0 END`;
}

/** Cost of a sale line: quantity * resolved buy price. Injects 2 placeholders. */
export function saleLineCostSql(alias: string = 'si'): string {
  return `${alias}.quantity_sold * ${resolvedBuyPriceSql(alias)}`;
}

/** Gross revenue of a sale line (before payment-method allocation). */
export function saleLineRevenueSql(alias: string = 'si'): string {
  return `${alias}.quantity_sold * ${alias}.sell_price_per_unit`;
}

/**
 * Line revenue scaled to match the sale's total_amount (handles discounts, fees,
 * rounding, etc.). Re-exports the helper from sales-payment-allocation for
 * discoverability.
 */
export { saleLineAllocatedRevenueSql };

/** Profit of a sale line using the resolved/capped buy price. Injects 2 placeholders. */
export function saleLineProfitSql(alias: string = 'si'): string {
  return `${alias}.quantity_sold * (${alias}.sell_price_per_unit - ${resolvedBuyPriceSql(alias)})`;
}

/**
 * Number of business_id placeholders each profit/cost/revenue helper injects.
 * Useful when building parameter arrays manually.
 */
export const RESOLVED_BUY_PRICE_PARAM_COUNT = 2;
