import { execute, query } from './index';

/**
 * Migration: barcode_exempt flag for items that intentionally have no barcode.
 */
export async function migrateBarcodeExempt() {
  const tableInfo = await query<{ name: string }>('PRAGMA table_info(items)');
  const columnNames = new Set(tableInfo.map((col) => col.name));

  if (!columnNames.has('barcode_exempt')) {
    await execute('ALTER TABLE items ADD COLUMN barcode_exempt INTEGER NOT NULL DEFAULT 0');
  }

  if (!columnNames.has('barcode_exempt_reason')) {
    await execute('ALTER TABLE items ADD COLUMN barcode_exempt_reason TEXT');
  }

  await execute(
    'CREATE INDEX IF NOT EXISTS idx_items_barcode_exempt ON items(business_id, barcode_exempt) WHERE barcode_exempt = 1'
  );
}
