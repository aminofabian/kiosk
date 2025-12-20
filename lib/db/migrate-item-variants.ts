import { execute, query } from '@/lib/db';

/**
 * Migration to add variant support to items table
 * Adds parent_item_id and variant_name columns
 */
export async function migrateItemVariants(): Promise<void> {
  console.log('🔄 Starting item variants migration...');

  // Check if columns already exist
  const tableInfo = await query<{ name: string }>(
    `PRAGMA table_info(items)`
  );

  const columnNames = tableInfo.map((col) => col.name);
  const hasParentItemId = columnNames.includes('parent_item_id');
  const hasVariantName = columnNames.includes('variant_name');

  if (hasParentItemId && hasVariantName) {
    console.log('✅ Item variants columns already exist');
    return;
  }

  // Add parent_item_id column if missing
  if (!hasParentItemId) {
    console.log('Adding parent_item_id column...');
    await execute(`ALTER TABLE items ADD COLUMN parent_item_id TEXT`);
  }

  // Add variant_name column if missing
  if (!hasVariantName) {
    console.log('Adding variant_name column...');
    await execute(`ALTER TABLE items ADD COLUMN variant_name TEXT`);
  }

  // Create index for parent_item_id if it doesn't exist
  try {
    await execute(`CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_item_id)`);
  } catch {
    // Index might already exist
  }

  console.log('✅ Item variants migration completed successfully');
}
