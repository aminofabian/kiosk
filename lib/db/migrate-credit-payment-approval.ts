import { execute, query } from "./index";

/**
 * Migration: Add payment_approval tracking to credit_transactions,
 * last_debt_at to credit_accounts, and can_give_credit to users.
 *
 * Changes:
 * - credit_transactions: add payment_approval_status (NULL / 'pending' / 'rejected')
 *   and payment_approved_by / payment_approved_at — so cashier payments can be
 *   held for admin approval before the balance is updated.
 * - credit_accounts: add oldest_unpaid_debt_at — so the UI can show when the
 *   oldest unpaid credit (debt) was taken instead of the generic last_transaction_at.
 * - users: add can_give_credit (1 = allowed to create credit accounts on POS) —
 *   only existing credit-takers keep this true unless admin resets.
 */
export async function migrateCreditPaymentApproval(): Promise<void> {
  console.log("🔄 Starting credit payment approval migration...");

  // ── 1. credit_transactions → payment_approval_status ──────────────
  const ctCols = await query<{ name: string }>(
    `SELECT name FROM pragma_table_info('credit_transactions')
     WHERE name IN ('payment_approval_status', 'payment_approved_by', 'payment_approved_at')`,
  );
  const ctColNames = new Set(ctCols.map((r) => r.name));

  if (!ctColNames.has("payment_approval_status")) {
    console.log("  → Adding payment_approval_status to credit_transactions...");
    await execute(
      `ALTER TABLE credit_transactions ADD COLUMN payment_approval_status TEXT
       CHECK (payment_approval_status IN ('pending', 'rejected', 'approved'))`,
    );
  }
  if (!ctColNames.has("payment_approved_by")) {
    console.log("  → Adding payment_approved_by to credit_transactions...");
    await execute(
      `ALTER TABLE credit_transactions ADD COLUMN payment_approved_by TEXT`,
    );
  }
  if (!ctColNames.has("payment_approved_at")) {
    console.log("  → Adding payment_approved_at to credit_transactions...");
    await execute(
      `ALTER TABLE credit_transactions ADD COLUMN payment_approved_at INTEGER`,
    );
  }

  // ── 2. credit_accounts → oldest_unpaid_debt_at (replaces last_debt_at) ─
  // Drop the old last_debt_at column if it exists (SQLite doesn't support
  // ALTER TABLE DROP COLUMN in older versions, but newer ones do)
  const caOldCol = await query<{ name: string }>(
    `SELECT name FROM pragma_table_info('credit_accounts')
     WHERE name = 'last_debt_at'`,
  );
  if (caOldCol.length > 0) {
    // Can't easily drop columns in SQLite; we rename it instead
    // SQLite 3.35+ supports DROP COLUMN, but to be safe we just leave it
    // and add the new column separately
    console.log(
      "  → last_debt_at column exists (will be kept for backward compat)",
    );
  }
  const caCols = await query<{ name: string }>(
    `SELECT name FROM pragma_table_info('credit_accounts')
     WHERE name = 'oldest_unpaid_debt_at'`,
  );
  if (caCols.length === 0) {
    console.log("  → Adding oldest_unpaid_debt_at to credit_accounts...");
    await execute(
      `ALTER TABLE credit_accounts ADD COLUMN oldest_unpaid_debt_at INTEGER`,
    );
  }

  // ── 3. users → can_give_credit ───────────────────────────────────
  const userCols = await query<{ name: string }>(
    `SELECT name FROM pragma_table_info('users')
     WHERE name = 'can_give_credit'`,
  );
  if (userCols.length === 0) {
    console.log("  → Adding can_give_credit to users...");
    await execute(
      `ALTER TABLE users ADD COLUMN can_give_credit INTEGER NOT NULL DEFAULT 0`,
    );
  }

  // ── 4. businesses → credit_settings (JSON) ─────────────────────
  const bCols = await query<{ name: string }>(
    `SELECT name FROM pragma_table_info('businesses')
     WHERE name = 'credit_settings'`,
  );
  if (bCols.length === 0) {
    console.log("  → Adding credit_settings to businesses...");
    await execute(
      `ALTER TABLE businesses ADD COLUMN credit_settings TEXT DEFAULT '{}'`,
    );
  }

  // ── 5. Back-fill: grant can_give_credit to all existing credit-takers ──
  console.log(
    "  → Back-filling can_give_credit for users who have recorded debt transactions...",
  );
  await execute(`
    UPDATE users SET can_give_credit = 1
    WHERE id IN (
      SELECT DISTINCT recorded_by FROM credit_transactions WHERE type = 'debt'
    )
    AND can_give_credit = 0
  `);

  // Also grant to owners/admins by default
  await execute(`
    UPDATE users SET can_give_credit = 1
    WHERE role IN ('owner', 'admin')
    AND can_give_credit = 0
  `);

  // ── 6. Back-fill oldest_unpaid_debt_at using FIFO logic ──────────
  console.log(
    "  → Back-filling oldest_unpaid_debt_at using FIFO (cumulative debt vs payments)...",
  );
  // For accounts with balance > 0, the oldest unpaid debt is the first debt
  // where cumulative debt exceeds total valid payments.
  // We compute this per account by iterating — since this is a one-time
  // migration, we do it row by row for accuracy.
  const accountIds = await query<{ id: string }>(
    `SELECT id FROM credit_accounts WHERE total_credit > 0`,
  );
  for (const row of accountIds) {
    const payResult = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM credit_transactions
       WHERE credit_account_id = ?
         AND type = 'payment'
         AND (payment_approval_status IS NULL OR payment_approval_status = 'approved')
         AND (public_claim_status IS NULL OR public_claim_status NOT IN ('pending', 'rejected'))`,
      [row.id],
    );
    const totalPayments = payResult[0]?.total ?? 0;
    const oldestResult = await query<{ ts: number | null }>(
      `SELECT MIN(created_at) AS ts FROM (
         SELECT created_at,
           SUM(amount) OVER (ORDER BY created_at) AS running_total
         FROM credit_transactions
         WHERE credit_account_id = ? AND type = 'debt'
       )
       WHERE running_total > ?`,
      [row.id, totalPayments],
    );
    const ts = oldestResult[0]?.ts;
    if (ts !== undefined) {
      await execute(
        `UPDATE credit_accounts SET oldest_unpaid_debt_at = ? WHERE id = ?`,
        [ts, row.id],
      );
    }
  }
  // Cleared accounts get NULL
  await execute(`
    UPDATE credit_accounts SET oldest_unpaid_debt_at = NULL
    WHERE total_credit <= 0
  `);

  console.log("✅ Credit payment approval migration complete.");
}
