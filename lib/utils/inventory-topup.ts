/**
 * Reorder top-up quantity from par level (expected stock), current stock, and minimum.
 * Not persisted — derived at read/render time.
 */
export function computeTopup(
  currentStock: number,
  minStock: number | null | undefined,
  expectedStock: number | null | undefined,
): number {
  if (minStock == null || currentStock > minStock) {
    return 0;
  }
  if (expectedStock == null) {
    return 0;
  }
  return Math.max(0, expectedStock - currentStock);
}

export function formatTopupDisplay(
  topup: number,
  formatQty: (value: number) => string,
): string {
  if (topup <= 0) return '—';
  return formatQty(topup);
}
