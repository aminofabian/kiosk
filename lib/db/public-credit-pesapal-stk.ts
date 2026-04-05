import { execute, queryOne } from '@/lib/db';
import { logActivity } from '@/lib/db/activity-log';
import { isCreditsPublicSelfPayDisabled } from '@/lib/db/public-credit-self-pay';
import { resolvePublicCreditAccountBySlug } from '@/lib/db/public-credit-resolve';
import {
  getTransactionStatus,
  isPaymentCompleted,
  isPaymentFailed,
  isPesapalStkConfigured,
  submitOrderRequest,
  getPaymentStatusMessage,
} from '@/lib/pesapal';
import type { PesapalTransactionStatus } from '@/lib/pesapal';
import { generateUUID } from '@/lib/utils/uuid';
import {
  PUBLIC_WALLET_TOPUP_MAX_KES,
  PUBLIC_WALLET_TOPUP_MIN_KES,
} from '@/lib/constants/public-wallet-topup';

export { PUBLIC_WALLET_TOPUP_MAX_KES, PUBLIC_WALLET_TOPUP_MIN_KES } from '@/lib/constants/public-wallet-topup';

async function pickAttributionUserId(businessId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM users
     WHERE business_id = ? AND active = 1
     ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
              created_at ASC
     LIMIT 1`,
    [businessId]
  );
  return row?.id ?? null;
}

function roundKes(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

export function parsePublicWalletTopupAmountKes(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw);
  if (!Number.isFinite(n)) return null;
  const kes = Math.round(n);
  if (kes < PUBLIC_WALLET_TOPUP_MIN_KES || kes > PUBLIC_WALLET_TOPUP_MAX_KES) return null;
  return kes;
}

export async function initiatePublicCreditStkPush(
  slugParam: string,
  opts: {
    callbackBaseUrl: string;
  }
): Promise<
  | {
      ok: true;
      orderTrackingId: string;
      merchantReference: string;
      redirectUrl: string;
    }
  | { ok: false; code: string; message: string }
> {
  if (isCreditsPublicSelfPayDisabled()) {
    return { ok: false, code: 'disabled', message: 'Payments from this page are disabled' };
  }

  if (!isPesapalStkConfigured()) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'M-Pesa prompt payments are not configured for this store',
    };
  }

  const resolved = await resolvePublicCreditAccountBySlug(slugParam);
  if (!resolved.ok) {
    const msg =
      resolved.code === 'bad_slug'
        ? 'Invalid link'
        : resolved.code === 'ambiguous'
          ? 'Multiple stores match this link'
          : 'No account found';
    return { ok: false, code: resolved.code, message: msg };
  }

  const { accountId, businessId, customerName, totalCredit } = resolved.data;
  const amount = Number(totalCredit);

  if (amount <= 0) {
    return { ok: false, code: 'nothing_owed', message: 'There is no balance to pay' };
  }

  const merchantReference = `PC-${generateUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  const callbackUrl = `${opts.callbackBaseUrl.replace(/\/$/, '')}/api/pesapal/callback`;

  let orderResult: Awaited<ReturnType<typeof submitOrderRequest>>;
  try {
    orderResult = await submitOrderRequest({
      merchantReference,
      amount,
      description: `Credit balance · ${customerName}`.slice(0, 120),
      callbackUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not start payment';
    return { ok: false, code: 'pesapal_error', message: msg };
  }

  const now = Math.floor(Date.now() / 1000);
  const pendingId = generateUUID();

  await execute(
    `INSERT INTO public_credit_pesapal_pending (
      id, credit_account_id, business_id, order_tracking_id, merchant_reference,
      amount, balance_snapshot, kind, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'tab', ?)`,
    [
      pendingId,
      accountId,
      businessId,
      orderResult.order_tracking_id,
      orderResult.merchant_reference,
      amount,
      amount,
      now,
    ]
  );

  return {
    ok: true,
    orderTrackingId: orderResult.order_tracking_id,
    merchantReference: orderResult.merchant_reference,
    redirectUrl: orderResult.redirect_url,
  };
}

/**
 * Public M-Pesa (Pesapal) checkout to add funds to the customer store wallet (not tab balance).
 */
export async function initiatePublicWalletTopupStkPush(
  slugParam: string,
  amountKes: number,
  opts: { callbackBaseUrl: string }
): Promise<
  | {
      ok: true;
      orderTrackingId: string;
      merchantReference: string;
      redirectUrl: string;
    }
  | { ok: false; code: string; message: string }
> {
  if (isCreditsPublicSelfPayDisabled()) {
    return { ok: false, code: 'disabled', message: 'Payments from this page are disabled' };
  }

  if (!isPesapalStkConfigured()) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'M-Pesa prompt payments are not configured for this store',
    };
  }

  const resolved = await resolvePublicCreditAccountBySlug(slugParam);
  if (!resolved.ok) {
    const msg =
      resolved.code === 'bad_slug'
        ? 'Invalid link'
        : resolved.code === 'ambiguous'
          ? 'Multiple stores match this link'
          : 'No account found';
    return { ok: false, code: resolved.code, message: msg };
  }

  const amount = roundKes(amountKes);
  if (amount < PUBLIC_WALLET_TOPUP_MIN_KES || amount > PUBLIC_WALLET_TOPUP_MAX_KES) {
    return {
      ok: false,
      code: 'invalid_amount',
      message: `Enter an amount between KES ${PUBLIC_WALLET_TOPUP_MIN_KES.toLocaleString('en-KE')} and KES ${PUBLIC_WALLET_TOPUP_MAX_KES.toLocaleString('en-KE')}`,
    };
  }

  const { accountId, businessId, customerName, walletBalance } = resolved.data;
  const merchantReference = `PW-${generateUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  const callbackUrl = `${opts.callbackBaseUrl.replace(/\/$/, '')}/api/pesapal/callback`;

  let orderResult: Awaited<ReturnType<typeof submitOrderRequest>>;
  try {
    orderResult = await submitOrderRequest({
      merchantReference,
      amount,
      description: `Wallet top-up · ${customerName}`.slice(0, 120),
      callbackUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not start payment';
    return { ok: false, code: 'pesapal_error', message: msg };
  }

  const now = Math.floor(Date.now() / 1000);
  const pendingId = generateUUID();
  const walletSnapshot = roundKes(walletBalance);

  await execute(
    `INSERT INTO public_credit_pesapal_pending (
      id, credit_account_id, business_id, order_tracking_id, merchant_reference,
      amount, balance_snapshot, kind, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'wallet', ?)`,
    [
      pendingId,
      accountId,
      businessId,
      orderResult.order_tracking_id,
      orderResult.merchant_reference,
      amount,
      walletSnapshot,
      now,
    ]
  );

  return {
    ok: true,
    orderTrackingId: orderResult.order_tracking_id,
    merchantReference: orderResult.merchant_reference,
    redirectUrl: orderResult.redirect_url,
  };
}

async function applyWalletTopupAfterPesapalSuccess(params: {
  pending: { id: string; amount: number };
  accountId: string;
  businessId: string;
  customerName: string;
  orderTrackingId: string;
  status: PesapalTransactionStatus;
}): Promise<
  | { ok: true; state: 'pending'; message: string }
  | {
      ok: true;
      state: 'completed';
      message: string;
      newBalance: number;
      newWalletBalance: number;
    }
  | { ok: false; code: string; message: string }
> {
  const { pending, accountId, businessId, customerName, orderTrackingId, status } = params;

  const paidReported = Number(status.amount);
  const pendingAmount = roundKes(Number(pending.amount));
  const capFromPesapal =
    paidReported > 0 ? Math.min(roundKes(paidReported), pendingAmount) : pendingAmount;
  const applyAmount = roundKes(Math.min(capFromPesapal, pendingAmount));

  if (applyAmount <= 0) {
    return {
      ok: true,
      state: 'pending',
      message: 'Waiting for payment confirmation',
    };
  }

  const recordedByUserId = await pickAttributionUserId(businessId);
  if (!recordedByUserId) {
    return { ok: false, code: 'no_user', message: 'Store is not configured to apply payments' };
  }

  const now = Math.floor(Date.now() / 1000);
  const walletTxId = generateUUID();
  const notes = `M-Pesa wallet top-up (Pesapal) · order ${orderTrackingId}`;

  await execute(
    `INSERT INTO wallet_transactions (
      id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at
    ) VALUES (?, ?, NULL, 'credit', ?, ?, ?, ?)`,
    [walletTxId, accountId, applyAmount, notes, recordedByUserId, now]
  );

  const upd = await execute(
    `UPDATE credit_accounts
     SET wallet_balance = wallet_balance + ?, last_transaction_at = ?
     WHERE id = ? AND business_id = ?`,
    [applyAmount, now, accountId, businessId]
  );

  if (upd.rowsAffected !== 1) {
    await execute(`DELETE FROM wallet_transactions WHERE id = ?`, [walletTxId]);
    return {
      ok: true,
      state: 'pending',
      message: 'Could not apply top-up — try again in a moment',
    };
  }

  await execute(
    `UPDATE public_credit_pesapal_pending SET applied_at = ? WHERE id = ? AND applied_at IS NULL`,
    [now, pending.id]
  );

  const newRow = await queryOne<{ total_credit: number; wallet_balance: number }>(
    `SELECT total_credit, wallet_balance FROM credit_accounts WHERE id = ?`,
    [accountId]
  );
  const newBalance = Number(newRow?.total_credit ?? 0);
  const newWalletBalance = roundKes(Number(newRow?.wallet_balance ?? 0));

  logActivity({
    businessId,
    action: 'update',
    entityType: 'credit',
    entityId: accountId,
    entityNameSnapshot: customerName,
    details: {
      amount: applyAmount,
      paymentMethod: 'mpesa',
      newWalletBalance,
      source: 'public_wallet_pesapal_topup',
      orderTrackingId,
    },
    performedBy: recordedByUserId,
  }).catch(() => {});

  return {
    ok: true,
    state: 'completed',
    message: 'Top-up received. Your wallet balance has been updated.',
    newBalance,
    newWalletBalance,
  };
}

export async function pollPublicCreditStkAndApply(
  slugParam: string,
  orderTrackingId: string
): Promise<
  | {
      ok: true;
      state: 'pending' | 'completed' | 'failed';
      message: string;
      /** Tab (credit) balance after apply or current snapshot */
      newBalance?: number;
      /** Store wallet after apply or current snapshot */
      newWalletBalance?: number;
    }
  | { ok: false; code: string; message: string }
> {
  if (isCreditsPublicSelfPayDisabled()) {
    return { ok: false, code: 'disabled', message: 'Payments from this page are disabled' };
  }

  const resolved = await resolvePublicCreditAccountBySlug(slugParam);
  if (!resolved.ok) {
    return { ok: false, code: resolved.code, message: 'Invalid link' };
  }

  const { accountId, businessId, customerName } = resolved.data;

  const pending = await queryOne<{
    id: string;
    amount: number;
    balance_snapshot: number;
    applied_at: number | null;
    kind: string | null;
  }>(
    `SELECT id, amount, balance_snapshot, applied_at, kind
     FROM public_credit_pesapal_pending
     WHERE order_tracking_id = ? AND credit_account_id = ?`,
    [orderTrackingId, accountId]
  );

  if (!pending) {
    return { ok: false, code: 'unknown_order', message: 'This payment session was not found' };
  }

  const rowKind: 'tab' | 'wallet' = pending.kind === 'wallet' ? 'wallet' : 'tab';

  if (pending.applied_at != null) {
    const acc = await queryOne<{ total_credit: number; wallet_balance: number }>(
      `SELECT total_credit, wallet_balance FROM credit_accounts WHERE id = ?`,
      [accountId]
    );
    return {
      ok: true,
      state: 'completed',
      message: rowKind === 'wallet' ? 'Top-up already applied' : 'Payment already applied',
      newBalance: Number(acc?.total_credit ?? 0),
      newWalletBalance: roundKes(Number(acc?.wallet_balance ?? 0)),
    };
  }

  let status: Awaited<ReturnType<typeof getTransactionStatus>>;
  try {
    status = await getTransactionStatus(orderTrackingId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not check payment status';
    return { ok: false, code: 'status_error', message: msg };
  }

  if (isPaymentFailed(status)) {
    return {
      ok: true,
      state: 'failed',
      message: getPaymentStatusMessage(status),
    };
  }

  if (!isPaymentCompleted(status)) {
    return {
      ok: true,
      state: 'pending',
      message: getPaymentStatusMessage(status),
    };
  }

  if (rowKind === 'wallet') {
    const w = await applyWalletTopupAfterPesapalSuccess({
      pending,
      accountId,
      businessId,
      customerName,
      orderTrackingId,
      status,
    });
    if (!w.ok) {
      return w;
    }
    if (w.state === 'pending') {
      return {
        ok: true,
        state: 'pending',
        message: w.message,
      };
    }
    return {
      ok: true,
      state: 'completed',
      message: w.message,
      newBalance: w.newBalance,
      newWalletBalance: w.newWalletBalance,
    };
  }

  const paidReported = Number(status.amount);
  const pendingAmount = Number(pending.amount);

  const accountRow = await queryOne<{ total_credit: number }>(
    `SELECT total_credit FROM credit_accounts WHERE id = ? AND business_id = ?`,
    [accountId, businessId]
  );
  const currentCredit = Number(accountRow?.total_credit ?? 0);

  if (currentCredit <= 0) {
    await execute(
      `UPDATE public_credit_pesapal_pending SET applied_at = ? WHERE id = ?`,
      [Math.floor(Date.now() / 1000), pending.id]
    );
    const acc = await queryOne<{ wallet_balance: number }>(
      `SELECT wallet_balance FROM credit_accounts WHERE id = ?`,
      [accountId]
    );
    return {
      ok: true,
      state: 'completed',
      message: 'Balance was already cleared',
      newBalance: 0,
      newWalletBalance: roundKes(Number(acc?.wallet_balance ?? 0)),
    };
  }

  const capFromPesapal =
    paidReported > 0 ? Math.min(paidReported, pendingAmount) : pendingAmount;
  const applyAmount = Math.min(currentCredit, pendingAmount, capFromPesapal);

  if (applyAmount <= 0) {
    return {
      ok: true,
      state: 'pending',
      message: 'Waiting for payment confirmation',
    };
  }

  const recordedByUserId = await pickAttributionUserId(businessId);
  if (!recordedByUserId) {
    return { ok: false, code: 'no_user', message: 'Store is not configured to apply payments' };
  }

  const now = Math.floor(Date.now() / 1000);
  const transactionId = generateUUID();
  const notes = `M-Pesa prompt (Pesapal) · order ${orderTrackingId}`;

  await execute(
    `INSERT INTO credit_transactions (
      id, credit_account_id, type, amount, payment_method,
      notes, recorded_by, created_at
    ) VALUES (?, ?, 'payment', ?, 'mpesa', ?, ?, ?)`,
    [transactionId, accountId, applyAmount, notes, recordedByUserId, now]
  );

  const upd = await execute(
    `UPDATE credit_accounts
     SET total_credit = total_credit - ?, last_transaction_at = ?
     WHERE id = ? AND business_id = ? AND total_credit >= ?`,
    [applyAmount, now, accountId, businessId, applyAmount]
  );

  if (upd.rowsAffected !== 1) {
    await execute(`DELETE FROM credit_transactions WHERE id = ?`, [transactionId]);
    return {
      ok: true,
      state: 'pending',
      message: 'Balance changed — refresh and try again if you still owe',
    };
  }

  await execute(
    `UPDATE public_credit_pesapal_pending SET applied_at = ? WHERE id = ? AND applied_at IS NULL`,
    [now, pending.id]
  );

  const newRow = await queryOne<{ total_credit: number; wallet_balance: number }>(
    `SELECT total_credit, wallet_balance FROM credit_accounts WHERE id = ?`,
    [accountId]
  );
  const newBalance = Number(newRow?.total_credit ?? 0);
  const newWalletBalance = roundKes(Number(newRow?.wallet_balance ?? 0));

  logActivity({
    businessId,
    action: 'update',
    entityType: 'credit',
    entityId: accountId,
    entityNameSnapshot: customerName,
    details: {
      amount: applyAmount,
      paymentMethod: 'mpesa',
      newBalance,
      source: 'public_credit_pesapal_stk',
      orderTrackingId,
    },
    performedBy: recordedByUserId,
  }).catch(() => {});

  return {
    ok: true,
    state: 'completed',
    message: 'Payment received. Your balance has been updated.',
    newBalance,
    newWalletBalance,
  };
}
