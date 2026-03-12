import { execute, query } from './index';
import { generateUUID } from '@/lib/utils/uuid';

export interface RecordBuyingPriceParams {
  itemId: string;
  supplierId?: string | null;
  price: number;
  setBy?: string | null;
  notes?: string | null;
  effectiveFrom?: number;
}

/**
 * Record a buying/cost price in the buying_prices history table.
 * Call this whenever a cost is set or used (supplier bill, purchase breakdown, item price update, supplier product link).
 * Fails silently if the buying_prices table does not exist (e.g. migration not yet run).
 */
export async function recordBuyingPrice(params: RecordBuyingPriceParams): Promise<void> {
  const { itemId, supplierId = null, price, setBy = null, notes = null, effectiveFrom } = params;
  const now = Math.floor(Date.now() / 1000);
  const effective = effectiveFrom ?? now;

  try {
    const tableCheck = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='buying_prices'`
    );
    if (tableCheck.length === 0) return;

    const id = generateUUID();
    await execute(
      `INSERT INTO buying_prices (id, item_id, supplier_id, price, effective_from, set_by, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, itemId, supplierId, price, effective, setBy, notes, now]
    );
  } catch (err) {
    console.warn('recordBuyingPrice: failed to record (non-fatal)', err);
  }
}
