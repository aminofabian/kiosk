import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { buildFtsFuzzyProbeMatch, buildFtsMatchQuery, itemsFtsAvailable } from '@/lib/db/item-fts';
import {
  charSequencePattern,
  scoreCombinedTextMatch,
  scoreItemTextMatch,
} from '@/lib/search/fuzzy-text';
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
  batch_number?: string | null;
}

export async function OPTIONS() {
  return optionsResponse();
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
    const useItemFts = await itemsFtsAvailable();
    const ftsMatch = useItemFts ? buildFtsMatchQuery(q) : null;
    const ftsFuzzyProbe = useItemFts ? buildFtsFuzzyProbeMatch(q) : null;

    // Base SELECT with parent name and sibling count (FROM varies: LIKE vs FTS)
    const selectList = `
      SELECT i.id, i.name, i.variant_name, i.current_sell_price, i.unit_type,
             i.parent_item_id, c.name as category_name,
             p.name as parent_name,
             COALESCE(
               (SELECT COUNT(*) FROM items s 
                WHERE s.parent_item_id = i.parent_item_id 
                AND s.active = 1 
                AND i.parent_item_id IS NOT NULL),
               0
             ) as sibling_count`;

    const fromLike = `
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items p ON i.parent_item_id = p.id`;

    const fromFts = `
      FROM items_fts
      INNER JOIN items i ON i.id = items_fts.item_id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items p ON i.parent_item_id = p.id`;

    const selectClause = `${selectList}${fromLike}`;

    // Filter: only show sellable items (children or standalone, not empty parents)
    const activeFilter = `
      i.business_id = ? AND i.active = 1
      AND (
        i.parent_item_id IS NOT NULL
        OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)
      )`;

    const activeFilterFts = `
      items_fts.business_id = ? AND i.active = 1
      AND (
        i.parent_item_id IS NOT NULL
        OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)
      )`;

    let items: SuggestItem[];

    // === Phase 1: FTS (indexed) or LIKE fallback ===
    if (ftsMatch) {
      items = await query<SuggestItem>(
        `${selectList}${fromFts}
         WHERE ${activeFilterFts}
           AND items_fts MATCH ?
         ORDER BY bm25(items_fts), i.name ASC
         LIMIT ?`,
        [auth.businessId, ftsMatch, limit]
      );
    } else if (searchWords.length <= 1) {
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

    // Unspaced compound words: "redonions" → "red onions"
    if (
      items.length === 0 &&
      !searchLower.includes(" ") &&
      searchLower.length >= 6 &&
      searchLower.length <= 20
    ) {
      if (ftsMatch && useItemFts) {
        const fuzzyMatches: string[] = [];
        for (let i = 3; i < searchLower.length - 2; i++) {
          fuzzyMatches.push(
            `${searchLower.slice(0, i)}* AND ${searchLower.slice(i)}*`,
          );
        }
        if (fuzzyMatches.length > 0) {
          const splitItems = await query<SuggestItem>(
            `${selectList}${fromFts}
             WHERE ${activeFilterFts}
               AND items_fts MATCH ?
             ORDER BY bm25(items_fts), i.name ASC
             LIMIT ?`,
            [auth.businessId, `(${fuzzyMatches.join(" OR ")})`, limit],
          );
          if (splitItems.length > 0) items = splitItems;
        }
      }

      if (items.length === 0) {
        for (let i = 3; i < searchLower.length - 2; i++) {
          const w1 = searchLower.slice(0, i);
          const w2 = searchLower.slice(i);
          const splitItems = await query<SuggestItem>(
            `${selectClause}
             WHERE ${activeFilter}
               AND (
                 (LOWER(i.name) LIKE ? AND LOWER(i.name) LIKE ?)
                 OR (LOWER(COALESCE(i.variant_name, '')) LIKE ? AND LOWER(COALESCE(i.variant_name, '')) LIKE ?)
                 OR (LOWER(COALESCE(p.name, '')) LIKE ? AND LOWER(COALESCE(p.name, '')) LIKE ?)
               )
             ORDER BY i.name ASC
             LIMIT ?`,
            [
              auth.businessId,
              `%${w1}%`,
              `%${w2}%`,
              `%${w1}%`,
              `%${w2}%`,
              `%${w1}%`,
              `%${w2}%`,
              limit,
            ],
          );
          if (splitItems.length > 0) {
            items = splitItems;
            break;
          }
        }
      }
    }

    // === Phase 2: Fuzzy fallback if exact matching found too few results ===
    if (items.length < 3 && searchLower.length >= 2) {
      const existingIds = new Set(items.map(i => i.id));

      const fuzzyLimit = limit - items.length;
      const fuzzyCap = fuzzyLimit + 10;

      if (searchWords.length <= 1) {
        let fuzzyItems: SuggestItem[];

        if (ftsFuzzyProbe) {
          fuzzyItems = await query<SuggestItem>(
            `${selectList}${fromFts}
             WHERE ${activeFilterFts}
               AND items_fts MATCH ?
             ORDER BY bm25(items_fts), i.name ASC
             LIMIT ?`,
            [auth.businessId, ftsFuzzyProbe, Math.min(200, fuzzyCap * 8)]
          );
        } else {
          const fuzzyPattern = charSequencePattern(searchLower);
          fuzzyItems = await query<SuggestItem>(
            `${selectClause}
             WHERE ${activeFilter}
               AND (LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.variant_name, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ?)
             LIMIT ?`,
            [auth.businessId, fuzzyPattern, fuzzyPattern, fuzzyPattern, fuzzyCap]
          );
        }

        // Score fuzzy results by similarity and add best ones
        const scored = fuzzyItems
          .filter(fi => !existingIds.has(fi.id))
          .map(fi => ({
            item: fi,
            score: scoreItemTextMatch(searchLower, {
              name: fi.name,
              variantName: fi.variant_name,
              parentName: fi.parent_name,
            }),
          }))
          .filter(s => s.score > 0.25) // Minimum similarity threshold
          .sort((a, b) => b.score - a.score)
          .slice(0, fuzzyLimit);

        for (const { item } of scored) {
          items.push(item);
          existingIds.add(item.id);
        }
      } else {
        let fuzzyItems: SuggestItem[];

        if (ftsFuzzyProbe) {
          fuzzyItems = await query<SuggestItem>(
            `${selectList}${fromFts}
             WHERE ${activeFilterFts}
               AND items_fts MATCH ?
             ORDER BY bm25(items_fts), i.name ASC
             LIMIT ?`,
            [auth.businessId, ftsFuzzyProbe, Math.min(200, fuzzyCap * 8)]
          );
        } else {
          const fuzzyConditions = searchWords
            .map(() => `(LOWER(i.name) LIKE ? OR LOWER(i.variant_name) LIKE ? OR LOWER(p.name) LIKE ?)`)
            .join(' OR ');

          const fuzzyParams: string[] = [];
          for (const word of searchWords) {
            const pattern = charSequencePattern(word);
            fuzzyParams.push(pattern, pattern, pattern);
          }

          fuzzyItems = await query<SuggestItem>(
            `${selectClause}
             WHERE ${activeFilter}
               AND (${fuzzyConditions})
             LIMIT ?`,
            [auth.businessId, ...fuzzyParams, fuzzyCap]
          );
        }

        const scored = fuzzyItems
          .filter(fi => !existingIds.has(fi.id))
          .map(fi => ({
            item: fi,
            score: scoreCombinedTextMatch(searchLower, [
              fi.name,
              fi.variant_name,
              fi.parent_name,
            ]),
          }))
          .filter(s => s.score > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, fuzzyLimit);

        for (const { item } of scored) {
          items.push(item);
          existingIds.add(item.id);
        }
      }
    }

    // Enrich with FIFO batch_number for POS display
    if (items.length > 0) {
      const itemIds = items.map((i) => i.id);
      const batchRows = await query<{ item_id: string; batch_number: string }>(
        `SELECT item_id, batch_number FROM inventory_batches
         WHERE item_id IN (${itemIds.map(() => '?').join(',')})
           AND quantity_remaining > 0 AND status = 'active'
         ORDER BY received_at ASC`,
        itemIds
      );
      const batchByItem = new Map<string, string>();
      for (const row of batchRows) {
        if (!batchByItem.has(row.item_id)) batchByItem.set(row.item_id, row.batch_number);
      }
      items = items.map((i) => ({
        ...i,
        batch_number: batchByItem.get(i.id) ?? null,
      }));
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
