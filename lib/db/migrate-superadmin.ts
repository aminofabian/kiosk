import { execute, query } from '@/lib/db';

/**
 * Migration to add super_admins table and active column to businesses
 */
export async function migrateSuperAdmin(): Promise<void> {
  console.log('🔄 Starting super admin migration...');

  // Create super_admins table if not exists
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email)`);
    console.log('✅ super_admins table ready');
  } catch (error) {
    console.log('⚠ super_admins table might already exist:', error);
  }

  // Add active column to businesses if not exists
  try {
    const tableInfo = await query<{ name: string }>(
      `PRAGMA table_info(businesses)`
    );
    const columnNames = tableInfo.map((col) => col.name);
    
    if (!columnNames.includes('active')) {
      await execute(`ALTER TABLE businesses ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
      console.log('✅ Added active column to businesses');
    } else {
      console.log('✓ businesses.active column already exists');
    }
  } catch (error) {
    console.log('⚠ Error adding active column to businesses:', error);
  }

  console.log('✅ Super admin migration completed');
}
