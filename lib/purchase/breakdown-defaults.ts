import type { Item, PurchaseItem } from '@/lib/db/types';

export interface BreakdownDefaults {
  itemId: string;
  usableQuantity: number;
  wastageQuantity: number;
  buyPricePerUnit: number;
}

export function parseQuantityFromNote(quantityNote: string): number {
  const match = quantityNote.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const value = parseFloat(match[1]);
    if (value > 0) return value;
  }
  return 1;
}

export function resolveLinkedItem(
  purchaseItem: PurchaseItem & { item_name?: string },
  catalogItems: Item[],
): Item | null {
  if (purchaseItem.item_id) {
    return catalogItems.find((item) => item.id === purchaseItem.item_id) ?? null;
  }

  const snapshot = purchaseItem.item_name_snapshot.toLowerCase().trim();
  if (!snapshot) return null;

  const exact = catalogItems.find((item) => item.name.toLowerCase() === snapshot);
  if (exact) return exact;

  const startsWith = catalogItems.find(
    (item) =>
      item.name.toLowerCase().startsWith(snapshot) ||
      snapshot.startsWith(item.name.toLowerCase()),
  );
  if (startsWith) return startsWith;

  return (
    catalogItems.find(
      (item) =>
        item.name.toLowerCase().includes(snapshot) ||
        snapshot.includes(item.name.toLowerCase()),
    ) ?? null
  );
}

export function computeBreakdownDefaults(
  purchaseItem: PurchaseItem & { item_name?: string },
  catalogItems: Item[],
  supplierDefaultCost?: number | null,
): BreakdownDefaults | null {
  const linkedItem = resolveLinkedItem(purchaseItem, catalogItems);
  if (!linkedItem) return null;

  const amount = parseFloat(purchaseItem.amount.toString());
  const usableQuantity = parseQuantityFromNote(purchaseItem.quantity_note);
  const buyPricePerUnit =
    supplierDefaultCost != null && supplierDefaultCost > 0
      ? supplierDefaultCost
      : amount / usableQuantity;

  return {
    itemId: linkedItem.id,
    usableQuantity,
    wastageQuantity: 0,
    buyPricePerUnit: Number(buyPricePerUnit.toFixed(2)),
  };
}
