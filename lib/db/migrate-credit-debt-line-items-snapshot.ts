import { execute, query } from './index';

export async function migrateCreditDebtLineItemsSnapshot(): Promise<void> {
  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='credit_transactions'`
  );
  if (tableCheck.length === 0) {
    console.log('⚠ credit_transactions missing, skip debt_line_items_json');
    return;
  }

  const cols = await query<{ name: string }>(`PRAGMA table_info(credit_transactions)`);
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('debt_line_items_json')) {
    console.log('🔄 Adding credit_transactions.debt_line_items_json…');
    await execute(`ALTER TABLE credit_transactions ADD COLUMN debt_line_items_json TEXT`);
  }

  console.log('✓ credit debt line items snapshot column OK');
}
