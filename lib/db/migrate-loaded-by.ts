import { execute, query } from "./index";

/**
 * Add loaded_by_user_id and loaded_at columns to sales table.
 * Tracks which cashier picked up a forwarded department order.
 */
export async function migrateLoadedByColumns(): Promise<void> {
  console.log("🔄 Adding loaded_by_user_id / loaded_at to sales...");

  const columns = await query<{ name: string }>(`PRAGMA table_info(sales)`);
  const hasLoadedBy = columns.some((c) => c.name === "loaded_by_user_id");
  const hasLoadedAt = columns.some((c) => c.name === "loaded_at");

  if (hasLoadedBy && hasLoadedAt) {
    console.log("✓ loaded_by_user_id and loaded_at already exist on sales");
    return;
  }

  if (!hasLoadedBy) {
    await execute(
      `ALTER TABLE sales ADD COLUMN loaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
    );
  }

  if (!hasLoadedAt) {
    await execute(
      `ALTER TABLE sales ADD COLUMN loaded_at INTEGER`,
    );
  }

  console.log("✅ Added loaded_by_user_id / loaded_at to sales");
}
