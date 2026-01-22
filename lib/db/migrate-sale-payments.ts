import { execute, query } from './index';

/**
 * Migration: Add sale_payments table for split payment support
 */
export async function migrateSalePayments() {
  try {
    // Check if table already exists
    const tableInfo = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sale_payments'"
    );

    if (tableInfo.length > 0) {
      console.log('✓ sale_payments table already exists');
      return;
    }

    console.log('🔄 Creating sale_payments table for split payment support...');

    await execute(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'credit')),
        amount REAL NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      )
    `);

    await execute('CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id)');

    console.log('✅ Successfully created sale_payments table');
  } catch (error) {
    console.error('❌ Error creating sale_payments table:', error);
    throw error;
  }
}
