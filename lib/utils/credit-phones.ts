/**
 * Credit accounts store phone numbers as a JSON array string in `customer_phone`
 * (e.g. `["0712 111 222","0733 444 555"]`), with legacy plain-text values supported on read.
 */

export function parseCreditPhones(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const t = String(raw).trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean);
      }
    } catch {
      /* treat as single string below */
    }
  }
  return [t];
}

export function serializeCreditPhones(phones: string[]): string | null {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const p of phones) {
    const t = p.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    cleaned.push(t);
  }
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}

/** First phone for sale snapshots and legacy single-field display fallbacks */
export function primaryCreditPhone(raw: string | null | undefined): string | null {
  const all = parseCreditPhones(raw);
  return all[0] ?? null;
}

/**
 * SQLite: match stored phones against a core digit substring (same idea as sales route).
 * Binds two LIKE params (same value) for json_each vs legacy column.
 */
export function sqlCreditAccountMatchesPhoneDigits(
  columnExpr: string,
  digitSubstring: string
): { sql: string; params: [string, string] } {
  const like = `%${digitSubstring}%`;
  return {
    sql: `(
      ${columnExpr} IS NOT NULL AND (
        (json_valid(${columnExpr}) = 1 AND EXISTS (
          SELECT 1 FROM json_each(${columnExpr}) AS _cr_ph
          WHERE _cr_ph.value LIKE ?
        ))
        OR (json_valid(${columnExpr}) = 0 AND ${columnExpr} LIKE ?)
      )
    )`,
    params: [like, like],
  };
}

export function formatPhonesForDisplay(phones: string[]): string {
  if (phones.length === 0) return '';
  return phones.join(' · ');
}

/** Works with API-enriched accounts or raw DB rows */
export function creditAccountPhonesDisplay(acc: {
  customer_phones?: string[];
  customer_phone: string | null;
}): string {
  const phones =
    acc.customer_phones && acc.customer_phones.length > 0
      ? acc.customer_phones
      : parseCreditPhones(acc.customer_phone);
  return formatPhonesForDisplay(phones);
}

/** API shape: full list + first phone as `customer_phone` for backward compatibility */
export function enrichCreditAccountRow<T extends { customer_phone: string | null }>(
  row: T
): T & { customer_phones: string[] } {
  const phones = parseCreditPhones(row.customer_phone);
  return {
    ...row,
    customer_phones: phones,
    customer_phone: phones[0] ?? null,
  };
}
