export type StockLevelStatus = 'out' | 'low' | 'ok';

/** Matches department stock screen: out, at/below min, or below 10 when no min. */
export function getStockLevelStatus(item: {
  current_stock: number;
  min_stock_level: number | null;
}): StockLevelStatus {
  if (item.current_stock <= 0) return 'out';
  if (item.min_stock_level != null) {
    if (item.current_stock <= item.min_stock_level) return 'low';
  } else if (item.current_stock < 10) {
    return 'low';
  }
  return 'ok';
}

export function isLowOrOutOfStock(item: {
  current_stock: number;
  min_stock_level: number | null;
}): boolean {
  const status = getStockLevelStatus(item);
  return status === 'out' || status === 'low';
}
