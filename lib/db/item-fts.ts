import { queryOne } from '@/lib/db';

/** Only cache positive detection so a migration in the same process is picked up on the next search. */
let ftsTableKnownExists = false;

/**
 * True when the items_fts virtual table exists (migration has been applied).
 */
export async function itemsFtsAvailable(): Promise<boolean> {
  if (ftsTableKnownExists) return true;
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM sqlite_master WHERE type = 'table' AND name = 'items_fts'`
  );
  const exists = (row?.c ?? 0) > 0;
  if (exists) ftsTableKnownExists = true;
  return exists;
}

function normalizeToken(t: string): string | null {
  const s = t.trim().toLowerCase();
  if (!s) return null;
  const cleaned = s.replace(/[^\p{L}\p{N}]+/gu, '');
  if (!cleaned) return null;
  if (cleaned.length > 48) return cleaned.slice(0, 48);
  return cleaned;
}

function escapePhraseToken(w: string): string {
  return `"${w.replace(/"/g, '""')}"`;
}

/**
 * Build an FTS5 MATCH string with the same intent as the old SQL search:
 * multi-word = all tokens must appear (AND). Last token uses prefix match unless the query ends with whitespace.
 * Tokens are restricted to letters/numbers after normalization so MATCH stays safe.
 */
export function buildFtsMatchQuery(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasTrailingSpace = /\s$/.test(raw);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const normalized = words.map(normalizeToken).filter((x): x is string => !!x);
  if (normalized.length === 0) return null;

  if (hasTrailingSpace) {
    return normalized.map(escapePhraseToken).join(' AND ');
  }

  if (normalized.length === 1) {
    const w = normalized[0];
    return `${w}*`;
  }

  const complete = normalized.slice(0, -1).map(escapePhraseToken);
  const last = normalized[normalized.length - 1]!;
  const lastClause = last.length < 2 ? escapePhraseToken(last) : `${last}*`;
  return [...complete, lastClause].join(' AND ');
}

/**
 * Loose FTS MATCH for the suggest fuzzy phase: short prefix(es) joined with OR
 * so we scan at most a few hundred index hits instead of a table-wide LIKE.
 */
export function buildFtsFuzzyProbeMatch(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 2) return null;
  const words = trimmed.split(/\s+/).filter(Boolean).slice(0, 5);
  const parts: string[] = [];
  for (const w of words) {
    const t = normalizeToken(w);
    if (!t || t.length < 2) continue;
    const pl = Math.min(3, t.length);
    parts.push(`${t.slice(0, pl)}*`);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `(${parts.join(' OR ')})`;
}
