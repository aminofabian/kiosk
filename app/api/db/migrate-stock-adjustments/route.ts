import { execute, query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST() {
  try {
    // Check if table exists
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_adjustments'"
    );
    
    if (tableInfo.length === 0) {
      return jsonResponse({
        success: false,
        message: 'stock_adjustments table does not exist',
      }, 400);
    }

    const oldSql = tableInfo[0].sql;
    if (oldSql && oldSql.includes("'restock'")) {
      return jsonResponse({
        success: true,
        message: 'stock_adjustments.reason already includes restock',
      });
    }

    console.log('🔄 Migrating stock_adjustments table to add restock reason...');

    // Disable foreign keys temporarily
    await execute('PRAGMA foreign_keys = OFF');

    // Create new table with updated CHECK constraint
    await execute(`
      CREATE TABLE stock_adjustments_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        system_stock REAL NOT NULL,
        actual_stock REAL NOT NULL,
        difference REAL NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('restock', 'spoilage', 'theft', 'counting_error', 'damage', 'other')),
        notes TEXT,
        adjusted_by TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    // Copy data from old table
    await execute(`
      INSERT INTO stock_adjustments_new 
      SELECT * FROM stock_adjustments
    `);

    // Drop old table
    await execute('DROP TABLE stock_adjustments');

    // Rename new table
    await execute('ALTER TABLE stock_adjustments_new RENAME TO stock_adjustments');

    // Recreate indexes
    await execute('CREATE INDEX IF NOT EXISTS idx_stock_adjustments_business_id ON stock_adjustments(business_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(business_id, created_at DESC)');

    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    return jsonResponse({
      success: true,
      message: 'Successfully migrated stock_adjustments table to include restock reason',
    });
  } catch (error) {
    console.error('❌ Error migrating stock_adjustments:', error);
    // Re-enable foreign keys even on error
    await execute('PRAGMA foreign_keys = ON').catch(() => {});
    return jsonResponse(
      {
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
