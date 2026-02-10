import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

// Lightweight search endpoint for autocomplete suggestions
// Returns only essential fields: id, name, variant_name, current_sell_price, unit_type
// Optimized for speed with minimal data transfer

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SuggestItem {
  id: string;
  name: string;
  variant_name: string | null;
  current_sell_price: number;
  unit_type: string;
  parent_item_id: string | null;
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
      parseInt(request.nextUrl.searchParams.get('limit') || '8'),
      20
    );

    if (!q || q.length < 1) {
      return jsonResponse({ success: true, data: [] });
    }

    const searchLower = q.toLowerCase();
    const searchWords = searchLower.split(/\s+/).filter((w) => w.length > 0);

    let items: SuggestItem[];

    if (searchWords.length <= 1) {
      // Single word - fast LIKE query
      const contains = `%${searchLower}%`;
      const starts = `${searchLower}%`;

      items = await query<SuggestItem>(
        `SELECT id, name, variant_name, current_sell_price, unit_type, parent_item_id
         FROM items
         WHERE business_id = ? AND active = 1
           AND (
             parent_item_id IS NOT NULL
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = items.id AND v.active = 1)
           )
           AND (LOWER(name) LIKE ? OR LOWER(variant_name) LIKE ?)
         ORDER BY
           CASE
             WHEN LOWER(name) LIKE ? THEN 1
             WHEN LOWER(variant_name) LIKE ? THEN 2
             WHEN LOWER(name) LIKE ? THEN 3
             ELSE 4
           END,
           name ASC
         LIMIT ?`,
        [auth.businessId, contains, contains, starts, starts, contains, limit]
      );
    } else {
      // Multi-word - match ALL words in any order
      const wordConditions = searchWords
        .map(() => `(LOWER(name) LIKE ? OR LOWER(variant_name) LIKE ?)`)
        .join(' AND ');

      const wordParams: string[] = [];
      for (const word of searchWords) {
        wordParams.push(`%${word}%`, `%${word}%`);
      }

      const exactPhrase = `%${searchLower}%`;
      const firstWordStarts = `${searchWords[0]}%`;

      items = await query<SuggestItem>(
        `SELECT id, name, variant_name, current_sell_price, unit_type, parent_item_id
         FROM items
         WHERE business_id = ? AND active = 1
           AND (
             parent_item_id IS NOT NULL
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = items.id AND v.active = 1)
           )
           AND (${wordConditions})
         ORDER BY
           CASE
             WHEN LOWER(name) LIKE ? THEN 1
             WHEN LOWER(name) LIKE ? THEN 2
             WHEN LOWER(variant_name) LIKE ? THEN 3
             ELSE 4
           END,
           name ASC
         LIMIT ?`,
        [auth.businessId, ...wordParams, exactPhrase, firstWordStarts, exactPhrase, limit]
      );
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
