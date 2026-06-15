import { execute, query } from './index';

/**
 * Migration: sale_returns and sale_return_items for partial/full refunds.
 */
export async function migrateSaleReturns(): Promise<void> {
  const exists = await query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='sale_returns'"
  );
  if (exists.length > 0) {
    console.log('✓ sale_returns tables already exist');
    return;
  }

  console.log('🔄 Creating sale_returns tables...');

  await execute(`
    CREATE TABLE sale_returns (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      processed_by TEXT NOT NULL,
      shift_id TEXT,
      refund_method TEXT NOT NULL CHECK (refund_method IN ('cash', 'mpesa', 'wallet', 'credit_note')),
      total_refund_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      credit_account_id TEXT,
      mpesa_reference TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
      FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE SET NULL
    )
  `);

  await execute(`
    CREATE TABLE sale_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      sale_item_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      inventory_batch_id TEXT,
      quantity_returned REAL NOT NULL,
      refund_amount REAL NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
      FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE SET NULL
    )
  `);

  await execute(
    'CREATE INDEX IF NOT EXISTS idx_sale_returns_business ON sale_returns(business_id, created_at DESC)'
  );
  await execute(
    'CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id)'
  );
  await execute(
    'CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(return_id)'
  );
  await execute(
    'CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item ON sale_return_items(sale_item_id)'
  );

  console.log('✅ sale_returns tables created');
}
