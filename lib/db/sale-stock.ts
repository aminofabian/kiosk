import type { Transaction } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { calculateProfit } from '@/lib/utils/fifo';
import {
  batchStatusWhenEmptySql,
  deactivateZeroOrNegativeBatches,
} from '@/lib/db/batch-lifecycle';

export class InsufficientBatchStockError extends Error {
  constructor(
    public readonly batchId: string,
    public readonly requested: number
  ) {
    super(`Insufficient stock in batch ${batchId} (requested ${requested})`);
    this.name = 'InsufficientBatchStockError';
  }
}

export class InsufficientItemStockError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly requested: number
  ) {
    super(`Insufficient stock for item ${itemId} (requested ${requested})`);
    this.name = 'InsufficientItemStockError';
  }
}

interface BatchRow {
  id: string;
  quantity_remaining: number;
  buy_price_per_unit: number;
  item_id: string;
}

/**
 * Atomically deduct stock from a batch. Fails if quantity_remaining would go negative.
 */
export async function deductBatchStockAtomic(
  tx: Transaction,
  batchId: string,
  quantity: number
): Promise<void> {
  const result = await tx.execute(
    `UPDATE inventory_batches
     SET quantity_remaining = quantity_remaining - ?,
         status = ${batchStatusWhenEmptySql('quantity_remaining - ?')}
     WHERE id = ? AND quantity_remaining >= ?`,
    [quantity, quantity, batchId, quantity]
  );
  if (result.rowsAffected === 0) {
    throw new InsufficientBatchStockError(batchId, quantity);
  }
}

/**
 * Deduct item-level stock. When allowNegative is false, fails if stock would go negative.
 */
export async function deductItemStockAtomic(
  tx: Transaction,
  itemId: string,
  businessId: string,
  quantity: number,
  allowNegative: boolean
): Promise<void> {
  const sql = allowNegative
    ? `UPDATE items SET current_stock = current_stock - ? WHERE id = ? AND business_id = ?`
    : `UPDATE items SET current_stock = current_stock - ? WHERE id = ? AND business_id = ? AND current_stock >= ?`;
  const params = allowNegative
    ? [quantity, itemId, businessId]
    : [quantity, itemId, businessId, quantity];
  const result = await tx.execute(sql, params);
  if (result.rowsAffected === 0) {
    throw new InsufficientItemStockError(itemId, quantity);
  }
}

export type BatchAllocation = { batchId: string; quantity: number; buyPrice: number };

/**
 * FIFO batch selection inside a transaction (non-expired, active batches only).
 */
export async function getBatchesForSaleInTx(
  tx: Transaction,
  itemId: string,
  quantityToSell: number,
  now: number,
  excludeBatchIds: string[] = []
): Promise<BatchAllocation[]> {
  const excludeSet = new Set(excludeBatchIds);
  const batches = await tx.query<BatchRow>(
    `SELECT id, quantity_remaining, buy_price_per_unit, item_id
     FROM inventory_batches
     WHERE item_id = ? AND quantity_remaining > 0 AND status = 'active'
     AND (expiry_date IS NULL OR expiry_date >= ?)
     ORDER BY received_at ASC`,
    [itemId, now]
  );

  const result: BatchAllocation[] = [];
  let remaining = quantityToSell;

  for (const batch of batches) {
    if (remaining <= 0) break;
    if (excludeSet.has(batch.id)) continue;
    const deduct = Math.min(batch.quantity_remaining, remaining);
    result.push({
      batchId: batch.id,
      quantity: deduct,
      buyPrice: batch.buy_price_per_unit,
    });
    remaining -= deduct;
  }

  return result;
}

/**
 * Allocate sale quantity across batches: optional preferred batch first, then FIFO spillover.
 */
