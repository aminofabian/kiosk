import { execute, query } from './index';

export async function migrateStockApprovals(): Promise<void> {
  console.log('🔄 Starting stock_approval_requests migration...');

  // Check if table exists by querying sqlite_master
  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='stock_approval_requests'`
  );

  if (tableCheck.length > 0) {
    console.log('✅ stock_approval_requests table already exists');
    // Verify the table structure is correct by checking columns
    const columns = await query<{ name: string }>(
      `PRAGMA table_info(stock_approval_requests)`
    );
    console.log(`Table has ${columns.length} columns`);
    return;
  }

  console.log('Creating stock_approval_requests table...');

  await execute(`
    CREATE TABLE stock_approval_requests (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('increase', 'decrease')),
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      requested_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      approved_by TEXT,
      approved_at INTEGER,
      rejection_reason TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_stock_approvals_business_id ON stock_approval_requests(business_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_stock_approvals_status ON stock_approval_requests(business_id, status)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_stock_approvals_item_id ON stock_approval_requests(item_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_stock_approvals_requested_by ON stock_approval_requests(requested_by)`);

  console.log('✅ stock_approval_requests migration completed');
}
