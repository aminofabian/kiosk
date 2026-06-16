import type { PosSearchSuggestion } from "@/lib/hooks/use-pos-search";

export type PosSuggestionGroup =
  | { type: "standalone"; item: PosSearchSuggestion }
  | {
      type: "variant-group";
      parentId: string;
      parentName: string;
      items: PosSearchSuggestion[];
    };

export interface GroupedPosSuggestions {
  groups: PosSuggestionGroup[];
  flatItems: PosSearchSuggestion[];
}

/** Group variant siblings under a parent header for the suggestions dropdown. */
export function groupPosSearchSuggestions(
  searchSuggestions: PosSearchSuggestion[],
): GroupedPosSuggestions {
  if (searchSuggestions.length === 0) {
    return { groups: [], flatItems: [] };
  }

  const parentBuckets = new Map<string, PosSearchSuggestion[]>();
  const standalone: PosSearchSuggestion[] = [];

  for (const s of searchSuggestions) {
    if (
      s.parent_item_id &&
      s.parent_name &&
      s.sibling_count &&
      s.sibling_count > 1
    ) {
      if (!parentBuckets.has(s.parent_item_id)) {
        parentBuckets.set(s.parent_item_id, []);
      }
      parentBuckets.get(s.parent_item_id)!.push(s);
    } else {
      standalone.push(s);
    }
  }

  const groups: PosSuggestionGroup[] = [];

  for (const [parentId, items] of parentBuckets) {
    if (items.length > 1) {
      groups.push({
        type: "variant-group",
        parentId,
        parentName: items[0].parent_name!,
        items,
      });
    } else {
      standalone.push(items[0]);
    }
  }

  for (const item of standalone) {
    groups.push({ type: "standalone", item });
  }

  const flatItems: PosSearchSuggestion[] = [];
  for (const g of groups) {
    if (g.type === "variant-group") {
      for (const item of g.items) flatItems.push(item);
    } else {
      flatItems.push(g.item);
    }
  }

  return { groups, flatItems };
}
