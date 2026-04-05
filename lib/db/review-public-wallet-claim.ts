import { execute, queryOne } from '@/lib/db';
import { logActivity } from '@/lib/db/activity-log';
import { isAdminOrOwner } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/constants';

type ReviewResult =
  | { ok: true; newWalletBalance: number }
  | { ok: false; code: 'not_found' | 'bad_state' | 'shift_required'; message: string };

export async function approvePublicWalletTopupClaim(
  businessId: string,
  transactionId: string,
  reviewerUserId: string
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
    `SELECT wt.id, wt.credit_account_id, wt.type, wt.amount, wt.payment_method,
            wt.public_claim_status, wt.recorded_by
     FROM wallet_transactions wt
     INNER JOIN credit_accounts ca ON ca.id = wt.credit_account_id
     WHERE wt.id = ? AND ca.business_id = ?`,
    [transactionId, businessId]
  );

  if (!row || row.type !== 'credit') {
    return { ok: false, code: 'not_found', message: 'Wallet entry not found' };
  }
  if (row.public_claim_status !== 'pending') {
    return { ok: false, code: 'bad_state', message: 'This claim is not awaiting approval' };
  }

  const account = await queryOne<{ wallet_balance: number; customer_name: string }>(
    `SELECT wallet_balance, customer_name FROM credit_accounts WHERE id = ? AND business_id = ?`,
    [row.credit_account_id, businessId]
  );
  if (!account) {
    return { ok: false, code: 'not_found', message: 'Credit account not found' };
  }

  const amount = Number(row.amount);
  const now = Math.floor(Date.now() / 1000);

  if (row.payment_method === 'cash') {
    const actor = await queryOne<{ role: string }>(
      `SELECT role FROM users WHERE id = ? AND business_id = ?`,
      [row.recorded_by, businessId]
    );
    const actorRole = (actor?.role ?? 'cashier') as UserRole;

    const shift = await queryOne<{ id: string }>(
      `SELECT id FROM shifts WHERE business_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
      [businessId, row.recorded_by]
    );

    if (shift) {
      await execute(
        `UPDATE shifts SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?`,
        [amount, shift.id]
      );
    } else if (!isAdminOrOwner(actorRole)) {
      return {
        ok: false,
        code: 'shift_required',
        message:
          'Attributed staff has no open shift — open a shift for them or reject and record the top-up at the till.',
      };
    }
  }

  const upd = await execute(
    `UPDATE credit_accounts
     SET wallet_balance = wallet_balance + ?, last_transaction_at = ?
     WHERE id = ? AND business_id = ?`,
    [amount, now, row.credit_account_id, businessId]
  );

  if (upd.rowsAffected !== 1) {
    return { ok: false, code: 'not_found', message: 'Could not update wallet balance' };
  }

  await execute(
    `UPDATE wallet_transactions
     SET public_claim_status = NULL,
         claim_reviewed_at = ?,
         claim_reviewed_by = ?,
         notes = TRIM(REPLACE(COALESCE(notes, ''), ' (pending admin approval)', ' (approved)'))
     WHERE id = ? AND credit_account_id = ?`,
    [now, reviewerUserId, transactionId, row.credit_account_id]
  );

  const newRow = await queryOne<{ wallet_balance: number }>(
    `SELECT wallet_balance FROM credit_accounts WHERE id = ?`,
    [row.credit_account_id]
  );
  const newWalletBalance = Number(newRow?.wallet_balance ?? 0);

  logActivity({
    businessId,
    action: 'update',
    entityType: 'credit',
    entityId: row.credit_account_id,
    entityNameSnapshot: account.customer_name,
    details: {
      amount,
      paymentMethod: row.payment_method,
      newWalletBalance,
      source: 'public_wallet_claim_approved',
      transactionId,
      reviewedBy: reviewerUserId,
    },
    performedBy: reviewerUserId,
  }).catch(() => {});

  return { ok: true, newWalletBalance };
}

export async function rejectPublicWalletTopupClaim(
  businessId: string,
  transactionId: string,
  reviewerUserId: string
): Promise<ReviewResult> {
  const row = await queryOne<{
    id: string;
    credit_account_id: string;
    type: string;
    public_claim_status: string | null;
    customer_name: string;
  }>(
    `SELECT wt.id, wt.credit_account_id, wt.type, wt.public_claim_status, ca.customer_name
     FROM wallet_transactions wt
     INNER JOIN credit_accounts ca ON ca.id = wt.credit_account_id
     WHERE wt.id = ? AND ca.business_id = ?`,
    [transactionId, businessId]
  );

  if (!row || row.type !== 'credit') {
    return { ok: false, code: 'not_found', message: 'Wallet entry not found' };
  }
  if (row.public_claim_status !== 'pending') {
    return { ok: false, code: 'bad_state', message: 'This claim is not awaiting approval' };
  }

  const now = Math.floor(Date.now() / 1000);
  await execute(
    `UPDATE wallet_transactions
     SET public_claim_status = 'rejected',
         claim_reviewed_at = ?,
         claim_reviewed_by = ?
     WHERE id = ? AND credit_account_id = ?`,
    [now, reviewerUserId, transactionId, row.credit_account_id]
  );

  logActivity({
    businessId,
    action: 'update',
    entityType: 'credit',
    entityId: row.credit_account_id,
    entityNameSnapshot: row.customer_name,
    details: { source: 'public_wallet_claim_rejected', transactionId },
    performedBy: reviewerUserId,
  }).catch(() => {});

  const bal = await queryOne<{ wallet_balance: number }>(
    `SELECT wallet_balance FROM credit_accounts WHERE id = ?`,
    [row.credit_account_id]
  );

  return { ok: true, newWalletBalance: Number(bal?.wallet_balance ?? 0) };
}
