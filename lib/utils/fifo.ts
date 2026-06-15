import { query } from '@/lib/db';
import type { InventoryBatch } from '@/lib/db/types';

export interface BatchConsumption {
  batchId: string;
  quantity: number;
  buyPrice: number;
}

/**
 * FIFO (First In, First Out) batch selection for stock deduction
 * Selects batches in order of oldest received_at first
 */
export async function getBatchesForSale(
  itemId: string,
  quantityToSell: number
): Promise<BatchConsumption[]> {
  const now = Math.floor(Date.now() / 1000);

  // Get all active, non-expired batches with remaining stock, ordered by received_at (FIFO)
  const batches = await query<InventoryBatch>(
    `SELECT * FROM inventory_batches 
     WHERE item_id = ? AND quantity_remaining > 0 AND status = 'active'
     AND (expiry_date IS NULL OR expiry_date >= ?)
     ORDER BY received_at ASC`,
    [itemId, now]
  );

  const result: BatchConsumption[] = [];
  let remaining = quantityToSell;

  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }

    // Take as much as possible from this batch
    const deduct = Math.min(batch.quantity_remaining, remaining);

    result.push({
      batchId: batch.id,
      quantity: deduct,
      buyPrice: batch.buy_price_per_unit,
    });

    remaining -= deduct;
  }

  // Note: If remaining > 0, we don't have enough stock
  // For groceries, we allow negative stock (flexible approach)
  // The caller should handle this case

  return result;
}

/**
 * Calculate profit for a sale item
 */
export function calculateProfit(
  sellPrice: number,
  buyPrice: number,
  quantity: number
): number {
  return (sellPrice - buyPrice) * quantity;
}

