import type { Item } from "@/lib/db/types";

export interface ItemWithVariants extends Item {
  isParent?: boolean;
  variantCount?: number;
  variants?: Item[];
  parentName?: string;
}

export interface GroupedItem {
  type: "parent" | "standalone";
  parent?: Item;
  children?: Item[];
  item?: Item;
}

/** Group sellable items by parent for category / drawer views. */
export function groupItemsByParent(allItems: Item[]): GroupedItem[] {
  const parentIds = new Set<string>();
  const parentItems = new Map<string, Item>();

  for (const item of allItems) {
    if (!item.parent_item_id) {
      parentItems.set(item.id, item);
    }
  }

  for (const item of allItems) {
    if (item.parent_item_id) {
      parentIds.add(item.parent_item_id);
    }
  }

  const grouped: GroupedItem[] = [];
  const childrenByParent = new Map<string, Item[]>();
  const standaloneItems: Item[] = [];

  for (const item of allItems) {
    if (item.parent_item_id) {
      if (!childrenByParent.has(item.parent_item_id)) {
        childrenByParent.set(item.parent_item_id, []);
      }
      childrenByParent.get(item.parent_item_id)!.push(item);
    } else if (!parentIds.has(item.id)) {
      standaloneItems.push(item);
    }
  }

  for (const [parentId, children] of childrenByParent.entries()) {
    const parent = parentItems.get(parentId);
    if (parent) {
      grouped.push({
        type: "parent",
        parent,
        children: children.sort((a, b) =>
          (a.variant_name || a.name).localeCompare(b.variant_name || b.name),
        ),
      });
    }
  }

  for (const item of standaloneItems) {
    grouped.push({ type: "standalone", item });
  }

  grouped.sort((a, b) => {
    if (a.type === "parent" && b.type === "parent") {
      return (a.parent?.name || "").localeCompare(b.parent?.name || "");
    }
    if (a.type === "standalone" && b.type === "standalone") {
      return (a.item?.name || "").localeCompare(b.item?.name || "");
    }
    return a.type === "parent" ? -1 : 1;
  });

  return grouped;
}

export function flattenGroupedItems(grouped: GroupedItem[]): ItemWithVariants[] {
  const processed: ItemWithVariants[] = [];
  for (const group of grouped) {
    if (group.type === "parent" && group.children) {
      for (const child of group.children) {
        processed.push({ ...child, parentName: group.parent?.name });
      }
    } else if (group.type === "standalone" && group.item) {
      processed.push(group.item);
    }
  }
  return processed;
}

export function filterGroupedItems(
  grouped: GroupedItem[],
  query: string,
): GroupedItem[] {
  const q = query.toLowerCase();
  if (!q) return grouped;

  return grouped
    .filter((group) => {
      if (group.type === "parent") {
        const matchesParent = group.parent?.name.toLowerCase().includes(q);
        const matchesChildren = group.children?.some(
          (child) =>
            child.name.toLowerCase().includes(q) ||
            child.variant_name?.toLowerCase().includes(q),
        );
        return matchesParent || matchesChildren;
      }
      return group.item?.name.toLowerCase().includes(q);
    })
    .map((group) => {
      if (group.type === "parent" && group.children) {
        const filteredChildren = group.children.filter(
          (child) =>
            child.name.toLowerCase().includes(q) ||
            child.variant_name?.toLowerCase().includes(q) ||
            group.parent?.name.toLowerCase().includes(q),
        );
        return { ...group, children: filteredChildren };
      }
      return group;
    });
}
