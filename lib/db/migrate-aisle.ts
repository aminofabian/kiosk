import { execute, query } from './index';

/**
 * Migration: Add aisle and aisle_number columns to items table
 * For organizing products by physical location (e.g. "Produce", "A3")
 *
 * Run with: npx tsx lib/db/migrate-aisle.ts
 */
export async function migrateAisle() {
  try {
    console.log('🔄 Starting aisle migration...');

    const tableInfo = await query<{ name: string }>('PRAGMA table_info(items)');
    const columnNames = tableInfo.map((col) => col.name);

    if (!columnNames.includes('aisle')) {
      console.log('Adding aisle column...');
      await execute('ALTER TABLE items ADD COLUMN aisle TEXT');
      console.log('✓ Added aisle column');
    } else {
      console.log('✓ aisle column already exists');
    }

    if (!columnNames.includes('aisle_number')) {
      console.log('Adding aisle_number column...');
      await execute('ALTER TABLE items ADD COLUMN aisle_number TEXT');
      console.log('✓ Added aisle_number column');
    } else {
      console.log('✓ aisle_number column already exists');
    }

    console.log('\n✅ Aisle migration completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Aisle migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateAisle()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
