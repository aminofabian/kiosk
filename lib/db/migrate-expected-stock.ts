import { execute, query } from './index';

/**
 * Migration: Add expected_stock_level (par/target restock level) to items.
 */
export async function migrateExpectedStock() {
  try {
    console.log('🔄 Starting expected_stock_level migration...');

    const tableInfo = await query<{ name: string }>('PRAGMA table_info(items)');
    const columnNames = tableInfo.map((col) => col.name);

    if (!columnNames.includes('expected_stock_level')) {
      await execute('ALTER TABLE items ADD COLUMN expected_stock_level REAL');
      console.log('✓ Added expected_stock_level column');
    } else {
      console.log('✓ expected_stock_level column already exists');
    }

    console.log('\n✅ Expected stock migration completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Expected stock migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateExpectedStock()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
