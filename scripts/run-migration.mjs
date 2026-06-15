// Quick migration runner - run with: node scripts/run-migration.mjs
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./data/pos.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

async function main() {
  // Check current constraint
  const result = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
  const currentSql = result.rows[0]?.sql;
  console.log('Current schema:', currentSql);

  if (currentSql && currentSql.includes('department_staff')) {
    console.log('✓ Migration already applied');
    return;
  }

  console.log('🔄 Applying department_staff role migration...');

  await db.execute("PRAGMA foreign_keys = OFF");

  // Create new table with updated constraint
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users_new (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'cashier', 'department_staff')),
      pin TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      can_give_credit INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(business_id, email)
    )
  `);

  // Copy data
  await db.execute(`
    INSERT INTO users_new (id, business_id, name, email, password_hash, role, pin, active, can_give_credit, created_by, created_at)
    SELECT id, business_id, name, email, password_hash, role, pin, active, can_give_credit, created_by, created_at FROM users
  `);

  // Swap tables
  await db.execute("DROP TABLE users");
  await db.execute("ALTER TABLE users_new RENAME TO users");

  // Recreate indexes
  await db.execute("CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(business_id, email)");

  await db.execute("PRAGMA foreign_keys = ON");

  // Add originated_by_user_id column to sales
  const salesCols = await db.execute("PRAGMA table_info(sales)");
  const hasOriginatedBy = salesCols.rows.some(r => r.name === 'originated_by_user_id');

  if (!hasOriginatedBy) {
    console.log('🔄 Adding originated_by_user_id to sales...');
    await db.execute("ALTER TABLE sales ADD COLUMN originated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_sales_originated_by ON sales(business_id, originated_by_user_id)");
  }

  console.log('✅ Migration complete!');
}

main().catch(console.error);
