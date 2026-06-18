export const BARCODE_EXEMPT_REASONS = [
  {
    id: 'fresh_produce',
    emoji: '🥬',
    title: 'Fresh produce',
    description: 'Hand-picked — changes daily',
    stamp: 'Fresh pick',
  },
  {
    id: 'sold_by_weight',
    emoji: '⚖️',
    title: 'Sold by weight',
    description: 'Weighed at the counter',
    stamp: 'By weight',
  },
  {
    id: 'bulk_loose',
    emoji: '🧺',
    title: 'Bulk / loose',
    description: 'Scooped, poured, or bagged fresh',
    stamp: 'Bulk item',
  },
  {
    id: 'cut_to_order',
    emoji: '✂️',
    title: 'Cut to order',
    description: 'Sliced or trimmed on request',
    stamp: 'Cut to order',
  },
  {
    id: 'price_label',
    emoji: '🏷️',
    title: 'Shelf label only',
    description: 'Price sticker is enough',
    stamp: 'Label only',
  },
  {
    id: 'service',
    emoji: '🛠️',
    title: 'Service / fee',
    description: 'Not a physical SKU',
    stamp: 'Service item',
  },
  {
    id: 'other',
    emoji: '✨',
    title: 'Other',
    description: "Just doesn't need a barcode",
    stamp: 'Scan-free',
  },
] as const;

export type BarcodeExemptReasonId = (typeof BARCODE_EXEMPT_REASONS)[number]['id'];

export function getBarcodeExemptReason(id: string | null | undefined) {
  return BARCODE_EXEMPT_REASONS.find((r) => r.id === id);
}
