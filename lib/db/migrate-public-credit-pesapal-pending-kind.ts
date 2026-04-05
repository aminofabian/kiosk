import { execute, query } from './index';

/**
 * Distinguish tab-pay vs wallet top-up in public_credit_pesapal_pending (Pesapal STK).
 */
export async function migratePublicCreditPesapalPendingKind() {
  try {
    const cols = await query<{ name: string }>(
      'PRAGMA table_info(public_credit_pesapal_pending)'
    );
    if (cols.length === 0) {
      console.log('⚠ public_credit_pesapal_pending missing — skipped kind column');
      return;
    }
    if (cols.some((c) => c.name === 'kind')) {
      console.log('✓ public_credit_pesapal_pending.kind already exists');
      return;
    }

    console.log('🔄 Adding public_credit_pesapal_pending.kind…');
    await execute(
      `ALTER TABLE public_credit_pesapal_pending ADD COLUMN kind TEXT NOT NULL DEFAULT 'tab'`
    );
    console.log('✅ public_credit_pesapal_pending.kind added');
  } catch (error) {
    console.error('❌ migratePublicCreditPesapalPendingKind:', error);
    throw error;
  }
}
