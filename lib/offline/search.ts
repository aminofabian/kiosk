'use client';

import { getAllItems, getCategories } from './cache';
import type { Item } from '@/lib/db/types';

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

/**
 * Search cached items by name, variant_name, or barcode when offline.
 * Returns results in the same format as /api/items/suggest for UI compatibility.
 */
export async function searchItemsOffline(
  query: string,
  limit = 10
): Promise<SuggestItem[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 1) return [];

  const [items, categories] = await Promise.all([getAllItems(), getCategories()]);
  if (!items || items.length === 0) return [];

  const searchWords = q.split(/\s+/).filter((w) => w.length > 0);
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

  const matchesItem = (item: Item): boolean => {
    const name = (item.name || '').toLowerCase();
    const variant = (item.variant_name || '').toLowerCase();
    const barcode = (item.barcode || '').toLowerCase();
    const parentName = item.parent_item_id
      ? (parentByName.get(item.parent_item_id) || '').toLowerCase()
      : '';

    if (searchWords.length === 1) {
      const word = searchWords[0];
      return (
        name.includes(word) ||
        variant.includes(word) ||
        barcode.includes(word) ||
        parentName.includes(word)
      );
    }
    return searchWords.every(
      (word) =>
        name.includes(word) ||
        variant.includes(word) ||
        barcode.includes(word) ||
        parentName.includes(word)
    );
  };

  const scoreItem = (item: Item): number => {
    const name = (item.name || '').toLowerCase();
    const variant = (item.variant_name || '').toLowerCase();
    const barcode = (item.barcode || '').toLowerCase();
    const word = searchWords[0];

    if (barcode === q) return 100;
    if (name.startsWith(word)) return 90;
    if (variant.startsWith(word)) return 80;
    if (name.includes(word)) return 70;
    if (variant.includes(word)) return 60;
    return 50;
  };

  const sellable = items.filter((item) => {
    if (item.parent_item_id) return true;
    const hasVariants = items.some((i) => i.parent_item_id === item.id);
    return !hasVariants;
  });

  const matched = sellable.filter(matchesItem);
  matched.sort((a, b) => scoreItem(b) - scoreItem(a));

  return matched.slice(0, limit).map((item) => {
    const siblingCount = item.parent_item_id
      ? items.filter((i) => i.parent_item_id === item.parent_item_id).length
      : 0;
    return {
      id: item.id,
      name: item.name,
      variant_name: item.variant_name,
      current_sell_price: item.current_sell_price,
      unit_type: item.unit_type,
      category_name: categoryByName.get(item.category_id) || null,
      parent_item_id: item.parent_item_id,
      parent_name: item.parent_item_id
        ? parentByName.get(item.parent_item_id) || null
        : null,
      sibling_count: siblingCount,
    };
  });
}
