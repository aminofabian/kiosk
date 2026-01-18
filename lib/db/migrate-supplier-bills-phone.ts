import { execute, query } from './index';

/**
 * Migration to add supplier_phone column to supplier_bills table
 */
export async function migrateSupplierBillsPhone(): Promise<void> {
  console.log('🔄 Starting supplier_bills phone migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_bills'`
  );

  if (tableCheck.length === 0) {
    console.log('⚠ supplier_bills table does not exist, will be created by main migration');
    return;
  }

  // Check if column already exists
  const columnCheck = await query<{ name: string }>(
    `PRAGMA table_info(supplier_bills)`
  );

  const hasPhoneColumn = columnCheck.some((col) => col.name === 'supplier_phone');

  if (hasPhoneColumn) {
    console.log('✅ supplier_phone column already exists');
    return;
  }

  console.log('Adding supplier_phone column to supplier_bills table...');

  try {
    await execute(`
      ALTER TABLE supplier_bills 
      ADD COLUMN supplier_phone TEXT
    `);

    console.log('✅ supplier_phone column added successfully');
  } catch (error) {
    console.error('Error adding supplier_phone column:', error);
    throw error;
  }
}
