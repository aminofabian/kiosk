import { execute, query } from './index';

const USER_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS users (
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
)`;

const USER_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(business_id, email)`,
];

async function tableExists(name: string): Promise<boolean> {
  const rows = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [name],
  );
  return rows.length > 0;
}

export async function migrateDepartmentStaffRole(): Promise<void> {
  console.log('🔄 Starting department staff role migration...');

  const tableInfo = await query<{ sql: string }>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`,
  );

  if (tableInfo.length === 0) {
    console.log('⚠ users table does not exist, will be created by schema');
    return;
  }

  const currentSql = tableInfo[0].sql ?? '';
  if (currentSql.includes("'department_staff'")) {
    console.log('✓ users.role already includes department_staff');
    return;
  }

  console.log('🔄 Migrating users table to add department_staff role...');

  await execute('PRAGMA foreign_keys = OFF');
  try {
    if (await tableExists('users_new')) {
      await execute('DROP TABLE users_new');
    }

    await execute(USER_TABLE_DDL.replace('CREATE TABLE IF NOT EXISTS users', 'CREATE TABLE users_new'));

    // Copy existing data — role column stays the same; the CHECK constraint is relaxed
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

    await execute('DROP TABLE users');
    await execute('ALTER TABLE users_new RENAME TO users');

    for (const idx of USER_INDEXES) {
      await execute(idx);
    }

    console.log('✅ Successfully migrated users table to include department_staff role');
  } catch (error) {
    console.error('❌ Error migrating users table:', error);
    throw error;
  } finally {
    await execute('PRAGMA foreign_keys = ON');
  }
}
