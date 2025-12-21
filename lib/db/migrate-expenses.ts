import { execute } from './index';

export async function migrateExpenses() {
  console.log('Running expenses migration...');

  // Create expenses table
  await execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('fixed', 'variable')),
      amount REAL NOT NULL,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
      start_date INTEGER NOT NULL,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id)
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS idx_expenses_active ON expenses(business_id, active)
  `);

  console.log('Expenses migration completed!');
}

// Run if called directly
migrateExpenses().catch(console.error);
