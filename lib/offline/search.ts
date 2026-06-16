'use client';

import { getAllItems, getCategories } from './cache';
import type { Item } from '@/lib/db/types';
import { scoreItemTextMatch } from '@/lib/search/fuzzy-text';

export interface SuggestItem {
  id: string;
  name: string;
  variant_name: string | null;
  current_sell_price: number;
  unit_type: string;
  category_name: string | null;
  parent_item_id: string | null;
  parent_name: string | null;
  sibling_count: number;
}

interface SearchContext {
  items: Item[];
  parentByName: Map<string, string>;
  categoryByName: Map<string, string>;
}

const FUZZY_MATCH_THRESHOLD = 0.45;

async function buildSearchContext(): Promise<SearchContext | null> {
  const [items, categories] = await Promise.all([getAllItems(), getCategories()]);
  if (!items || items.length === 0) return null;

  const parentByName = new Map<string, string>();
  const categoryByName = new Map<string, string>();
  if (categories) {
    for (const c of categories) {
      categoryByName.set(c.id, c.name);
    }
  }
  for (const item of items) {
    if (!item.parent_item_id) {
      parentByName.set(item.id, item.name);
    }
  }

  return { items, parentByName, categoryByName };
}

function getSellableItems(items: Item[]): Item[] {
  return items.filter((item) => {
    if (item.parent_item_id) return true;
    const hasVariants = items.some((i) => i.parent_item_id === item.id);
    return !hasVariants;
  });
}

function itemSearchFields(item: Item, ctx: SearchContext) {
  const parentName = item.parent_item_id
    ? ctx.parentByName.get(item.parent_item_id) || null
    : null;
  return {
    name: item.name,
    variantName: item.variant_name,
    parentName,
    barcode: item.barcode || '',
  };
}

function matchesOfflineItem(
  item: Item,
  q: string,
  searchWords: string[],
  ctx: SearchContext,
): boolean {
  const { name, variantName, parentName, barcode } = itemSearchFields(item, ctx);
  const nameL = name.toLowerCase();
  const variantL = (variantName || '').toLowerCase();
  const parentL = (parentName || '').toLowerCase();
  const barcodeL = barcode.toLowerCase();

  if (barcodeL && barcodeL === q) return true;

  if (searchWords.length === 1) {
    const word = searchWords[0];
    if (
      nameL.includes(word) ||
      variantL.includes(word) ||
      barcodeL.includes(word) ||
      parentL.includes(word)
    ) {
      return true;
    }
  } else {
    const allWordsMatch = searchWords.every(
      (word) =>
        nameL.includes(word) ||
        variantL.includes(word) ||
        barcodeL.includes(word) ||
        parentL.includes(word),
    );
    if (allWordsMatch) return true;
  }

  const fuzzyScore = scoreItemTextMatch(q, {
    name,
    variantName,
    parentName,
  });
  return fuzzyScore >= FUZZY_MATCH_THRESHOLD;
}

function scoreOfflineItem(item: Item, q: string, ctx: SearchContext): number {
  const { name, variantName, parentName, barcode } = itemSearchFields(item, ctx);
  const barcodeL = barcode.toLowerCase();

  if (barcodeL && barcodeL === q) return 100;

  const searchWords = q.split(/\s+/).filter((w) => w.length > 0);
  const word = searchWords[0] || q;
  const nameL = name.toLowerCase();
  const variantL = (variantName || '').toLowerCase();

  if (nameL.startsWith(word)) return 90;
  if (variantL.startsWith(word)) return 80;
  if (nameL.includes(word)) return 70;
  if (variantL.includes(word)) return 60;

  const fuzzyScore = scoreItemTextMatch(q, {
    name,
    variantName,
    parentName,
  });
  return 50 + fuzzyScore * 40;
}

function toSuggestItem(item: Item, ctx: SearchContext): SuggestItem {
  const siblingCount = item.parent_item_id
    ? ctx.items.filter((i) => i.parent_item_id === item.parent_item_id).length
    : 0;
  return {
    id: item.id,
    name: item.name,
    variant_name: item.variant_name,
    current_sell_price: item.current_sell_price,
    unit_type: item.unit_type,
    category_name: ctx.categoryByName.get(item.category_id) || null,
    parent_item_id: item.parent_item_id,
    parent_name: item.parent_item_id
      ? ctx.parentByName.get(item.parent_item_id) || null
      : null,
    sibling_count: siblingCount,
  };
}

async function searchCachedItems(
  query: string,
  limit: number,
): Promise<{ ctx: SearchContext; matched: Item[] } | null> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 1) return null;

  const ctx = await buildSearchContext();
  if (!ctx) return null;

  const searchWords = q.split(/\s+/).filter((w) => w.length > 0);
  const sellable = getSellableItems(ctx.items);
  const matched = sellable.filter((item) =>
    matchesOfflineItem(item, q, searchWords, ctx),
  );
  matched.sort((a, b) => scoreOfflineItem(b, q, ctx) - scoreOfflineItem(a, q, ctx));

  return { ctx, matched: matched.slice(0, limit) };
}

/**
 * Search cached items by name, variant, barcode, or fuzzy match when offline.
 * Returns results in the same format as /api/items/suggest for UI compatibility.
 */
export async function searchItemsOffline(
  query: string,
  limit = 10,
): Promise<SuggestItem[]> {
  const result = await searchCachedItems(query, limit);
  if (!result) return [];
  return result.matched.map((item) => toSuggestItem(item, result.ctx));
}

/**
 * Full Item[] search over the offline cache for the POS product grid.
 */
export async function searchItemsGridOffline(
  query: string,
  limit = 50,
): Promise<Item[]> {
  const result = await searchCachedItems(query, limit);
  if (!result) return [];
  return result.matched;
}
