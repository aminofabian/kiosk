import { execute, query } from './index';

export async function migrateOriginatedBy(): Promise<void> {
  console.log('🔄 Adding originated_by_user_id to sales...');

  const columns = await query<{ name: string }>(`PRAGMA table_info(sales)`);
  const hasColumn = columns.some((c) => c.name === 'originated_by_user_id');

  if (hasColumn) {
    console.log('✓ originated_by_user_id already exists on sales');
    return;
  }

  await execute(
    `ALTER TABLE sales ADD COLUMN originated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
  );
  await execute(
    `CREATE INDEX IF NOT EXISTS idx_sales_originated_by ON sales(business_id, originated_by_user_id)`,
  );

  console.log('✅ Successfully added originated_by_user_id to sales');
}
