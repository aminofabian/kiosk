import { execute, query } from './index';

/**
 * Migration to add supplier_type to suppliers table (e.g. grocery, retail, cereals).
 */
export async function migrateSupplierType(): Promise<void> {
  console.log('🔄 Starting supplier_type migration...');

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

  if (!existingCols.has('supplier_type')) {
    await execute(`ALTER TABLE suppliers ADD COLUMN supplier_type TEXT`);
    console.log('✅ suppliers.supplier_type added');
  }
}
