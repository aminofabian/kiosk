const paymentsSumSql =
  `(SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp WHERE sp.sale_id = s.id)`;

const explicitSql = (method: string) =>
  `(SELECT COALESCE(SUM(sp.amount), 0) FROM sale_payments sp WHERE sp.sale_id = s.id AND sp.payment_method = '${method}')`;

/** Unpaid remainder on the sale's primary method (cash/mpesa/credit), after wallet/split rows in sale_payments. */
const primaryRemainderSql = `CASE
  WHEN s.total_amount > ${paymentsSumSql} THEN s.total_amount - ${paymentsSumSql}
  ELSE 0
END`;

/**
 * Amount collected via a payment method for one sale (sums to total_amount per sale).
 * - Pure cash/mpesa/credit: explicit rows in sale_payments + any unpaid remainder on that method
 * - Split: scale split rows so they sum to total_amount when under-recorded
 */
export function salePaymentAmountSql(method: 'cash' | 'mpesa' | 'credit' | 'wallet'): string {
  const explicit = explicitSql(method);

  if (method === 'wallet') {
    return `CASE
      WHEN s.payment_method = 'split' AND ${paymentsSumSql} > 0
        THEN ${explicit} * s.total_amount / ${paymentsSumSql}
      ELSE ${explicit}
    END`;
  }

  const primaryBump =
    method === 'cash' || method === 'mpesa' || method === 'credit'
      ? `CASE WHEN s.payment_method = '${method}' THEN ${primaryRemainderSql} ELSE 0 END`
      : '0';

  return `CASE
    WHEN s.payment_method = 'split' AND ${paymentsSumSql} > 0
      THEN ${explicit} * s.total_amount / ${paymentsSumSql}
    ELSE ${explicit}
  END + ${primaryBump}`;
}

/** Line-item share for department-filtered views. */
export function saleLinePaymentShareSql(method: 'cash' | 'mpesa' | 'credit' | 'wallet'): string {
  const amount = salePaymentAmountSql(method);
  return `(${amount}) / NULLIF(s.total_amount, 0)`;
}

export function salesByPaymentMethodQuery(
  dateFilter: string,
  itemType?: string | null
): string {
  const methods = ['cash', 'mpesa', 'credit', 'wallet'] as const;

  if (itemType) {
    const itemTypeFilter = ` AND COALESCE(si.item_type_snapshot, 'retail') = ?`;
    const unions = methods
      .map(
        (method) => `
      SELECT
        s.id AS sale_id,
        '${method}' AS payment_method,
        si.quantity_sold * si.sell_price_per_unit * (${saleLinePaymentShareSql(method)}) AS allocated
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}${itemTypeFilter}`
      )
      .join(' UNION ALL ');

    return `
      SELECT
        payment_method,
        COUNT(DISTINCT sale_id) AS count,
        COALESCE(SUM(allocated), 0) AS total
      FROM (${unions}) payment_lines
      WHERE allocated > 0
      GROUP BY payment_method
      ORDER BY total DESC`;
  }

  const unions = methods
    .map(
      (method) => `
    SELECT
      s.id AS sale_id,
      '${method}' AS payment_method,
      (${salePaymentAmountSql(method)}) AS allocated
    FROM sales s
    WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}`
    )
    .join(' UNION ALL ');

  return `
    SELECT
      payment_method,
      COUNT(DISTINCT sale_id) AS count,
      COALESCE(SUM(allocated), 0) AS total
    FROM (${unions}) payment_lines
    WHERE allocated > 0
    GROUP BY payment_method
    ORDER BY total DESC`;
}
