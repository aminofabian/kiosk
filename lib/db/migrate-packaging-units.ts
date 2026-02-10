import { execute, query } from './index';

/**
 * Migration: Add packaging unit columns to items table
 * 
 * Packaging units allow items to be ordered in bulk packaging
 * and automatically compute individual item quantities.
 * 
 * Examples:
 *   - Mount Kenya Milk: packaging_unit_name = "Carton", packaging_unit_qty = 18
 *     → Ordering 10 cartons = 180 packets
 *   - Tomatoes: packaging_unit_name = "Sack", packaging_unit_qty = 100
 *     → Ordering 2 sacks = 200 pieces
 * 
 * Run with: npx tsx lib/db/migrate-packaging-units.ts
 */
export async function migratePackagingUnits() {
    try {
        console.log('🔄 Starting packaging units migration...');

        // Check if columns already exist
        const tableInfo = await query<{ name: string }>(
            "PRAGMA table_info(items)"
        );
        const columnNames = tableInfo.map((col) => col.name);

        // Add packaging_unit_name column if it doesn't exist
        // This is the name of the bulk packaging unit (e.g., "Carton", "Sack", "Crate")
        if (!columnNames.includes('packaging_unit_name')) {
            console.log('Adding packaging_unit_name column...');
            await execute('ALTER TABLE items ADD COLUMN packaging_unit_name TEXT');
            console.log('✓ Added packaging_unit_name column');
        } else {
            console.log('✓ packaging_unit_name column already exists');
        }

        // Add packaging_unit_qty column if it doesn't exist
        // This is how many individual items are in one packaging unit (e.g., 18 packets per carton)
        if (!columnNames.includes('packaging_unit_qty')) {
            console.log('Adding packaging_unit_qty column...');
            await execute('ALTER TABLE items ADD COLUMN packaging_unit_qty REAL');
            console.log('✓ Added packaging_unit_qty column');
        } else {
            console.log('✓ packaging_unit_qty column already exists');
        }

        console.log('\n✅ Packaging units migration completed successfully!');
        console.log('\nPackaging units allow you to:');
        console.log('  - Define bulk packaging (e.g., "Carton" = 18 packets)');
        console.log('  - Auto-calculate quantities in supplier bills');
        console.log('  - Order 10 cartons → system records 180 individual items');
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migratePackagingUnits()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
