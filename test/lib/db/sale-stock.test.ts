import { describe, it, expect, vi } from 'vitest';
import {
  deductBatchStockAtomic,
  InsufficientBatchStockError,
  allocateBatchesForSale,
  getBatchesForSaleInTx,
} from '@/lib/db/sale-stock';
import type { Transaction } from '@/lib/db';

function mockTx(rowsAffected: number): Transaction {
  return {
    execute: vi.fn().mockResolvedValue({ rowsAffected }),
    query: vi.fn(),
    queryOne: vi.fn(),
  };
}

describe('deductBatchStockAtomic', () => {
  it('succeeds when batch has enough stock', async () => {
    const tx = mockTx(1);
    await expect(deductBatchStockAtomic(tx, 'batch-1', 2)).resolves.toBeUndefined();
    expect(tx.execute).toHaveBeenCalledWith(
      expect.stringContaining('quantity_remaining >= ?'),
      [2, 2, 'batch-1', 2]
    );
  });

  it('throws when batch stock is insufficient', async () => {
    const tx = mockTx(0);
    await expect(deductBatchStockAtomic(tx, 'batch-1', 5)).rejects.toBeInstanceOf(
      InsufficientBatchStockError
    );
  });
});

describe('allocateBatchesForSale', () => {
  it('uses preferred batch first then FIFO spillover', async () => {
    const tx = {
      execute: vi.fn(),
      query: vi.fn().mockResolvedValue([
        { id: 'batch-a', quantity_remaining: 3, buy_price_per_unit: 10, item_id: 'item-1' },
        { id: 'batch-b', quantity_remaining: 10, buy_price_per_unit: 12, item_id: 'item-1' },
      ]),
      queryOne: vi.fn().mockResolvedValue({
        id: 'batch-pref',
        quantity_remaining: 2,
        buy_price_per_unit: 8,
        item_id: 'item-1',
      }),
    } as unknown as Transaction;

    const result = await allocateBatchesForSale(
      tx,
      'item-1',
      'biz-1',
      5,
      1_700_000_000,
      'batch-pref'
    );

    expect(result).toEqual([
      { batchId: 'batch-pref', quantity: 2, buyPrice: 8 },
      { batchId: 'batch-a', quantity: 3, buyPrice: 10 },
    ]);
  });

  it('FIFO only when no preferred batch', async () => {
    const tx = {
      execute: vi.fn(),
      query: vi.fn().mockResolvedValue([
        { id: 'batch-a', quantity_remaining: 4, buy_price_per_unit: 10, item_id: 'item-1' },
      ]),
      queryOne: vi.fn(),
    } as unknown as Transaction;

    const result = await getBatchesForSaleInTx(tx, 'item-1', 3, 1_700_000_000);
    expect(result).toEqual([{ batchId: 'batch-a', quantity: 3, buyPrice: 10 }]);
  });
});
