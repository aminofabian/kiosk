import type { Item } from '@/lib/db/types';

export type ItemWithParentName = Item & { parent_name?: string | null };

export interface ItemParentGroup {
  id: string;
  label: string;
  isVariantGroup: boolean;
  items: ItemWithParentName[];
}

export function groupItemsByParent(items: ItemWithParentName[]): ItemParentGroup[] {
  const groupMap = new Map<string, ItemParentGroup>();

  for (const item of items) {
    if (item.parent_item_id) {
      const id = item.parent_item_id;
      let group = groupMap.get(id);
      if (!group) {
        group = {
          id,
          label: item.parent_name?.trim() || item.name,
          isVariantGroup: true,
          items: [],
        };
        groupMap.set(id, group);
      }
      group.items.push(item);
    } else {
      groupMap.set(`standalone:${item.id}`, {
        id: item.id,
        label: item.name,
        isVariantGroup: false,
        items: [item],
      });
    }
  }

  for (const group of groupMap.values()) {
    group.items.sort((a, b) =>
      (a.variant_name || a.name).localeCompare(b.variant_name || b.name, undefined, {
        sensitivity: 'base',
      }),
    );
  }

  return [...groupMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}

export function formatSellableItemName(item: ItemWithParentName): string {
  if (!item.parent_item_id) {
    return item.name;
  }

  const parent = item.parent_name?.trim();
  const variant = item.variant_name?.trim() || item.name;

  if (parent && variant) {
    if (parent.toLowerCase() === variant.toLowerCase()) {
      return parent;
    }
    return `${parent} — ${variant}`;
  }

  return parent || variant;
}

/** Variant label only (e.g. when parent is shown in a group header). */
export function displayGroupedItemName(item: ItemWithParentName): string {
  if (item.parent_item_id) {
    return item.variant_name?.trim() || item.name;
  }
  return item.name;
}
