/**
 * For payment rows: true when the payment applies to the customer's balance (excludes pending/rejected public claims).
 */
export const SQL_PAYMENT_APPLIES_TO_BALANCE =
  "(public_claim_status IS NULL OR public_claim_status NOT IN ('pending', 'rejected'))";

/**
 * Computes the timestamp of the oldest debt transaction that hasn't been fully
 * paid yet, using FIFO ordering (oldest debts paid first).
 *
 * Returns the Unix timestamp of the oldest unpaid debt, or NULL if all debts are paid.
 */
export async function computeOldestUnpaidDebtAt(
  creditAccountId: string,
): Promise<number | null> {
  const { query } = await import("@/lib/db");

  // Total valid payments (exclude pending/rejected claims and pending approval)
  const payResult = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM credit_transactions
     WHERE credit_account_id = ?
       AND type = 'payment'
       AND (payment_approval_status IS NULL OR payment_approval_status = 'approved')
       AND (public_claim_status IS NULL OR public_claim_status NOT IN ('pending', 'rejected'))`,
    [creditAccountId],
  );
  const totalPayments = payResult[0]?.total ?? 0;

  // Find the first debt where cumulative debt exceeds total payments
  const result = await query<{ oldest_unpaid: number | null }>(
    `SELECT MIN(created_at) AS oldest_unpaid FROM (
       SELECT created_at,
         SUM(amount) OVER (ORDER BY created_at) AS running_total
       FROM credit_transactions
       WHERE credit_account_id = ? AND type = 'debt'
     )
     WHERE running_total > ?`,
    [creditAccountId, totalPayments],
  );

  return result[0]?.oldest_unpaid ?? null;
}
