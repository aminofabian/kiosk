import { execute, query } from './index';

export async function migrateSupplierBills(): Promise<void> {
  console.log('🔄 Starting supplier_bills migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_bills'`
  );

  if (tableCheck.length > 0) {
    console.log('✅ supplier_bills table already exists');
    return;
  }

  console.log('Creating supplier_bills table...');

  await execute(`
    CREATE TABLE IF NOT EXISTS supplier_bills (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT NOT NULL,
      bill_description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
      payment_date INTEGER,
      payment_method TEXT,
      payment_notes TEXT,
      created_by TEXT NOT NULL,
      paid_by TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_bills_business_id ON supplier_bills(business_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_bills_status ON supplier_bills(business_id, status)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_bills_due_date ON supplier_bills(business_id, due_date)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_bills_supplier_id ON supplier_bills(supplier_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_supplier_bills_created_by ON supplier_bills(created_by)`);

  console.log('✅ supplier_bills migration completed');
}
