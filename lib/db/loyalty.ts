import { execute, query, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { loyaltyPointsEarned } from '@/lib/utils/loyalty-points';

export { loyaltyPointsEarned } from '@/lib/utils/loyalty-points';

/**
 * Award loyalty for a completed sale (idempotent per sale: skips if earn row already exists).
 */
export async function awardLoyaltyPointsForSale(params: {
  businessId: string;
  creditAccountId: string;
  saleId: string;
  totalAmountKes: number;
  recordedByUserId: string;
}): Promise<{ awarded: number }> {
  const { businessId, creditAccountId, saleId, totalAmountKes, recordedByUserId } = params;

  const biz = await queryOne<{ loyalty_points_per_kes: number }>(
    `SELECT COALESCE(loyalty_points_per_kes, 0) AS loyalty_points_per_kes FROM businesses WHERE id = ?`,
    [businessId]
  );
  const rate = Number(biz?.loyalty_points_per_kes ?? 0);
  const points = loyaltyPointsEarned(totalAmountKes, rate);
  if (points <= 0) {
    return { awarded: 0 };
  }

  const acc = await queryOne<{ id: string }>(
    `SELECT id FROM credit_accounts WHERE id = ? AND business_id = ?`,
    [creditAccountId, businessId]
  );
  if (!acc) {
    return { awarded: 0 };
  }

  const dup = await queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM loyalty_transactions
     WHERE sale_id = ? AND type = 'earn'`,
    [saleId]
  );
  if (Number(dup?.c ?? 0) > 0) {
    return { awarded: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const txId = generateUUID();
  await execute(
    `INSERT INTO loyalty_transactions (
      id, credit_account_id, sale_id, type, points, notes, recorded_by, created_at
    ) VALUES (?, ?, ?, 'earn', ?, ?, ?, ?)`,
    [
      txId,
      creditAccountId,
      saleId,
      points,
      `Sale · ${totalAmountKes.toFixed(0)} KES @ ${rate} pt/KES`,
      recordedByUserId,
      now,
    ]
  );
  await execute(
    `UPDATE credit_accounts
     SET loyalty_points_balance = COALESCE(loyalty_points_balance, 0) + ?
     WHERE id = ? AND business_id = ?`,
    [points, creditAccountId, businessId]
  );

  return { awarded: points };
}

/** Reverse earn rows for a voided sale (by sale_id). */
export async function reverseLoyaltyForVoidedSale(saleId: string, businessId: string): Promise<void> {
  const rows = await query<{ id: string; credit_account_id: string; points: number }>(
    `SELECT id, credit_account_id, points FROM loyalty_transactions
     WHERE sale_id = ? AND type = 'earn'`,
    [saleId]
  );
  for (const r of rows) {
    const pts = Number(r.points);
    if (pts <= 0) continue;
    await execute(
      `UPDATE credit_accounts
       SET loyalty_points_balance = MAX(0, COALESCE(loyalty_points_balance, 0) - ?)
       WHERE id = ? AND business_id = ?`,
      [pts, r.credit_account_id, businessId]
    );
  }
  if (rows.length > 0) {
    await execute(`DELETE FROM loyalty_transactions WHERE sale_id = ? AND type = 'earn'`, [saleId]);
  }
}
