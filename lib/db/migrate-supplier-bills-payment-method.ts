import { execute, query } from './index';

/**
 * Migration to add preferred_payment_method and payment_details columns to supplier_bills table.
 * preferred_payment_method: comma-separated method IDs (e.g. "cash,mpesa,bank_transfer")
 * payment_details: free-text details like M-Pesa number, bank account, etc.
 */
export async function migrateSupplierBillsPaymentMethod(): Promise<void> {
  console.log('🔄 Starting supplier_bills payment method migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_bills'`
  );

  if (tableCheck.length === 0) {
    console.log('⚠ supplier_bills table does not exist, will be created by main migration');
    return;
  }

  const columnCheck = await query<{ name: string }>(
    `PRAGMA table_info(supplier_bills)`
  );

  const existingCols = new Set(columnCheck.map((col) => col.name));

  if (!existingCols.has('preferred_payment_method')) {
    console.log('Adding preferred_payment_method column...');
    await execute(`ALTER TABLE supplier_bills ADD COLUMN preferred_payment_method TEXT`);
    console.log('✅ preferred_payment_method column added');
  } else {
    console.log('✅ preferred_payment_method column already exists');
  }

  if (!existingCols.has('payment_details')) {
    console.log('Adding payment_details column...');
    await execute(`ALTER TABLE supplier_bills ADD COLUMN payment_details TEXT`);
    console.log('✅ payment_details column added');
  } else {
    console.log('✅ payment_details column already exists');
  }
}
