import { execute, query } from './index';

/**
 * Adds supplier_invoice_no on supplier_bills, supplier_bill_id on inventory_batches,
 * and a partial unique index for duplicate invoice detection.
 */
export async function migrateSupplierBillsIntegrity(): Promise<void> {
  console.log('🔄 Starting supplier_bills integrity migration...');

  const billsTable = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_bills'`
  );
  if (billsTable.length === 0) {
    console.log('⚠ supplier_bills table does not exist, skipping integrity migration');
    return;
  }

  const billCols = await query<{ name: string }>(`PRAGMA table_info(supplier_bills)`);
  const billColSet = new Set(billCols.map((c) => c.name));

  if (!billColSet.has('supplier_invoice_no')) {
    await execute(`ALTER TABLE supplier_bills ADD COLUMN supplier_invoice_no TEXT`);
    console.log('✅ Added supplier_invoice_no to supplier_bills');
  }

  const batchesTable = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_batches'`
  );
  if (batchesTable.length > 0) {
    const batchCols = await query<{ name: string }>(`PRAGMA table_info(inventory_batches)`);
    const batchColSet = new Set(batchCols.map((c) => c.name));

    if (!batchColSet.has('supplier_bill_id')) {
      await execute(`ALTER TABLE inventory_batches ADD COLUMN supplier_bill_id TEXT`);
      console.log('✅ Added supplier_bill_id to inventory_batches');
    }
  }

  await execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_bills_invoice_unique
     ON supplier_bills(business_id, supplier_id, supplier_invoice_no)
     WHERE supplier_invoice_no IS NOT NULL AND supplier_id IS NOT NULL AND status != 'cancelled'`
  );

  await execute(
    `CREATE INDEX IF NOT EXISTS idx_inventory_batches_supplier_bill
     ON inventory_batches(supplier_bill_id)
     WHERE supplier_bill_id IS NOT NULL`
  );

  console.log('✅ supplier_bills integrity migration completed');
}
