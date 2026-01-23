import { execute, query } from './index';

export async function migrateExpensesCreatedBy() {
  console.log('🔄 Migrating expenses table to add created_by field...');

  try {
    // Check if column already exists
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'"
    );

    if (tableInfo.length === 0) {
      console.log('⚠ expenses table does not exist, will be created by schema');
      return;
    }

    const oldSql = tableInfo[0].sql;
    if (oldSql && oldSql.includes('created_by')) {
      console.log('✓ expenses.created_by already exists');
      return;
    }

    // SQLite doesn't support ALTER TABLE ADD COLUMN with FOREIGN KEY directly
    // So we need to recreate the table
    await execute('PRAGMA foreign_keys = OFF');

    // Create new table with created_by field
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
        created_by TEXT,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Copy data from old table (created_by will be NULL for existing records)
    await execute(`
      INSERT INTO expenses_new 
      (id, business_id, name, category, amount, frequency, start_date, notes, active, created_at, created_by)
      SELECT id, business_id, name, category, amount, frequency, start_date, notes, active, created_at, NULL
      FROM expenses
    `);

    // Drop old table
    await execute('DROP TABLE expenses');

    // Rename new table
    await execute('ALTER TABLE expenses_new RENAME TO expenses');

    // Recreate indexes
    await execute('CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_expenses_active ON expenses(business_id, active)');
    await execute('CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by)');

    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    console.log('✅ Successfully migrated expenses table to add created_by field');
  } catch (error) {
    console.error('❌ Error migrating expenses:', error);
    // Re-enable foreign keys even on error
    await execute('PRAGMA foreign_keys = ON').catch(() => {});
    throw error;
  }
}
