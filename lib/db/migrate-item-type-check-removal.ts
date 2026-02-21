import { execute, query } from './index';

/**
 * Migration: Remove CHECK constraints from items.item_type and sale_items.item_type_snapshot
 * so that product types can be configured in admin settings (e.g. add "cereals").
 * SQLite does not support DROP CONSTRAINT, so we recreate the tables without the CHECK.
 */
export async function migrateItemTypeCheckRemoval(): Promise<void> {
  console.log('🔄 Removing item_type CHECK constraints...');

  const tablesExist = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'sale_items')`
  );
  if (tablesExist.length < 2) {
    console.log('⚠ items or sale_items table missing, skipping');
    return;
  }

  await execute(`PRAGMA foreign_keys = OFF`);

  try {
    // --- items: recreate without item_type CHECK ---
    const itemsNewExists = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='items_new'`
    );
    if (itemsNewExists.length > 0) {
      await execute(`DROP TABLE items_new`);
    }
    const itemsTableInfo = await query<{ name: string }>(`PRAGMA table_info(items)`);
    const colCount = itemsTableInfo.length;
    if (colCount !== 21) {
      console.log(`⚠ items has ${colCount} columns; item_type CHECK removal expects 21. Skipping items recreation.`);
    } else {
      await execute(`
        CREATE TABLE items_new (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          parent_item_id TEXT,
          name TEXT NOT NULL,
          variant_name TEXT,
          unit_type TEXT NOT NULL CHECK (unit_type IN ('kg', 'g', 'piece', 'bunch', 'tray', 'litre', 'ml')),
          item_type TEXT NOT NULL DEFAULT 'retail',
          current_stock REAL NOT NULL DEFAULT 0,
          min_stock_level REAL,
          current_sell_price REAL NOT NULL DEFAULT 0,
          image_url TEXT,
          packaging_unit_name TEXT,
          packaging_unit_qty REAL,
          active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          barcode TEXT,
          expiry_date INTEGER,
          bundle_quantity REAL,
          bundle_price REAL,
          bundle_name TEXT,
          FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
          FOREIGN KEY (parent_item_id) REFERENCES items(id) ON DELETE CASCADE
        )
      `);
      await execute(`
        INSERT INTO items_new (
          id, business_id, category_id, parent_item_id, name, variant_name,
          unit_type, item_type, current_stock, min_stock_level, current_sell_price,
          image_url, packaging_unit_name, packaging_unit_qty, active, created_at,
          barcode, expiry_date, bundle_quantity, bundle_price, bundle_name
        ) SELECT
          id, business_id, category_id, parent_item_id, name, variant_name,
          unit_type, item_type,
          COALESCE(current_stock, 0), min_stock_level, COALESCE(current_sell_price, 0),
          image_url, packaging_unit_name, packaging_unit_qty,
          COALESCE(active, 1), COALESCE(created_at, unixepoch()),
          barcode, expiry_date, bundle_quantity, bundle_price, bundle_name
        FROM items
      `);
      await execute(`PRAGMA foreign_keys = OFF`);
      await execute(`DROP TABLE items`);
      await execute(`ALTER TABLE items_new RENAME TO items`);
      await execute(`PRAGMA foreign_keys = ON`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_items_business_id ON items(business_id)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_items_active ON items(business_id, active)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_item_id)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(business_id, item_type)`);
      console.log('✅ items: CHECK removed from item_type');
    }

    // --- sale_items: recreate without item_type_snapshot CHECK ---
    const saleItemsNewExists = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items_new'`
    );
    if (saleItemsNewExists.length > 0) {
      await execute(`PRAGMA foreign_keys = OFF`);
      await execute(`DROP TABLE sale_items_new`);
      await execute(`PRAGMA foreign_keys = ON`);
    }
    {
      await execute(`
        CREATE TABLE sale_items_new (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          inventory_batch_id TEXT,
          quantity_sold REAL NOT NULL,
          sell_price_per_unit REAL NOT NULL,
          buy_price_per_unit REAL NOT NULL,
          profit REAL NOT NULL,
          item_type_snapshot TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
          FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE SET NULL
        )
      `);
      await execute(`
        INSERT INTO sale_items_new (
          id, sale_id, item_id, inventory_batch_id, quantity_sold,
          sell_price_per_unit, buy_price_per_unit, profit, item_type_snapshot, created_at
        ) SELECT
          id, sale_id, item_id, inventory_batch_id, quantity_sold,
          sell_price_per_unit, buy_price_per_unit, profit, item_type_snapshot,
          COALESCE(created_at, unixepoch())
        FROM sale_items
      `);
      await execute(`PRAGMA foreign_keys = OFF`);
      await execute(`DROP TABLE sale_items`);
      await execute(`ALTER TABLE sale_items_new RENAME TO sale_items`);
      await execute(`PRAGMA foreign_keys = ON`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON sale_items(inventory_batch_id)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_sale_items_type ON sale_items(item_type_snapshot)`);
      console.log('✅ sale_items: CHECK removed from item_type_snapshot');
    }
  } finally {
    await execute(`PRAGMA foreign_keys = ON`);
  }
}
