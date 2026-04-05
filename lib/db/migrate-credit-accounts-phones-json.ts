import { execute, query } from './index';

/**
 * Wrap legacy plain-text credit_accounts.customer_phone values in a JSON string array
 * so multiple numbers can be stored in one column.
 */
export async function migrateCreditAccountsPhonesJson(): Promise<void> {
  console.log('🔄 Starting credit_accounts phones JSON migration...');

  const tableCheck = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='credit_accounts'`
  );

  if (tableCheck.length === 0) {
    console.log('⚠ credit_accounts table does not exist, skipping');
    return;
  }

  const rows = await query<{ id: string; customer_phone: string }>(
    `SELECT id, customer_phone FROM credit_accounts
     WHERE customer_phone IS NOT NULL AND TRIM(customer_phone) != ''`
  );

  let updated = 0;
  for (const row of rows) {
    const t = row.customer_phone.trim();
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t) as unknown;
        if (Array.isArray(p) && p.every((x) => typeof x === 'string')) {
          continue;
        }
      } catch {
        /* migrate below */
      }
    }
    await execute(`UPDATE credit_accounts SET customer_phone = ? WHERE id = ?`, [
      JSON.stringify([t]),
      row.id,
    ]);
    updated++;
  }

  if (updated > 0) {
    console.log(`✅ Migrated ${updated} credit account phone value(s) to JSON array form`);
  } else {
    console.log('✅ Credit account phones already in JSON form (or none to migrate)');
  }
}
