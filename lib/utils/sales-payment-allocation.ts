/** Share of line-item revenue allocated to a payment method (0–1 per sale line). */
export function salePaymentShareSql(method: 'cash' | 'mpesa' | 'credit' | 'wallet'): string {
  const splitAmount = (pm: string) =>
    `COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = '${pm}'), 0) / NULLIF(s.total_amount, 0)`;

  const allPayments =
    `COALESCE((SELECT SUM(sp.amount) FROM sale_payments sp WHERE sp.sale_id = s.id), 0) / NULLIF(s.total_amount, 0)`;

  switch (method) {
    case 'cash':
      return `CASE
        WHEN s.payment_method = 'cash' THEN 1.0 - ${allPayments}
        WHEN s.payment_method = 'split' THEN ${splitAmount('cash')}
        ELSE 0
      END`;
    case 'mpesa':
      return `CASE
        WHEN s.payment_method = 'mpesa' THEN 1.0
        WHEN s.payment_method = 'split' THEN ${splitAmount('mpesa')}
        ELSE 0
      END`;
    case 'credit':
      return `CASE
        WHEN s.payment_method = 'credit' THEN 1.0
        WHEN s.payment_method = 'split' THEN ${splitAmount('credit')}
        ELSE 0
      END`;
    case 'wallet':
      return splitAmount('wallet');
  }
}

export function salesByPaymentMethodQuery(
  dateFilter: string,
  itemType?: string | null
): string {
  const itemTypeFilter = itemType ? ` AND COALESCE(si.item_type_snapshot, 'retail') = ?` : '';
  const methods = ['cash', 'mpesa', 'credit', 'wallet'] as const;

  const unions = methods
    .map(
      (method) => `
    SELECT
      s.id AS sale_id,
      '${method}' AS payment_method,
      si.quantity_sold * si.sell_price_per_unit * (${salePaymentShareSql(method)}) AS line_revenue
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}${itemTypeFilter}`
    )
    .join(' UNION ALL ');

  return `
    SELECT
      payment_method,
      COUNT(DISTINCT sale_id) AS count,
      COALESCE(SUM(line_revenue), 0) AS total
    FROM (${unions}) payment_lines
    WHERE line_revenue > 0
    GROUP BY payment_method
    ORDER BY total DESC`;
}
