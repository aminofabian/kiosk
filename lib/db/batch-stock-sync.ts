import type { Transaction } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { deductBatchStockAtomic } from '@/lib/db/sale-stock';
import {
  deactivateZeroOrNegativeBatches,
  EMPTY_BATCH_STATUS,
} from '@/lib/db/batch-lifecycle';

interface BatchRow {
  id: string;
  quantity_remaining: number;
  buy_price_per_unit: number;
}

/**
 * Keep batch totals aligned when item.current_stock is adjusted directly.
 * Positive difference adds to the newest active batch (or creates an adjustment batch).
 * Negative difference drains oldest active batches first (FIFO).
 */
export async function applyStockAdjustmentToBatches(
  tx: Transaction,
  itemId: string,
  businessId: string,
  difference: number,
  now: number
): Promise<void> {
  if (Math.abs(difference) < 0.0001) {
    return;
  }

  if (difference > 0) {
    const latestBatch = await tx.queryOne<{ id: string }>(
      `SELECT id FROM inventory_batches
       WHERE item_id = ? AND business_id = ? AND status = 'active'
       ORDER BY received_at DESC
       LIMIT 1`,
      [itemId, businessId]
    );

    if (latestBatch) {
      await tx.execute(
        `UPDATE inventory_batches
         SET quantity_remaining = quantity_remaining + ?,
             initial_quantity = initial_quantity + ?,
             status = CASE
               WHEN status = '${EMPTY_BATCH_STATUS}' AND (quantity_remaining + ?) > 0 THEN 'active'
               ELSE status
             END
         WHERE id = ?`,
        [difference, difference, difference, latestBatch.id]
      );
      return;
    }

    const recentCost = await tx.queryOne<{ buy_price_per_unit: number }>(
      `SELECT buy_price_per_unit FROM inventory_batches
       WHERE item_id = ? AND business_id = ?
       ORDER BY received_at DESC LIMIT 1`,
      [itemId, businessId]
    );

    const batchId = generateUUID();
    const batchNumber = `ADJ-${new Date(now * 1000).toISOString().slice(0, 10).replace(/-/g, '')}`;
    await tx.execute(
      `INSERT INTO inventory_batches (
        id, business_id, item_id, source_breakdown_id, batch_number, status,
        supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
        received_at, created_at
      ) VALUES (?, ?, ?, NULL, ?, 'active', NULL, ?, ?, ?, ?, ?)`,
      [
        batchId,
        businessId,
        itemId,
        batchNumber,
        difference,
        difference,
        recentCost?.buy_price_per_unit ?? 0,
        now,
        now,
      ]
    );
    return;
  }

  let remaining = Math.abs(difference);
  const batches = await tx.query<BatchRow>(
    `SELECT id, quantity_remaining, buy_price_per_unit
     FROM inventory_batches
     WHERE item_id = ? AND business_id = ? AND quantity_remaining > 0 AND status = 'active'
     ORDER BY received_at ASC`,
    [itemId, businessId]
  );

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity_remaining, remaining);
    await deductBatchStockAtomic(tx, batch.id, take);
    remaining -= take;
  }
}

/**
 * Reconcile batch quantities so their sum matches items.current_stock.
 */
export async function reconcileItemBatchesFromStock(
  tx: Transaction,
  itemId: string,
  businessId: string,
  now: number
): Promise<{ batchSumBefore: number; itemStock: number; difference: number }> {
  const item = await tx.queryOne<{ current_stock: number }>(
    `SELECT current_stock FROM items WHERE id = ? AND business_id = ?`,
    [itemId, businessId]
  );
  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  const sumRow = await tx.queryOne<{ batch_sum: number }>(
    `SELECT COALESCE(SUM(quantity_remaining), 0) AS batch_sum
     FROM inventory_batches
     WHERE item_id = ? AND business_id = ? AND status = 'active'`,
    [itemId, businessId]
  );

  const batchSumBefore = sumRow?.batch_sum ?? 0;
  const difference = item.current_stock - batchSumBefore;

  await applyStockAdjustmentToBatches(tx, itemId, businessId, difference, now);
  await deactivateZeroOrNegativeBatches(tx, businessId, itemId);

  return { batchSumBefore, itemStock: item.current_stock, difference };
}
