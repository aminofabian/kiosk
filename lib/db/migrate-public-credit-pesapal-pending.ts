import { execute, query } from './index';

export async function migratePublicCreditPesapalPending() {
  try {
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='public_credit_pesapal_pending'"
    );

    if (tableInfo.length > 0) {
      console.log('✓ public_credit_pesapal_pending table already exists');
      return;
    }

    console.log('🔄 Creating public_credit_pesapal_pending table...');

    await execute(`
      CREATE TABLE public_credit_pesapal_pending (
        id TEXT PRIMARY KEY,
        credit_account_id TEXT NOT NULL,
        business_id TEXT NOT NULL,
        order_tracking_id TEXT NOT NULL UNIQUE,
        merchant_reference TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        balance_snapshot REAL NOT NULL,
        kind TEXT NOT NULL DEFAULT 'tab' CHECK (kind IN ('tab', 'wallet')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        applied_at INTEGER,
        FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    await execute(
      'CREATE INDEX IF NOT EXISTS idx_public_credit_pesapal_pending_account ON public_credit_pesapal_pending(credit_account_id)'
    );
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_public_credit_pesapal_pending_tracking ON public_credit_pesapal_pending(order_tracking_id)'
    );

    console.log('✅ Successfully created public_credit_pesapal_pending table');
  } catch (error) {
    console.error('❌ Error creating public_credit_pesapal_pending table:', error);
    throw error;
  }
}