export async function allocateBatchesForSale(
  tx: Transaction,
  itemId: string,
  businessId: string,
  quantityToSell: number,
  now: number,
  preferredBatchId?: string
): Promise<BatchAllocation[]> {
  const result: BatchAllocation[] = [];
  let remaining = quantityToSell;
  const usedBatchIds: string[] = [];

  if (preferredBatchId) {
    const selectedBatch = await tx.queryOne<BatchRow>(
      `SELECT id, quantity_remaining, buy_price_per_unit, item_id
       FROM inventory_batches
       WHERE id = ? AND business_id = ? AND item_id = ? AND status = 'active'
       AND (expiry_date IS NULL OR expiry_date >= ?)`,
      [preferredBatchId, businessId, itemId, now]
    );
    if (selectedBatch && selectedBatch.quantity_remaining > 0) {
      const take = Math.min(remaining, selectedBatch.quantity_remaining);
      result.push({
        batchId: selectedBatch.id,
        quantity: take,
        buyPrice: selectedBatch.buy_price_per_unit,
      });
      remaining -= take;
      usedBatchIds.push(selectedBatch.id);
    }
  }

  if (remaining > 0) {
    const fifo = await getBatchesForSaleInTx(tx, itemId, remaining, now, usedBatchIds);
    result.push(...fifo);
  }

  return result;
}

export interface SaleStockLineInput {
  itemId: string;
  quantity: number;
  price: number;
  inventoryBatchId?: string;
}

export interface ProcessSaleStockOptions {
  tx: Transaction;
  saleId: string;
  businessId: string;
  items: SaleStockLineInput[];
  now: number;
  allowNegativeStock: boolean;
}

/**
 * Process sale line stock deductions with atomic batch updates.
 */
export async function processSaleStockDeduction(
  options: ProcessSaleStockOptions
): Promise<void> {
  const { tx, saleId, businessId, items, now, allowNegativeStock } = options;

  for (const item of items) {
    const itemData = await tx.queryOne<{ item_type: string }>(
      'SELECT item_type FROM items WHERE id = ?',
      [item.itemId]
    );
    const itemTypeSnapshot = itemData?.item_type || 'retail';

    const batches = await allocateBatchesForSale(
      tx,
      item.itemId,
      businessId,
      item.quantity,
      now,
      item.inventoryBatchId
    );

    let remainingQuantity = item.quantity;

    if (batches.length > 0) {
      for (const batch of batches) {
        const saleItemId = generateUUID();
        const profit = calculateProfit(item.price, batch.buyPrice, batch.quantity);

        await tx.execute(
          `INSERT INTO sale_items (
            id, sale_id, item_id, inventory_batch_id, quantity_sold,
            sell_price_per_unit, buy_price_per_unit, profit, item_type_snapshot, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleItemId,
            saleId,
            item.itemId,
            batch.batchId,
            batch.quantity,
            item.price,
            batch.buyPrice,
            profit,
            itemTypeSnapshot,
            now,
          ]
        );

        await deductBatchStockAtomic(tx, batch.batchId, batch.quantity);
        remainingQuantity -= batch.quantity;
      }
    }

    if (remainingQuantity > 0) {
      const recentBatch = await tx.queryOne<{ buy_price_per_unit: number }>(
        `SELECT buy_price_per_unit
         FROM inventory_batches
         WHERE item_id = ?
         ORDER BY received_at DESC
         LIMIT 1`,
        [item.itemId]
      );

      let buyPrice = recentBatch?.buy_price_per_unit || 0;
      if (!buyPrice) {
        const recentBreakdown = await tx.queryOne<{ buy_price_per_unit: number }>(
          `SELECT pb.buy_price_per_unit
           FROM purchase_breakdowns pb
           JOIN purchase_items pi ON pb.purchase_item_id = pi.id
           JOIN purchases p ON pi.purchase_id = p.id
           WHERE pb.item_id = ? AND p.business_id = ?
           ORDER BY pb.confirmed_at DESC
           LIMIT 1`,
          [item.itemId, businessId]
        );
        buyPrice = recentBreakdown?.buy_price_per_unit || 0;
      }

      const saleItemId = generateUUID();
      const profit =
        buyPrice > 0 ? calculateProfit(item.price, buyPrice, remainingQuantity) : 0;

      await tx.execute(
        `INSERT INTO sale_items (
          id, sale_id, item_id, quantity_sold, sell_price_per_unit,
          buy_price_per_unit, profit, item_type_snapshot, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleItemId,
          saleId,
          item.itemId,
          remainingQuantity,
          item.price,
          buyPrice,
          profit,
          itemTypeSnapshot,
          now,
        ]
      );
    }

    await deductItemStockAtomic(
      tx,
      item.itemId,
      businessId,
      item.quantity,
      allowNegativeStock
    );

    await deactivateZeroOrNegativeBatches(tx, businessId, item.itemId);
  }
}
