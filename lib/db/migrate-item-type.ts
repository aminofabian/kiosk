import { execute, query } from './index';

// Category names that should be classified as 'grocery'
const GROCERY_CATEGORIES = [
    'vegetables', 'fruits', 'grains & cereals', 'spices', 'green grocery',
    'dairy', 'meat', 'bakery', 'frozen foods', 'canned goods',
    // Common alternatives
    'veggies', 'produce', 'fresh produce', 'greens', 'herbs'
];

/**
 * Migration: Add item_type column to items table and item_type_snapshot to sale_items
 * 
 * Run with: npx tsx lib/db/migrate-item-type.ts
 */
export async function migrateItemType() {
    try {
        console.log('🔄 Starting item_type migration...');

        // Check if item_type column already exists in items table
        const itemsTableInfo = await query<{ name: string }>(
            "PRAGMA table_info(items)"
        );
        const itemsColumnNames = itemsTableInfo.map((col) => col.name);

        // Add item_type column to items if it doesn't exist
        if (!itemsColumnNames.includes('item_type')) {
            console.log('Adding item_type column to items table...');
            await execute("ALTER TABLE items ADD COLUMN item_type TEXT NOT NULL DEFAULT 'retail' CHECK (item_type IN ('grocery', 'retail'))");
            console.log('✓ Added item_type column');

            // Backfill grocery items based on category names
            console.log('Backfilling grocery items based on category names...');

            // Get all categories
            const categories = await query<{ id: string; name: string }>(
                'SELECT id, name FROM categories'
            );

            let groceryCategoryIds: string[] = [];
            for (const cat of categories) {
                const normalizedName = cat.name.toLowerCase().trim();
                if (GROCERY_CATEGORIES.some(g => normalizedName.includes(g) || g.includes(normalizedName))) {
                    groceryCategoryIds.push(cat.id);
                }
            }

            if (groceryCategoryIds.length > 0) {
                // Update items in grocery categories
                const placeholders = groceryCategoryIds.map(() => '?').join(',');
                await execute(
                    `UPDATE items SET item_type = 'grocery' WHERE category_id IN (${placeholders})`,
                    groceryCategoryIds
                );
                console.log(`✓ Marked items in ${groceryCategoryIds.length} categories as grocery`);
            } else {
                console.log('⚠ No grocery categories found to backfill');
            }
        } else {
            console.log('✓ item_type column already exists in items table');
        }

        // Create index for item_type if not exists
        console.log('Creating index for item_type lookup...');
        await execute('CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(business_id, item_type)');
        console.log('✓ Created item_type index');

        // Check if item_type_snapshot column already exists in sale_items table
        const saleItemsTableInfo = await query<{ name: string }>(
            "PRAGMA table_info(sale_items)"
        );
        const saleItemsColumnNames = saleItemsTableInfo.map((col) => col.name);

        // Add item_type_snapshot column to sale_items if it doesn't exist
        if (!saleItemsColumnNames.includes('item_type_snapshot')) {
            console.log('Adding item_type_snapshot column to sale_items table...');
            await execute("ALTER TABLE sale_items ADD COLUMN item_type_snapshot TEXT CHECK (item_type_snapshot IN ('grocery', 'retail'))");
            console.log('✓ Added item_type_snapshot column');

            // Backfill historical sale_items based on current item type
            console.log('Backfilling historical sale_items with item types...');
            await execute(`
        UPDATE sale_items 
        SET item_type_snapshot = (
          SELECT item_type FROM items WHERE items.id = sale_items.item_id
        )
        WHERE item_type_snapshot IS NULL
      `);
            console.log('✓ Backfilled historical sale_items');
        } else {
            console.log('✓ item_type_snapshot column already exists in sale_items table');
        }

        // Create index for item_type_snapshot if not exists
        console.log('Creating index for item_type_snapshot lookup...');
        await execute('CREATE INDEX IF NOT EXISTS idx_sale_items_type ON sale_items(item_type_snapshot)');
        console.log('✓ Created item_type_snapshot index');

        console.log('\n✅ Item type migration completed successfully!');

        // Show summary
        const itemTypeCounts = await query<{ item_type: string; count: number }>(
            'SELECT item_type, COUNT(*) as count FROM items GROUP BY item_type'
        );
        console.log('\n📊 Item type distribution:');
        for (const row of itemTypeCounts) {
            console.log(`   ${row.item_type}: ${row.count} items`);
        }

        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    migrateItemType()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
