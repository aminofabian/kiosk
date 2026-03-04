import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

// Lightweight search endpoint for autocomplete suggestions
// Features: exact match → prefix match → contains match → fuzzy fallback
// Returns parent grouping info for variant display

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SuggestItem {
  id: string;
  name: string;
  variant_name: string | null;
  current_sell_price: number;
  unit_type: string;
  parent_item_id: string | null;
  parent_name: string | null;
  category_name: string | null;
  sibling_count: number;
}

export async function OPTIONS() {
  return optionsResponse();
}

// Generate a character-sequence LIKE pattern for fuzzy matching
// "tomto" → "%t%o%m%t%o%" — matches "tomato" because chars appear in order
function charSequencePattern(word: string): string {
  const chars = word.toLowerCase().replace(/[^a-z0-9]/g, '').split('');
  if (chars.length === 0) return '%%';
  return '%' + chars.join('%') + '%';
}

// Generate bigrams from a string for scoring
function getBigrams(str: string): Set<string> {
  const s = str.toLowerCase();
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

// Compute Dice coefficient similarity between two strings using bigrams
function diceCoefficient(a: string, b: string): number {
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

// Simple Levenshtein distance for short strings
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const q = request.nextUrl.searchParams.get('q')?.trim();
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '10'),
      20
    );

    if (!q || q.length < 1) {
      return jsonResponse({ success: true, data: [] });
    }

    const searchLower = q.toLowerCase();
    const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 0);

    // Base SELECT with parent name and sibling count
    const selectClause = `
      SELECT i.id, i.name, i.variant_name, i.current_sell_price, i.unit_type,
             i.parent_item_id, c.name as category_name,
             p.name as parent_name,
             COALESCE(
               (SELECT COUNT(*) FROM items s 
                WHERE s.parent_item_id = i.parent_item_id 
                AND s.active = 1 
                AND i.parent_item_id IS NOT NULL),
               0
             ) as sibling_count
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items p ON i.parent_item_id = p.id`;

    // Filter: only show sellable items (children or standalone, not empty parents)
    const activeFilter = `
      i.business_id = ? AND i.active = 1
      AND (
        i.parent_item_id IS NOT NULL
        OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)
      )`;

    let items: SuggestItem[];

    // === Phase 1: Exact LIKE matching (fast) ===
    if (searchWords.length <= 1) {
      const contains = `%${searchLower}%`;
      const starts = `${searchLower}%`;

      items = await query<SuggestItem>(
        `${selectClause}
         WHERE ${activeFilter}
           AND (LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.variant_name, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ?)
         ORDER BY
           CASE
             WHEN LOWER(i.name) LIKE ? THEN 1
             WHEN LOWER(i.variant_name) LIKE ? THEN 2
             WHEN LOWER(p.name) LIKE ? THEN 3
             WHEN LOWER(i.name) LIKE ? THEN 4
             ELSE 5
           END,
           i.name ASC
         LIMIT ?`,
        [auth.businessId, contains, contains, contains, starts, starts, starts, contains, limit]
      );
    } else {
      // Multi-word: match ALL words in name, variant_name, or parent name
      const wordConditions = searchWords
        .map(() => `(LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.variant_name, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ?)`)
        .join(' AND ');

      const wordParams: string[] = [];
      for (const word of searchWords) {
        wordParams.push(`%${word}%`, `%${word}%`, `%${word}%`);
      }

      const exactPhrase = `%${searchLower}%`;
      const firstWordStarts = `${searchWords[0]}%`;

      items = await query<SuggestItem>(
        `${selectClause}
         WHERE ${activeFilter}
           AND (${wordConditions})
         ORDER BY
           CASE
             WHEN LOWER(i.name) LIKE ? THEN 1
             WHEN LOWER(i.name) LIKE ? THEN 2
             WHEN LOWER(i.variant_name) LIKE ? THEN 3
             ELSE 4
           END,
           i.name ASC
         LIMIT ?`,
        [auth.businessId, ...wordParams, exactPhrase, firstWordStarts, exactPhrase, limit]
      );
    }

    // === Phase 2: Fuzzy fallback if exact matching found too few results ===
    if (items.length < 3 && searchLower.length >= 2) {
      const existingIds = new Set(items.map(i => i.id));

      // Strategy A: Character-sequence pattern (handles typos, missing chars, transpositions)
      const fuzzyLimit = limit - items.length;

      if (searchWords.length <= 1) {
        const fuzzyPattern = charSequencePattern(searchLower);
        const fuzzyItems = await query<SuggestItem>(
          `${selectClause}
           WHERE ${activeFilter}
             AND (LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.variant_name, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ?)
           LIMIT ?`,
          [auth.businessId, fuzzyPattern, fuzzyPattern, fuzzyPattern, fuzzyLimit + 10]
        );

        // Score fuzzy results by similarity and add best ones
        const scored = fuzzyItems
          .filter(fi => !existingIds.has(fi.id))
          .map(fi => {
            const nameScore = diceCoefficient(searchLower, fi.name.toLowerCase());
            const variantScore = fi.variant_name ? diceCoefficient(searchLower, fi.variant_name.toLowerCase()) : 0;
            const parentScore = fi.parent_name ? diceCoefficient(searchLower, fi.parent_name.toLowerCase()) : 0;
            const bestScore = Math.max(nameScore, variantScore, parentScore);

            // Also compute Levenshtein for short queries (more accurate for typos)
            let levScore = 0;
            if (searchLower.length <= 8) {
              const nameLev = levenshtein(searchLower, fi.name.toLowerCase().slice(0, searchLower.length + 2));
              const maxLen = Math.max(searchLower.length, fi.name.length);
              levScore = maxLen > 0 ? 1 - (nameLev / maxLen) : 0;
              if (fi.variant_name) {
                const varLev = levenshtein(searchLower, fi.variant_name.toLowerCase().slice(0, searchLower.length + 2));
                const varMaxLen = Math.max(searchLower.length, fi.variant_name.length);
                levScore = Math.max(levScore, varMaxLen > 0 ? 1 - (varLev / varMaxLen) : 0);
              }
            }

            return { item: fi, score: Math.max(bestScore, levScore) };
          })
          .filter(s => s.score > 0.25) // Minimum similarity threshold
          .sort((a, b) => b.score - a.score)
          .slice(0, fuzzyLimit);

        for (const { item } of scored) {
          items.push(item);
          existingIds.add(item.id);
        }
      } else {
        // Multi-word fuzzy: at least one word must fuzzy-match
        const fuzzyConditions = searchWords
          .map(() => `(LOWER(i.name) LIKE ? OR LOWER(i.variant_name) LIKE ? OR LOWER(p.name) LIKE ?)`)
          .join(' OR ');

        const fuzzyParams: string[] = [];
        for (const word of searchWords) {
          const pattern = charSequencePattern(word);
          fuzzyParams.push(pattern, pattern, pattern);
        }

        const fuzzyItems = await query<SuggestItem>(
          `${selectClause}
           WHERE ${activeFilter}
             AND (${fuzzyConditions})
           LIMIT ?`,
          [auth.businessId, ...fuzzyParams, fuzzyLimit + 10]
        );

        const scored = fuzzyItems
          .filter(fi => !existingIds.has(fi.id))
          .map(fi => {
            const combinedTarget = [fi.name, fi.variant_name, fi.parent_name].filter(Boolean).join(' ').toLowerCase();
            const nameScore = diceCoefficient(searchLower, combinedTarget);
            return { item: fi, score: nameScore };
          })
          .filter(s => s.score > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, fuzzyLimit);

        for (const { item } of scored) {
          items.push(item);
          existingIds.add(item.id);
        }
      }
    }

    return jsonResponse({ success: true, data: items });
  } catch (error) {
    console.error('Error in suggest:', error);
    return jsonResponse(
      { success: false, message: 'Search failed' },
      500
    );
  }
}
