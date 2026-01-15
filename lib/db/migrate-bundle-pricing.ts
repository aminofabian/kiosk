import { execute, query } from './index';

/**
 * Migration: Add bundle pricing columns to items table
 * 
 * Bundle pricing allows items to be sold in bundles at a fixed price.
 * Example: "3 tomatoes for KES 20" or "Half dozen eggs for KES 60"
 * 
 * Run with: npx tsx lib/db/migrate-bundle-pricing.ts
 */
export async function migrateBundlePricing() {
    try {
        console.log('🔄 Starting bundle pricing migration...');

        // Check if columns already exist
        const tableInfo = await query<{ name: string }>(
            "PRAGMA table_info(items)"
        );
        const columnNames = tableInfo.map((col) => col.name);

        // Add bundle_quantity column if it doesn't exist
        // This is the number of units in a bundle (e.g., 3 for "3 tomatoes")
        if (!columnNames.includes('bundle_quantity')) {
            console.log('Adding bundle_quantity column...');
            await execute('ALTER TABLE items ADD COLUMN bundle_quantity REAL');
            console.log('✓ Added bundle_quantity column');
        } else {
            console.log('✓ bundle_quantity column already exists');
        }

        // Add bundle_price column if it doesn't exist
        // This is the price for the bundle (e.g., 20 for "KES 20")
        if (!columnNames.includes('bundle_price')) {
            console.log('Adding bundle_price column...');
            await execute('ALTER TABLE items ADD COLUMN bundle_price REAL');
            console.log('✓ Added bundle_price column');
        } else {
            console.log('✓ bundle_price column already exists');
        }

        // Add bundle_name column if it doesn't exist
        // Optional friendly name for the bundle (e.g., "3 for 20", "Half Dozen")
        if (!columnNames.includes('bundle_name')) {
            console.log('Adding bundle_name column...');
            await execute('ALTER TABLE items ADD COLUMN bundle_name TEXT');
            console.log('✓ Added bundle_name column');
        } else {
            console.log('✓ bundle_name column already exists');
        }

        console.log('\n✅ Bundle pricing migration completed successfully!');
        console.log('\nBundle pricing allows you to:');
        console.log('  - Set a bundle quantity (e.g., 3)');
        console.log('  - Set a bundle price (e.g., KES 20)');
        console.log('  - Optionally name the bundle (e.g., "3 for 20")');
        console.log('\nExample: 3 tomatoes for KES 20 instead of per-kg pricing');
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migrateBundlePricing()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
