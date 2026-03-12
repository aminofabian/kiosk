import { execute, query } from './index';
import { generateUUID } from '@/lib/utils/uuid';

/**
 * Migration: Create buying_prices table for cost price history.
 * Links buying/cost prices to suppliers - a product can have multiple buying prices (one per supplier).
 * Run via: POST /api/db/migrate or lib/db/migrate.ts
 */
export async function migrateBuyingPrices(): Promise<void> {
  console.log('🔄 Starting buying_prices migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='buying_prices'`
  );

  if (tableCheck.length > 0) {
    console.log('✅ buying_prices table already exists');
    return;
  }

  console.log('Creating buying_prices table...');

  await execute(`
    CREATE TABLE IF NOT EXISTS buying_prices (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      supplier_id TEXT,
      price REAL NOT NULL,
      effective_from INTEGER NOT NULL DEFAULT (unixepoch()),
      set_by TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await execute(
    `CREATE INDEX IF NOT EXISTS idx_buying_prices_item_supplier ON buying_prices(item_id, supplier_id)`
  );
  await execute(
    `CREATE INDEX IF NOT EXISTS idx_buying_prices_effective ON buying_prices(item_id, supplier_id, effective_from DESC)`
  );

  console.log('Backfilling buying_prices from supplier_products.default_cost_price...');

  const supplierProducts = await query<{
    id: string;
    supplier_id: string;
    item_id: string;
    default_cost_price: number | null;
    created_at: number;
  }>(
    `SELECT id, supplier_id, item_id, default_cost_price, created_at
     FROM supplier_products
     WHERE default_cost_price IS NOT NULL`
  );

  let backfilled = 0;
  for (const sp of supplierProducts) {
    if (sp.default_cost_price == null) continue;
    try {
      await execute(
        `INSERT INTO buying_prices (id, item_id, supplier_id, price, effective_from, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          generateUUID(),
          sp.item_id,
          sp.supplier_id,
          sp.default_cost_price,
          sp.created_at,
          sp.created_at,
        ]
      );
      backfilled++;
    } catch (err) {
      console.warn('Skipped backfill for supplier_product', sp.id, err);
    }
  }

  console.log(`✅ buying_prices migration completed (backfilled ${backfilled} records)`);
}
