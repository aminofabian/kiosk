import { execute, query } from './index';

/**
 * Standalone migration: Make source_breakdown_id nullable in inventory_batches
 * SQLite doesn't support ALTER COLUMN, so we recreate the table
 */
export async function migrateInventoryBatchesNullable() {
  try {
    console.log('🔄 Starting inventory_batches migration...');

    // Check if table exists
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_batches'"
    );
    
    if (tableInfo.length === 0) {
      console.log('⚠ inventory_batches table does not exist, skipping migration');
      return true;
    }

    const oldSql = tableInfo[0].sql || '';
    
    // Check if already nullable
    if (oldSql.includes('source_breakdown_id TEXT,') || 
        oldSql.includes('source_breakdown_id TEXT NULL') ||
        !oldSql.includes('source_breakdown_id TEXT NOT NULL')) {
      console.log('✓ inventory_batches.source_breakdown_id is already nullable');
      return true;
    }

    console.log('🔄 Migrating inventory_batches table to make source_breakdown_id nullable...');

    // Disable foreign keys temporarily
    await execute('PRAGMA foreign_keys = OFF');

    // Create new table with nullable source_breakdown_id
    await execute(`
      CREATE TABLE inventory_batches_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        source_breakdown_id TEXT,
        initial_quantity REAL NOT NULL,
        quantity_remaining REAL NOT NULL,
        buy_price_per_unit REAL NOT NULL,
        received_at INTEGER NOT NULL DEFAULT (unixepoch()),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (source_breakdown_id) REFERENCES purchase_breakdowns(id) ON DELETE RESTRICT
      )
    `);

    // Copy data from old table
    await execute(`
      INSERT INTO inventory_batches_new 
      SELECT * FROM inventory_batches
    `);

    // Drop old table
    await execute('DROP TABLE inventory_batches');

    // Rename new table
    await execute('ALTER TABLE inventory_batches_new RENAME TO inventory_batches');

    // Recreate indexes
    await execute('CREATE INDEX IF NOT EXISTS idx_inventory_batches_business_id ON inventory_batches(business_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON inventory_batches(item_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_inventory_batches_received_at ON inventory_batches(item_id, received_at ASC)');

    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    console.log('✅ Successfully migrated inventory_batches table');
    return true;
  } catch (error) {
    console.error('❌ Error migrating inventory_batches:', error);
    // Re-enable foreign keys even on error
    try {
      await execute('PRAGMA foreign_keys = ON');
    } catch {
      // Ignore errors when re-enabling
    }
    throw error;
  }
}
