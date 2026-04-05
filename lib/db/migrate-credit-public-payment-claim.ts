import { execute, query } from './index';

export async function migrateCreditPublicPaymentClaim(): Promise<void> {
  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='credit_transactions'`
  );
  if (tableCheck.length === 0) {
    console.log('⚠ credit_transactions missing, skip public payment claim columns');
    return;
  }

  const cols = await query<{ name: string }>(`PRAGMA table_info(credit_transactions)`);
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('public_claim_status')) {
    console.log('🔄 Adding credit_transactions.public_claim_status…');
    await execute(`ALTER TABLE credit_transactions ADD COLUMN public_claim_status TEXT`);
  }
  if (!names.has('claim_reviewed_at')) {
    await execute(`ALTER TABLE credit_transactions ADD COLUMN claim_reviewed_at INTEGER`);
  }
  if (!names.has('claim_reviewed_by')) {
    await execute(`ALTER TABLE credit_transactions ADD COLUMN claim_reviewed_by TEXT`);
  }

  console.log('✓ credit public payment claim columns OK');
}
