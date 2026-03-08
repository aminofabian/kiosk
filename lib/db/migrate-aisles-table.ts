import { execute, query } from './index';

/**
 * Migration: Create aisles table for store layout management
 * Aisles have a name (e.g. "Produce") and number (e.g. "A3")
 *
 * Run with: npx tsx lib/db/migrate-aisles-table.ts
 */
export async function migrateAislesTable() {
  try {
    console.log('🔄 Creating aisles table...');

    const tables = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='aisles'"
    );

    if (tables.length > 0) {
      console.log('✓ aisles table already exists');
      return true;
    }

    await execute(`
      CREATE TABLE aisles (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT NOT NULL,
        number TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
      )
    `);

    await execute('CREATE INDEX IF NOT EXISTS idx_aisles_business_id ON aisles(business_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_aisles_sort ON aisles(business_id, sort_order)');

    console.log('✅ Aisles table created successfully!');
    return true;
  } catch (error) {
    console.error('❌ Aisles table migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateAislesTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
