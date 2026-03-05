import { execute } from './index';

/**
 * Adds denom_40 columns for the 40 KES denomination.
 * Run with: npx tsx lib/db/migrate-denom-40.ts
 * Or via: POST /api/db/migrate
 */
export async function migrateDenom40() {
  console.log('Running denom_40 migration...');

  // Add opening_denom_40 and closing_denom_40 to shifts
  for (const col of ['opening_denom_40', 'closing_denom_40']) {
    try {
      await execute(`ALTER TABLE shifts ADD COLUMN ${col} INTEGER DEFAULT 0`);
      console.log(`  Added ${col} column to shifts`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('duplicate column')) {
        console.log(`  ${col} column already exists on shifts`);
      } else {
        throw error;
      }
    }
  }

  // Add denom_40 to balance_approval_requests
  try {
    await execute(`ALTER TABLE balance_approval_requests ADD COLUMN denom_40 INTEGER DEFAULT 0`);
    console.log('  Added denom_40 column to balance_approval_requests');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('duplicate column')) {
      console.log('  denom_40 column already exists on balance_approval_requests');
    } else if (error instanceof Error && error.message.includes('no such table')) {
      console.log('  balance_approval_requests table does not exist yet, skipping denom_40');
    } else {
      throw error;
    }
  }

  console.log('denom_40 migration complete!');
}
