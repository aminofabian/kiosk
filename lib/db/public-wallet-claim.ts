import { execute, queryOne } from '@/lib/db';
import { logActivity } from '@/lib/db/activity-log';
import { isCreditsPublicSelfPayDisabled } from '@/lib/db/public-credit-self-pay';
import { resolvePublicCreditAccountBySlug } from '@/lib/db/public-credit-resolve';
import { generateUUID } from '@/lib/utils/uuid';
import {
  PUBLIC_WALLET_TOPUP_MAX_KES,
  PUBLIC_WALLET_TOPUP_MIN_KES,
} from '@/lib/constants/public-wallet-topup';

const MAX_CUSTOMER_REFERENCE_LEN = 80;
const MAX_NOTES_LEN = 500;
const MIN_MPESA_REF_LEN = 4;

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

export async function recordPublicWalletTopupClaim(
  slugParam: string,
  input: {
    amount: number;
    paymentMethod: 'cash' | 'mpesa';
    mpesaTransactionCode?: string;
    /** Optional receipt / reference for cash payments */
    customerReference?: string;
    notes?: string;
  }
): Promise<
  | { ok: true; transactionId: string }
  | {
      ok: false;
      code:
        | 'bad_slug'
        | 'not_found'
        | 'ambiguous'
        | 'disabled'
        | 'no_user'
        | 'invalid_amount'
        | 'invalid_reference';
    }
> {
  if (isCreditsPublicSelfPayDisabled()) {
    return { ok: false, code: 'disabled' };
  }

  const resolved = await resolvePublicCreditAccountBySlug(slugParam);
  if (!resolved.ok) {
    return resolved;
  }

  const amount = roundKes(input.amount);
  if (
    !Number.isFinite(amount) ||
    amount < PUBLIC_WALLET_TOPUP_MIN_KES ||
    amount > PUBLIC_WALLET_TOPUP_MAX_KES
  ) {
    return { ok: false, code: 'invalid_amount' };
  }

  const method = input.paymentMethod === 'cash' ? 'cash' : 'mpesa';
  let ref: string;
  if (method === 'mpesa') {
    const raw = (input.mpesaTransactionCode ?? '').trim().slice(0, MAX_CUSTOMER_REFERENCE_LEN);
    const compact = raw.replace(/\s/g, '');
    if (compact.length < MIN_MPESA_REF_LEN) {
      return { ok: false, code: 'invalid_reference' };
    }
    ref = compact;
  } else {
    ref = (input.customerReference ?? '').trim().slice(0, MAX_CUSTOMER_REFERENCE_LEN);
  }

  let extraNotes = (input.notes ?? '').trim().slice(0, MAX_NOTES_LEN);
  const baseNote =
    'Wallet top-up recorded by customer via public link (pending admin approval)';
  const notes = extraNotes ? `${baseNote}\nCustomer note: ${extraNotes}` : baseNote;

  const recordedByUserId = await pickAttributionUserId(resolved.data.businessId);
  if (!recordedByUserId) {
    return { ok: false, code: 'no_user' };
  }

  const { accountId, businessId, customerName } = resolved.data;
  const now = Math.floor(Date.now() / 1000);
  const transactionId = generateUUID();

  await execute(
    `INSERT INTO wallet_transactions (
      id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at,
      public_claim_status, payment_method, customer_reference
    ) VALUES (?, ?, NULL, 'credit', ?, ?, ?, ?, 'pending', ?, ?)`,
    [transactionId, accountId, amount, notes, recordedByUserId, now, method, ref || null]
  );

  logActivity({
    businessId,
    action: 'create',
    entityType: 'credit',
    entityId: accountId,
    entityNameSnapshot: customerName,
    details: {
      amount,
      paymentMethod: method,
      source: 'public_wallet_topup_claim',
      pendingApproval: true,
      transactionId,
      customerReference: ref || undefined,
    },
    performedBy: recordedByUserId,
  }).catch(() => {});

  return { ok: true, transactionId };
}
