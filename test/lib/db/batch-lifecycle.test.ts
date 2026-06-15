import { describe, it, expect, vi } from 'vitest';
import {
  batchStatusWhenEmptySql,
  batchStatusWhenRestockedSql,
  deactivateZeroOrNegativeBatches,
  EMPTY_BATCH_STATUS,
} from '@/lib/db/batch-lifecycle';
import type { Transaction } from '@/lib/db';

describe('batch-lifecycle', () => {
  it('uses deactivated status when quantity is empty', () => {
    expect(batchStatusWhenEmptySql('quantity_remaining - ?')).toContain(EMPTY_BATCH_STATUS);
    expect(batchStatusWhenRestockedSql()).toContain('depleted');
    expect(batchStatusWhenRestockedSql()).toContain(EMPTY_BATCH_STATUS);
  });

  it('deactivates zero and negative batches', async () => {
    const tx = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 2 }),
    } as unknown as Transaction;

    const count = await deactivateZeroOrNegativeBatches(tx, 'biz-1');
    expect(count).toBe(2);
    expect(tx.execute).toHaveBeenCalledWith(
      expect.stringContaining(`status = '${EMPTY_BATCH_STATUS}'`),
      ['biz-1']
    );
    expect(tx.execute).toHaveBeenCalledWith(
      expect.stringContaining('quantity_remaining <= 0'),
      ['biz-1']
    );
  });
});
