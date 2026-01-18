import { execute, query } from './index';

/**
 * Migration to add 'one-time' frequency option to expenses table
 */
export async function migrateExpensesOneTime(): Promise<void> {
  console.log('🔄 Starting expenses one-time frequency migration...');

  // Check if table exists
  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'`
  );

  if (tableCheck.length === 0) {
    console.log('⚠ expenses table does not exist, will be created by schema');
    return;
  }

  // SQLite doesn't support ALTER TABLE to modify CHECK constraints
  // We need to recreate the table with the new constraint
  console.log('Recreating expenses table with one-time frequency support...');

  try {
    // Disable foreign keys temporarily
    await execute('PRAGMA foreign_keys = OFF');

    // Create new table with updated CHECK constraint
    await execute(`
      CREATE TABLE expenses_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
        amount REAL NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'one-time')),
        start_date INTEGER NOT NULL,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    // Copy data from old table
    await execute(`
      INSERT INTO expenses_new 
      SELECT * FROM expenses
    `);

    // Drop old table
    await execute('DROP TABLE expenses');

    // Rename new table
    await execute('ALTER TABLE expenses_new RENAME TO expenses');

    // Recreate indexes
    await execute(`CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_expenses_active ON expenses(business_id, active)`);

    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    console.log('✅ expenses table migrated successfully with one-time frequency support');
  } catch (error) {
    // Re-enable foreign keys even if there's an error
    await execute('PRAGMA foreign_keys = ON');
    
    // Check if the constraint already includes 'one-time'
    const tableInfo = await query<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'`
    );
    
    if (tableInfo.length > 0 && tableInfo[0].sql?.includes("'one-time'")) {
      console.log('✅ expenses table already supports one-time frequency');
      return;
    }
    
    throw error;
  }
}
