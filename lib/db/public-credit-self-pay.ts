import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { logActivity } from '@/lib/db/activity-log';
import { resolvePublicCreditAccountBySlug } from '@/lib/db/public-credit-resolve';

export function isCreditsPublicSelfPayDisabled(): boolean {
  const v = process.env.CREDITS_PUBLIC_SELF_PAY_DISABLED?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

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

/**
 * Customer-facing link: record a payment for the **full** current balance (self-reported).
 * Set CREDITS_PUBLIC_SELF_PAY_DISABLED=true to turn off.
 */
export async function recordPublicFullBalancePayment(
  slugParam: string,
  paymentMethod: 'cash' | 'mpesa'
): Promise<
  | { ok: true; newBalance: number; transactionId: string; pendingApproval: true }
  | {
      ok: false;
      code:
        | 'bad_slug'
        | 'not_found'
        | 'ambiguous'
        | 'disabled'
        | 'nothing_owed'
        | 'no_user'
        | 'conflict';
    }
> {
  if (isCreditsPublicSelfPayDisabled()) {
    return { ok: false, code: 'disabled' };
  }

  const resolved = await resolvePublicCreditAccountBySlug(slugParam);
  if (!resolved.ok) {
    return resolved;
  }

  const { accountId, businessId, customerName, totalCredit } = resolved.data;
  const amount = totalCredit;

  if (amount <= 0) {
    return { ok: false, code: 'nothing_owed' };
  }

  const recordedByUserId = await pickAttributionUserId(businessId);
  if (!recordedByUserId) {
    return { ok: false, code: 'no_user' };
  }

  const now = Math.floor(Date.now() / 1000);
  const transactionId = generateUUID();

  await execute(
    `INSERT INTO credit_transactions (
      id, credit_account_id, type, amount, payment_method,
      notes, recorded_by, created_at, public_claim_status
    ) VALUES (?, ?, 'payment', ?, ?, ?, ?, ?, 'pending')`,
    [
      transactionId,
      accountId,
      amount,
      paymentMethod,
      'Recorded by customer via public credit status link (pending admin approval)',
      recordedByUserId,
      now,
    ]
  );

  // Balance and drawer are updated only when an admin approves the claim.

  logActivity({
    businessId,
    action: 'create',
    entityType: 'credit',
    entityId: accountId,
    entityNameSnapshot: customerName,
    details: {
      amount,
      paymentMethod,
      source: 'public_credit_link',
      pendingApproval: true,
      transactionId,
    },
    performedBy: recordedByUserId,
  }).catch(() => {});

  return { ok: true, newBalance: amount, transactionId, pendingApproval: true };
}
