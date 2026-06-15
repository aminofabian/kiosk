import type { Transaction } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { generateSupplierBatchNumber } from '@/lib/utils/batch-number';
import type { SupplierBillStockItem } from '@/lib/validation/supplier-bill';

export interface ReceiveStockParams {
  tx: Transaction;
  businessId: string;
  billId: string;
  supplierId: string | null;
  supplierName: string;
  billDescription: string;
  stockItems: SupplierBillStockItem[];
  userId: string;
  receivedAt: number;
  batchSeqStart: number;
}

export interface ReceiveStockResult {
  stockUpdated: number;
}

export async function receiveStockForSupplierBill(
  params: ReceiveStockParams
): Promise<ReceiveStockResult> {
  const {
    tx,
    businessId,
    billId,
    supplierId,
    supplierName,
    billDescription,
    stockItems,
    userId,
    receivedAt,
    batchSeqStart,
  } = params;

  let seq = batchSeqStart;
  let stockUpdated = 0;

  for (const stockItem of stockItems) {
    const item = await tx.queryOne<{ id: string; current_stock: number; name: string }>(
      `SELECT id, current_stock, name FROM items WHERE id = ? AND business_id = ?`,
      [stockItem.itemId, businessId]
    );
    if (!item) continue;

    const batchId = generateUUID();
    const batchNumber =
      stockItem.batchNumber?.trim() ||
      generateSupplierBatchNumber(supplierName || 'Supplier', seq, receivedAt);
    seq += 1;

    await tx.execute(
      `INSERT INTO inventory_batches (
        id, business_id, item_id, source_breakdown_id, supplier_bill_id, batch_number, status,
        supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
        received_at, expiry_date, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        businessId,
        stockItem.itemId,
        billId,
        batchNumber,
        supplierId,
        stockItem.quantity,
        stockItem.quantity,
        stockItem.costPricePerUnit,
        receivedAt,
        stockItem.expiryDate ?? null,
        receivedAt,
      ]
    );

    const systemStock = item.current_stock;
    const actualStock = systemStock + stockItem.quantity;

    await tx.execute(
      `UPDATE items SET current_stock = current_stock + ? WHERE id = ? AND business_id = ?`,
      [stockItem.quantity, stockItem.itemId, businessId]
    );

    const adjustmentId = generateUUID();
    await tx.execute(
      `INSERT INTO stock_adjustments (
        id, business_id, item_id, system_stock, actual_stock, difference,
        reason, notes, adjusted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'restock', ?, ?, ?)`,
      [
        adjustmentId,
        businessId,
        stockItem.itemId,
        systemStock,
        actualStock,
        stockItem.quantity,
        `Supplier bill receipt: ${billDescription.trim()}`,
        userId,
        receivedAt,
      ]
    );

    const buyingPriceId = generateUUID();
    await tx.execute(
      `INSERT INTO buying_prices (id, item_id, supplier_id, price, effective_from, set_by, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        buyingPriceId,
        stockItem.itemId,
        supplierId,
        stockItem.costPricePerUnit,
        receivedAt,
        userId,
        `Supplier bill: ${billDescription.trim()}`,
        receivedAt,
      ]
    );

    stockUpdated++;
  }

  return { stockUpdated };
}

export class SupplierBillCancelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupplierBillCancelError';
  }
}

export async function reverseStockForSupplierBill(
  tx: Transaction,
  businessId: string,
  billId: string,
  userId: string,
  now: number
): Promise<{ batchesReversed: number }> {
  const batches = await tx.query<{
    id: string;
    item_id: string;
    initial_quantity: number;
    quantity_remaining: number;
    batch_number: string | null;
  }>(
    `SELECT id, item_id, initial_quantity, quantity_remaining, batch_number
     FROM inventory_batches
     WHERE supplier_bill_id = ? AND business_id = ?`,
    [billId, businessId]
  );

  for (const batch of batches) {
    if (batch.quantity_remaining + 0.0001 < batch.initial_quantity) {
      const sold = batch.initial_quantity - batch.quantity_remaining;
      throw new SupplierBillCancelError(
        `Cannot cancel bill: ${sold} unit(s) from batch ${batch.batch_number ?? batch.id} have already been sold`
      );
    }
  }

  let batchesReversed = 0;
  for (const batch of batches) {
    if (batch.quantity_remaining <= 0) {
      await tx.execute(
        `UPDATE inventory_batches SET status = 'deactivated' WHERE id = ?`,
        [batch.id]
      );
      batchesReversed++;
      continue;
    }

    const item = await tx.queryOne<{ current_stock: number }>(
      `SELECT current_stock FROM items WHERE id = ? AND business_id = ?`,
      [batch.item_id, businessId]
    );
    if (!item) continue;

    const qty = batch.quantity_remaining;
    const systemStock = item.current_stock;
    const actualStock = systemStock - qty;

    await tx.execute(
      `UPDATE items SET current_stock = current_stock - ? WHERE id = ? AND business_id = ?`,
      [qty, batch.item_id, businessId]
    );

    await tx.execute(
      `UPDATE inventory_batches
       SET quantity_remaining = 0, status = 'deactivated'
       WHERE id = ?`,
      [batch.id]
    );

    const adjustmentId = generateUUID();
    await tx.execute(
      `INSERT INTO stock_adjustments (
        id, business_id, item_id, system_stock, actual_stock, difference,
        reason, notes, adjusted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'other', ?, ?, ?)`,
      [
        adjustmentId,
        businessId,
        batch.item_id,
        systemStock,
        actualStock,
        -qty,
        `Supplier bill cancelled: reversed batch ${batch.batch_number ?? batch.id}`,
        userId,
        now,
      ]
    );

    batchesReversed++;
  }

  return { batchesReversed };
}
