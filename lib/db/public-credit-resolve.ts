import type { InValue } from '@libsql/client';
import { query } from '@/lib/db';
import {
  parseCreditPhones,
  sqlCreditAccountMatchesPhoneDigits,
} from '@/lib/utils/credit-phones';
import {
  normalizeKenyaPhoneDigits,
  parseCreditPhoneSlugParam,
} from '@/lib/utils/credit-public-slug';

export type ResolvedPublicCreditAccount = {
  accountId: string;
  businessId: string;
  customerName: string;
  customerPhone: string | null;
  totalCredit: number;
  lastTransactionAt: number | null;
  businessName: string;
  targetNorm: string;
  slugDigits: string;
};

/**
 * Resolve a single credit account from the public phone slug (same rules as the status page).
 */
export async function resolvePublicCreditAccountBySlug(
  slugParam: string
): Promise<
  | { ok: true; data: ResolvedPublicCreditAccount }
  | { ok: false; code: 'bad_slug' | 'not_found' | 'ambiguous' }
> {
  const slugDigits = parseCreditPhoneSlugParam(slugParam);
  if (!slugDigits) {
    return { ok: false, code: 'bad_slug' };
  }

  const targetNorm = normalizeKenyaPhoneDigits(slugDigits);
  if (targetNorm.length < 9) {
    return { ok: false, code: 'bad_slug' };
  }

  const configuredBusinessId = process.env.CREDITS_PUBLIC_BUSINESS_ID?.trim() || null;

  const ph = sqlCreditAccountMatchesPhoneDigits('ca.customer_phone', targetNorm);
  let sql = `
    SELECT ca.id, ca.business_id, ca.customer_name, ca.customer_phone, ca.total_credit, ca.last_transaction_at,
           b.name AS business_name
    FROM credit_accounts ca
    INNER JOIN businesses b ON b.id = ca.business_id
    WHERE b.active = 1 AND ${ph.sql}
  `;
  const params: InValue[] = [...ph.params];
  if (configuredBusinessId) {
    sql += ' AND ca.business_id = ?';
    params.push(configuredBusinessId);
  }

  const rows = await query<{
    id: string;
    business_id: string;
    customer_name: string;
    customer_phone: string | null;
    total_credit: number;
    last_transaction_at: number | null;
    business_name: string;
  }>(sql, params);

  const matches = rows.filter((r) =>
    parseCreditPhones(r.customer_phone).some((p) => normalizeKenyaPhoneDigits(p) === targetNorm)
  );

  if (matches.length === 0) {
    return { ok: false, code: 'not_found' };
  }
  if (matches.length > 1 && !configuredBusinessId) {
    return { ok: false, code: 'ambiguous' };
  }

  const acc = matches[0];
  return {
    ok: true,
    data: {
      accountId: acc.id,
      businessId: acc.business_id,
      customerName: acc.customer_name,
      customerPhone: acc.customer_phone,
      totalCredit: Number(acc.total_credit),
      lastTransactionAt: acc.last_transaction_at,
      businessName: acc.business_name,
      targetNorm,
      slugDigits,
    },
  };
}
