import { execute, query } from './index';
import { DEFAULT_LOYALTY_POINTS_PER_KES } from '@/lib/utils/loyalty-points';

/**
 * Loyalty points: balance on credit_accounts, earn rate on businesses, ledger in loyalty_transactions.
 */
export async function migrateLoyalty() {
  try {
    const caCols = await query<{ name: string }>('PRAGMA table_info(credit_accounts)');
    if (caCols.length > 0 && !caCols.some((c) => c.name === 'loyalty_points_balance')) {
      console.log('🔄 Adding credit_accounts.loyalty_points_balance…');
      await execute(
        'ALTER TABLE credit_accounts ADD COLUMN loyalty_points_balance INTEGER NOT NULL DEFAULT 0'
      );
      console.log('✅ loyalty_points_balance added');
    } else if (caCols.length > 0) {
      console.log('✓ credit_accounts.loyalty_points_balance already present');
    }

    const bCols = await query<{ name: string }>('PRAGMA table_info(businesses)');
    if (bCols.length > 0 && !bCols.some((c) => c.name === 'loyalty_points_per_kes')) {
      console.log('🔄 Adding businesses.loyalty_points_per_kes…');
      await execute(
        `ALTER TABLE businesses ADD COLUMN loyalty_points_per_kes REAL NOT NULL DEFAULT ${DEFAULT_LOYALTY_POINTS_PER_KES}`
      );
      console.log('✅ loyalty_points_per_kes added');
    } else if (bCols.length > 0) {
      console.log('✓ businesses.loyalty_points_per_kes already present');
    }

    const lt = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='loyalty_transactions'"
    );
    if (lt.length === 0) {
      console.log('🔄 Creating loyalty_transactions…');
      await execute(`
        CREATE TABLE loyalty_transactions (
          id TEXT PRIMARY KEY,
          credit_account_id TEXT NOT NULL,
          sale_id TEXT,
          type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
          points INTEGER NOT NULL,
          notes TEXT,
          recorded_by TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (credit_account_id) REFERENCES credit_accounts(id) ON DELETE CASCADE,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
          FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
        )
      `);
      await execute(
        'CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(credit_account_id)'
      );
      await execute(
        'CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_sale ON loyalty_transactions(sale_id)'
      );
      console.log('✅ loyalty_transactions created');
    } else {
      console.log('✓ loyalty_transactions already exists');
    }
  } catch (error) {
    console.error('❌ migrateLoyalty:', error);
    throw error;
  }
}
