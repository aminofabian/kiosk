import { execute, query } from './index';

export async function migrateExpensesIncludeInDrawer(): Promise<void> {
  console.log('🔄 Migrating expenses table to add include_in_drawer field...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'`
  );

  if (tableCheck.length === 0) {
    console.log('⚠ expenses table does not exist, will be created by schema');
    return;
  }

  const tableInfo = await query<{ sql: string }>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'`
  );
  const sql = tableInfo[0]?.sql ?? '';

  if (sql.includes('include_in_drawer')) {
    console.log('✓ expenses.include_in_drawer already exists');
    return;
  }

  await execute(
    `ALTER TABLE expenses ADD COLUMN include_in_drawer INTEGER NOT NULL DEFAULT 1`
  );
  console.log('✅ Added expenses.include_in_drawer column');
}
