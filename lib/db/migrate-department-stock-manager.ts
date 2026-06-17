import { execute, query } from "./index";

/**
 * Migration: Add department_stock_manager role to users table CHECK constraint.
 * Preserves the department column when recreating the table.
 */
export async function migrateDepartmentStockManagerRole(): Promise<void> {
  console.log("🔄 Starting department_stock_manager role migration...");

  const tableInfo = await query<{ sql: string }>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`,
  );

  if (tableInfo.length === 0) {
    console.log("⚠ users table does not exist, will be created by schema");
    return;
  }

  const currentSql = tableInfo[0].sql ?? "";
  if (currentSql.includes("'department_stock_manager'")) {
    console.log("✓ users.role already includes department_stock_manager");
    return;
  }

  const columns = await query<{ name: string }>(`PRAGMA table_info(users)`);
  const hasDepartment = columns.some((c) => c.name === "department");

  console.log(
    "🔄 Migrating users table to add department_stock_manager role...",
  );

  await execute("PRAGMA foreign_keys = OFF");
  try {
    await execute(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner','admin','cashier','department_staff','department_stock_manager')),
        pin TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        can_give_credit INTEGER NOT NULL DEFAULT 0,
        department TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(business_id, email)
      )
    `);

    if (hasDepartment) {
      await execute(`
        INSERT INTO users_new (
          id, business_id, name, email, password_hash, role, pin,
          active, can_give_credit, department, created_by, created_at
        )
        SELECT
          id, business_id, name, email, password_hash, role, pin,
          active, can_give_credit, department, created_by, created_at
        FROM users
      `);
    } else {
      await execute(`
        INSERT INTO users_new (
          id, business_id, name, email, password_hash, role, pin,
          active, can_give_credit, created_by, created_at
        )
        SELECT
          id, business_id, name, email, password_hash, role, pin,
          active, can_give_credit, created_by, created_at
        FROM users
      `);
    }

    await execute("DROP TABLE users");
    await execute("ALTER TABLE users_new RENAME TO users");

    await execute(
      `CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id)`,
    );
    await execute(
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(business_id, email)`,
    );

    console.log(
      "✅ Successfully migrated users table to include department_stock_manager role",
    );
  } catch (error) {
    console.error("❌ Error migrating users table:", error);
    throw error;
  } finally {
    await execute("PRAGMA foreign_keys = ON");
  }
}
