import { execute, query } from "./index";

/**
 * Add source column to sales table.
 * Values: 'department_forward', 'cashier_draft', 'direct_sale'
 */
export async function migrateSourceColumn(): Promise<void> {
  console.log("🔄 Adding source column to sales...");

  const columns = await query<{ name: string }>(`PRAGMA table_info(sales)`);
  const hasSource = columns.some((c) => c.name === "source");

  if (hasSource) {
    console.log("✓ source column already exists on sales");
    return;
  }

  await execute(
    `ALTER TABLE sales ADD COLUMN source TEXT CHECK (source IN ('department_forward', 'cashier_draft', 'direct_sale'))`,
  );

  // Backfill existing rows by inferring source
  await execute(
    `UPDATE sales SET source = CASE
       WHEN originated_by_user_id IS NOT NULL THEN 'department_forward'
       WHEN status IN ('pending', 'discarded') THEN 'cashier_draft'
       ELSE 'direct_sale'
     END
     WHERE source IS NULL`,
  );

  console.log("✅ Added source column to sales");
}
