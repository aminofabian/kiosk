import { execute, query, queryOne } from './index';

/**
 * Customer wallet: balance on credit_accounts, ledger in wallet_transactions,
 * and sale_payments.payment_method extended with 'wallet'.
 */
export async function migrateCustomerWallet() {
  try {
    const creditCols = await query<{ name: string }>('PRAGMA table_info(credit_accounts)');
    const hasWalletBalance = creditCols.some((c) => c.name === 'wallet_balance');
    if (!hasWalletBalance) {
      console.log('🔄 Adding credit_accounts.wallet_balance...');
      await execute(
        'ALTER TABLE credit_accounts ADD COLUMN wallet_balance REAL NOT NULL DEFAULT 0'
      );
      console.log('✅ credit_accounts.wallet_balance added');
    } else {
      console.log('✓ credit_accounts.wallet_balance already present');
    }

    const wt = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='wallet_transactions'"
    );
    if (wt.length === 0) {
      console.log('🔄 Creating wallet_transactions...');
      await execute(`
        CREATE TABLE wallet_transactions (
          id TEXT PRIMARY KEY,
          credit_account_id TEXT NOT NULL,
          sale_id TEXT,
          type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
          amount REAL NOT NULL,
          notes TEXT,
          recorded_by TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
          FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
        )
      `);
      await execute(
        'CREATE INDEX IF NOT EXISTS idx_wallet_transactions_account ON wallet_transactions(credit_account_id)'
      );
      await execute(
        'CREATE INDEX IF NOT EXISTS idx_wallet_transactions_sale ON wallet_transactions(sale_id)'
      );
      console.log('✅ wallet_transactions created');
    } else {
      console.log('✓ wallet_transactions already exists');
    }

    const spMaster = await queryOne<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='sale_payments'"
    );
    if (spMaster?.sql && !spMaster.sql.includes("'wallet'")) {
      console.log('🔄 Migrating sale_payments to allow payment_method wallet...');
      await execute('PRAGMA foreign_keys = OFF');
      await execute(`
        CREATE TABLE sale_payments_new (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'credit', 'wallet')),
          amount REAL NOT NULL,
          customer_name TEXT,
          customer_phone TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        )
      `);
      await execute(`
        INSERT INTO sale_payments_new
        SELECT * FROM sale_payments
      `);
      await execute('DROP TABLE sale_payments');
      await execute('ALTER TABLE sale_payments_new RENAME TO sale_payments');
      await execute(
        'CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id)'
      );
      await execute('PRAGMA foreign_keys = ON');
      console.log('✅ sale_payments migrated for wallet');
    } else if (spMaster?.sql) {
      console.log('✓ sale_payments already allows wallet');
    }
  } catch (error) {
    console.error('❌ migrateCustomerWallet error:', error);
    throw error;
  }
}
