import { execute, query } from './index';

/**
 * Migration: Add barcode and expiry_date columns to items table
 * 
 * Run with: npx tsx lib/db/migrate-barcode-expiry.ts
 */
export async function migrateBarcodeExpiry() {
    try {
        console.log('🔄 Starting barcode and expiry_date migration...');

        // Check if columns already exist
        const tableInfo = await query<{ name: string }>(
            "PRAGMA table_info(items)"
        );
        const columnNames = tableInfo.map((col) => col.name);

        // Add barcode column if it doesn't exist
        if (!columnNames.includes('barcode')) {
            console.log('Adding barcode column...');
            await execute('ALTER TABLE items ADD COLUMN barcode TEXT');
            console.log('✓ Added barcode column');
        } else {
            console.log('✓ barcode column already exists');
        }

        // Add expiry_date column if it doesn't exist
        if (!columnNames.includes('expiry_date')) {
            console.log('Adding expiry_date column...');
            await execute('ALTER TABLE items ADD COLUMN expiry_date INTEGER');
            console.log('✓ Added expiry_date column');
        } else {
            console.log('✓ expiry_date column already exists');
        }

        // Create index for barcode lookup (if not exists)
        console.log('Creating index for barcode lookup...');
        await execute('CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode)');
        console.log('✓ Created barcode index');

        console.log('\n✅ Barcode and expiry_date migration completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migrateBarcodeExpiry()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
