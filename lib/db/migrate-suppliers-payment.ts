import { execute, query } from './index';

/**
 * Migration to add preferred_payment_method and payment_details to suppliers table.
 */
export async function migrateSuppliersPayment(): Promise<void> {
  console.log('🔄 Starting suppliers payment fields migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'`
  );

  if (tableCheck.length === 0) {
    console.log('⚠ suppliers table does not exist');
    return;
  }

  const columnCheck = await query<{ name: string }>(
    `PRAGMA table_info(suppliers)`
  );
  const existingCols = new Set(columnCheck.map((col) => col.name));

  if (!existingCols.has('preferred_payment_method')) {
    await execute(`ALTER TABLE suppliers ADD COLUMN preferred_payment_method TEXT`);
    console.log('✅ suppliers.preferred_payment_method added');
  }
  if (!existingCols.has('payment_details')) {
    await execute(`ALTER TABLE suppliers ADD COLUMN payment_details TEXT`);
    console.log('✅ suppliers.payment_details added');
  }
}
