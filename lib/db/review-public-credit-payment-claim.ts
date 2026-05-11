import { execute, query, queryOne } from "@/lib/db";
import { logActivity } from "@/lib/db/activity-log";
import { isAdminOrOwner } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/constants";

type ReviewResult =
  | { ok: true; newBalance: number }
  | {
      ok: false;
      code: "not_found" | "bad_state" | "conflict" | "shift_required";
      message: string;
    };

export async function approvePublicCreditPaymentClaim(
  businessId: string,
  transactionId: string,
  reviewerUserId: string,
): Promise<ReviewResult> {
  const row = await queryOne<{
    id: string;
    credit_account_id: string;
    type: string;
    amount: number;
    payment_method: string | null;
    public_claim_status: string | null;
    recorded_by: string;
  }>(
    `SELECT ct.id, ct.credit_account_id, ct.type, ct.amount, ct.payment_method,
            ct.public_claim_status, ct.recorded_by
     FROM credit_transactions ct
     INNER JOIN credit_accounts ca ON ca.id = ct.credit_account_id
     WHERE ct.id = ? AND ca.business_id = ?`,
    [transactionId, businessId],
  );

  if (!row || row.type !== "payment") {
    return {
      ok: false,
      code: "not_found",
      message: "Payment record not found",
    };
  }
  if (row.public_claim_status !== "pending") {
    return {
      ok: false,
      code: "bad_state",
      message: "This claim is not awaiting approval",
    };
  }

  const account = await queryOne<{
    total_credit: number;
    customer_name: string;
  }>(
    `SELECT total_credit, customer_name FROM credit_accounts WHERE id = ? AND business_id = ?`,
    [row.credit_account_id, businessId],
  );
  if (!account) {
    return {
      ok: false,
      code: "not_found",
      message: "Credit account not found",
    };
  }

  const amount = Number(row.amount);
  const totalCredit = Number(account.total_credit);
  if (amount > totalCredit) {
    return {
      ok: false,
      code: "conflict",
      message:
        "Outstanding balance is less than the claimed amount. Refresh and reject this claim or adjust at the till.",
    };
  }

  const now = Math.floor(Date.now() / 1000);

  const upd = await execute(
    `UPDATE credit_accounts
     SET total_credit = total_credit - ?, last_transaction_at = ?
     WHERE id = ? AND business_id = ? AND total_credit >= ?`,
    [amount, now, row.credit_account_id, businessId, amount],
  );

  if (upd.rowsAffected !== 1) {
    return {
      ok: false,
      code: "conflict",
      message: "Balance changed — refresh and try again",
    };
  }

  if (row.payment_method === "cash") {
    const actor = await queryOne<{ role: string }>(
      `SELECT role FROM users WHERE id = ? AND business_id = ?`,
      [row.recorded_by, businessId],
    );
    const actorRole = (actor?.role ?? "cashier") as UserRole;

    const shift = await queryOne<{ id: string }>(
      `SELECT id FROM shifts WHERE business_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
      [businessId, row.recorded_by],
    );

    if (shift) {
      await execute(
        `UPDATE shifts SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?`,
        [amount, shift.id],
      );
    } else if (!isAdminOrOwner(actorRole)) {
      await execute(
        `UPDATE credit_accounts SET total_credit = total_credit + ?, last_transaction_at = ? WHERE id = ?`,
        [amount, now, row.credit_account_id],
      );
      return {
        ok: false,
        code: "shift_required",
        message:
          "Attributed staff has no open shift — open a shift for them or reject and record payment at the till.",
      };
    }
  }

  await execute(
    `UPDATE credit_transactions
     SET public_claim_status = NULL,
         claim_reviewed_at = ?,
         claim_reviewed_by = ?,
         notes = TRIM(REPLACE(COALESCE(notes, ''), ' (pending admin approval)', ''))
     WHERE id = ? AND credit_account_id = ?`,
    [now, reviewerUserId, transactionId, row.credit_account_id],
  );

  // Recompute oldest unpaid debt after this payment
  const payTotal = await query<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM credit_transactions
     WHERE credit_account_id = ?
       AND type = 'payment'
       AND (payment_approval_status IS NULL OR payment_approval_status = 'approved')
       AND (public_claim_status IS NULL OR public_claim_status NOT IN ('pending', 'rejected'))`,
    [row.credit_account_id],
  );
  const totalPayments = payTotal[0]?.total ?? 0;
  const oldestUnpaid = await query<{ ts: number | null }>(
    `SELECT MIN(created_at) AS ts FROM (
       SELECT created_at,
         SUM(amount) OVER (ORDER BY created_at) AS running_total
       FROM credit_transactions
       WHERE credit_account_id = ? AND type = 'debt'
     )
     WHERE running_total > ?`,
    [row.credit_account_id, totalPayments],
  );
  const recomputed = oldestUnpaid[0]?.ts ?? null;
  await execute(
    `UPDATE credit_accounts SET oldest_unpaid_debt_at = ? WHERE id = ?`,
    [recomputed, row.credit_account_id],
  );

  const newRow = await queryOne<{ total_credit: number }>(
    `SELECT total_credit FROM credit_accounts WHERE id = ?`,
    [row.credit_account_id],
  );
  const newBalance = Number(newRow?.total_credit ?? 0);

  logActivity({
    businessId,
    action: "update",
    entityType: "credit",
    entityId: row.credit_account_id,
    entityNameSnapshot: account.customer_name,
    details: {
      amount,
      paymentMethod: row.payment_method,
      newBalance,
      source: "public_credit_claim_approved",
      transactionId,
      reviewedBy: reviewerUserId,
    },
    performedBy: reviewerUserId,
  }).catch(() => {});

  return { ok: true, newBalance };
}

export async function rejectPublicCreditPaymentClaim(
  businessId: string,
  transactionId: string,
  reviewerUserId: string,
): Promise<ReviewResult> {
  const row = await queryOne<{
    id: string;
    credit_account_id: string;
    type: string;
    public_claim_status: string | null;
    customer_name: string;
  }>(
    `SELECT ct.id, ct.credit_account_id, ct.type, ct.public_claim_status, ca.customer_name
     FROM credit_transactions ct
     INNER JOIN credit_accounts ca ON ca.id = ct.credit_account_id
     WHERE ct.id = ? AND ca.business_id = ?`,
    [transactionId, businessId],
  );

  if (!row || row.type !== "payment") {
    return {
      ok: false,
      code: "not_found",
      message: "Payment record not found",
    };
  }
  if (row.public_claim_status !== "pending") {
    return {
      ok: false,
      code: "bad_state",
      message: "This claim is not awaiting approval",
    };
  }

  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE credit_transactions
     SET public_claim_status = 'rejected',
         claim_reviewed_at = ?,
         claim_reviewed_by = ?
     WHERE id = ? AND credit_account_id = ?`,
    [now, reviewerUserId, transactionId, row.credit_account_id],
  );

  logActivity({
    businessId,
    action: "update",
    entityType: "credit",
    entityId: row.credit_account_id,
    entityNameSnapshot: row.customer_name,
    details: { source: "public_credit_claim_rejected", transactionId },
    performedBy: reviewerUserId,
  }).catch(() => {});

  const bal = await queryOne<{ total_credit: number }>(
    `SELECT total_credit FROM credit_accounts WHERE id = ?`,
    [row.credit_account_id],
  );

  return { ok: true, newBalance: Number(bal?.total_credit ?? 0) };
}
