import { execute, query } from './index';
import { DEFAULT_LOYALTY_POINTS_PER_KES } from '@/lib/utils/loyalty-points';

const MARKER_TABLE = '_migrated_loyalty_default_rate_v1';

/**
 * One-time: set loyalty_points_per_kes from legacy default 0 → DEFAULT_LOYALTY_POINTS_PER_KES.
 * Idempotent; does not run again after marker table exists.
 * Businesses that later set rate to 0 in settings are left unchanged on subsequent runs.
 */
export async function migrateLoyaltyDefaultEnable(): Promise<void> {
  const bCols = await query<{ name: string }>('PRAGMA table_info(businesses)');
  if (!bCols.some((c) => c.name === 'loyalty_points_per_kes')) {
    return;
  }

  const marker = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [MARKER_TABLE]
  );
  if (marker.length > 0) {
    console.log('✓ loyalty default rate migration already applied');
    return;
  }

  await execute(
    `CREATE TABLE ${MARKER_TABLE} (id INTEGER PRIMARY KEY CHECK (id = 1))`
  );
  await execute(`INSERT INTO ${MARKER_TABLE} (id) VALUES (1)`);

  await execute(
    `UPDATE businesses SET loyalty_points_per_kes = ? WHERE COALESCE(loyalty_points_per_kes, 0) = 0`,
    [DEFAULT_LOYALTY_POINTS_PER_KES]
  );
  console.log(
    `✅ Loyalty earn rate enabled where it was off (set to ${DEFAULT_LOYALTY_POINTS_PER_KES} pts/KES; set to 0 in Admin → Settings to disable)`
  );
}
