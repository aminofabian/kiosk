import { execute, query } from './index';

/**
 * Customer-reported wallet top-ups from /c/[phone] — pending admin approval (mirrors credit_transactions claims).
 */
export async function migrateWalletTransactionsPublicClaim() {
  try {
    const cols = await query<{ name: string }>('PRAGMA table_info(wallet_transactions)');
    if (cols.length === 0) {
      console.log('⚠ wallet_transactions missing — skipped public claim columns');
      return;
    }

    const add = async (name: string, ddl: string) => {
      if (cols.some((c) => c.name === name)) return;
      console.log(`🔄 Adding wallet_transactions.${name}…`);
      await execute(ddl);
      cols.push({ name } as { name: string });
    };

    await add('public_claim_status', 'ALTER TABLE wallet_transactions ADD COLUMN public_claim_status TEXT');
    await add('claim_reviewed_at', 'ALTER TABLE wallet_transactions ADD COLUMN claim_reviewed_at INTEGER');
    await add('claim_reviewed_by', 'ALTER TABLE wallet_transactions ADD COLUMN claim_reviewed_by TEXT');
    await add('payment_method', 'ALTER TABLE wallet_transactions ADD COLUMN payment_method TEXT');
    await add(
      'customer_reference',
      'ALTER TABLE wallet_transactions ADD COLUMN customer_reference TEXT'
    );

    console.log('✓ wallet_transactions public claim columns');
  } catch (error) {
    console.error('❌ migrateWalletTransactionsPublicClaim:', error);
    throw error;
  }
}
