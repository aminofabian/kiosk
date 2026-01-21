import { execute, query } from './index';

export async function migrateBalanceApprovals(): Promise<void> {
  console.log('🔄 Starting balance_approval_requests migration...');

  // Check if table exists by querying sqlite_master
  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='balance_approval_requests'`
  );

  if (tableCheck.length > 0) {
    console.log('✅ balance_approval_requests table already exists');
    // Verify the table structure is correct by checking columns
    const columns = await query<{ name: string }>(
      `PRAGMA table_info(balance_approval_requests)`
    );
    console.log(`Table has ${columns.length} columns`);
    return;
  }

  console.log('Creating balance_approval_requests table...');

  await execute(`
    CREATE TABLE balance_approval_requests (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      shift_id TEXT, -- nullable, for closing balance requests on existing shifts
      user_id TEXT NOT NULL, -- cashier who submitted the request
      balance_type TEXT NOT NULL CHECK (balance_type IN ('opening', 'closing')),
      amount REAL NOT NULL,
      expected_amount REAL, -- for closing balance, the system's expected amount
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      approved_by TEXT,
      approved_at INTEGER,
      rejection_reason TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      -- Store denomination breakdown
      denom_1 INTEGER DEFAULT 0,
      denom_5 INTEGER DEFAULT 0,
      denom_10 INTEGER DEFAULT 0,
      denom_20 INTEGER DEFAULT 0,
      denom_50 INTEGER DEFAULT 0,
      denom_100 INTEGER DEFAULT 0,
      denom_200 INTEGER DEFAULT 0,
      denom_500 INTEGER DEFAULT 0,
      denom_1000 INTEGER DEFAULT 0,
      -- For closing balance, store cash expenses
      cash_expenses REAL DEFAULT 0,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_balance_approvals_business_id ON balance_approval_requests(business_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_balance_approvals_status ON balance_approval_requests(business_id, status)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_balance_approvals_user_id ON balance_approval_requests(user_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_balance_approvals_shift_id ON balance_approval_requests(shift_id)`);

  console.log('✅ balance_approval_requests migration completed');
}
