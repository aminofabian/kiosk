import { execute, query } from './index';

/**
 * Migration: Create out_of_stock_requests table
 * For cashiers to log items customers asked for but were not available/sold
 */
export async function migrateOutOfStockRequests() {
  try {
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='out_of_stock_requests'"
    );

    if (tableInfo.length > 0) {
      console.log('✓ out_of_stock_requests table already exists');
      return;
    }

    console.log('🔄 Creating out_of_stock_requests table...');

    await execute(`
      CREATE TABLE out_of_stock_requests (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        notes TEXT,
        recorded_by TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    await execute(
      'CREATE INDEX IF NOT EXISTS idx_out_of_stock_requests_business_id ON out_of_stock_requests(business_id)'
    );
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_out_of_stock_requests_created_at ON out_of_stock_requests(business_id, created_at DESC)'
    );

    console.log('✅ Successfully created out_of_stock_requests table');
  } catch (error) {
    console.error('❌ Error creating out_of_stock_requests table:', error);
    throw error;
  }
}
