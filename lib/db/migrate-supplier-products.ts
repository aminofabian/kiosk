import { execute, query } from './index';

export async function migrateSupplierProducts(): Promise<void> {
  console.log('🔄 Starting supplier_products migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_products'`
  );

  if (tableCheck.length > 0) {
    console.log('✅ supplier_products table already exists');
    return;
  }

  console.log('Creating supplier_products table...');

  await execute(`
    CREATE TABLE IF NOT EXISTS supplier_products (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      default_cost_price REAL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      UNIQUE(supplier_id, item_id)
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_products_item_id ON supplier_products(item_id)`);

  console.log('✅ supplier_products migration completed');
}
