import { query } from '@/lib/db';
import { normalizeSaleIdInput, toCanonicalSaleUuid } from '@/lib/utils/sale-id';

export { normalizeSaleIdInput } from '@/lib/utils/sale-id';

export type ResolveSaleIdResult =
  | { ok: true; saleId: string }
  | { ok: false; reason: 'not_found' | 'ambiguous'; matchCount?: number };

const MIN_PREFIX_LEN = 4;

/**
 * Resolve a receipt ref (first 8 chars) or full sale UUID to the canonical sale id.
 */
export async function resolveSaleId(
  businessId: string,
  rawInput: string,
  options?: { userId?: string; restrictToUser?: boolean }
): Promise<ResolveSaleIdResult> {
  const normalized = normalizeSaleIdInput(rawInput);
  if (!normalized) {
    return { ok: false, reason: 'not_found' };
  }

  const userFilter = options?.restrictToUser && options.userId ? 'AND user_id = ?' : '';
  const userParams = options?.restrictToUser && options.userId ? [options.userId] : [];

  const canonical = toCanonicalSaleUuid(normalized);
  if (canonical) {
    const exact = await query<{ id: string }>(
      `SELECT id FROM sales
       WHERE business_id = ? AND id = ?
       ${userFilter}
       LIMIT 2`,
      [businessId, canonical, ...userParams]
    );
    if (exact.length === 1) {
      return { ok: true, saleId: exact[0].id };
    }
    if (exact.length > 1) {
      return { ok: false, reason: 'ambiguous', matchCount: exact.length };
    }
  }

  if (normalized.length < MIN_PREFIX_LEN) {
    return { ok: false, reason: 'not_found' };
  }

  const prefix = normalized.replace(/-/g, '').slice(0, 32);
  const rows = await query<{ id: string }>(
    `SELECT id FROM sales
     WHERE business_id = ?
     AND LOWER(REPLACE(id, '-', '')) LIKE ?
     ${userFilter}
     ORDER BY created_at DESC
     LIMIT 5`,
    [businessId, `${prefix}%`, ...userParams]
  );

  if (rows.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  if (rows.length > 1) {
    return { ok: false, reason: 'ambiguous', matchCount: rows.length };
  }
  return { ok: true, saleId: rows[0].id };
}
