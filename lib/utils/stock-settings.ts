/** Stock-related flags stored in businesses.settings JSON under `stock`. */
export interface StockSettings {
  /** When true, cashiers may sell items with zero or insufficient stock without manager PIN. */
  allowSellOutOfStock?: boolean;
}

export function parseAllowSellOutOfStock(settingsJson: string | null | undefined): boolean {
  if (!settingsJson) return false;
  try {
    const parsed = JSON.parse(settingsJson) as Record<string, unknown>;
    const stock = parsed.stock;
    if (stock && typeof stock === 'object') {
      return (stock as StockSettings).allowSellOutOfStock === true;
    }
    return false;
  } catch {
    return false;
  }
}

export function mergeSettingsAllowSellOutOfStock(
  settingsJson: string | null,
  allowSellOutOfStock: boolean
): string {
  let obj: Record<string, unknown> = {};
  if (settingsJson) {
    try {
      obj = JSON.parse(settingsJson) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  const stock =
    obj.stock && typeof obj.stock === 'object'
      ? { ...(obj.stock as Record<string, unknown>) }
      : {};
  stock.allowSellOutOfStock = allowSellOutOfStock;
  obj.stock = stock;
  return JSON.stringify(obj);
}
