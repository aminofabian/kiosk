import { execute, query } from './index';

/**
 * FTS5 index for item name / variant / parent name / barcode search.
 * Replaces full-table LIKE scans for POS and suggest endpoints.
 *
 * Run via POST /api/db/migrate or: npx tsx lib/db/migrate-items-fts.ts
 */
export async function migrateItemsFts(): Promise<boolean> {
  try {
    console.log('🔄 Starting items_fts migration...');

    const existing = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'items_fts'`
    );
    if (existing.length > 0) {
      console.log('✓ items_fts already exists');
      return true;
    }

    await execute(`
      CREATE VIRTUAL TABLE items_fts USING fts5(
        item_id UNINDEXED,
        business_id UNINDEXED,
        body,
        prefix='2 3 4',
        tokenize='unicode61 remove_diacritics 1'
      )
    `);

    await execute(`
      CREATE TRIGGER items_fts_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(item_id, business_id, body)
        SELECT NEW.id, NEW.business_id,
          lower(trim(NEW.name)) || ' ' || lower(trim(coalesce(NEW.variant_name, ''))) || ' ' ||
          lower(trim(coalesce((SELECT name FROM items WHERE id = NEW.parent_item_id), ''))) || ' ' ||
          lower(trim(coalesce(NEW.barcode, '')))
        WHERE NEW.active = 1;
      END
    `);

    await execute(`
      CREATE TRIGGER items_fts_au AFTER UPDATE ON items BEGIN
        DELETE FROM items_fts WHERE item_id = OLD.id;
        INSERT INTO items_fts(item_id, business_id, body)
        SELECT NEW.id, NEW.business_id,
          lower(trim(NEW.name)) || ' ' || lower(trim(coalesce(NEW.variant_name, ''))) || ' ' ||
          lower(trim(coalesce((SELECT name FROM items WHERE id = NEW.parent_item_id), ''))) || ' ' ||
          lower(trim(coalesce(NEW.barcode, '')))
        WHERE NEW.active = 1;
      END
    `);

    await execute(`
      CREATE TRIGGER items_fts_ad AFTER DELETE ON items BEGIN
        DELETE FROM items_fts WHERE item_id = OLD.id;
      END
    `);

    await execute(`
      CREATE TRIGGER items_fts_parent_name_au AFTER UPDATE OF name ON items
      WHEN OLD.parent_item_id IS NULL
      BEGIN
        DELETE FROM items_fts WHERE item_id IN (
          SELECT id FROM items WHERE parent_item_id = NEW.id AND active = 1
        );
        INSERT INTO items_fts(item_id, business_id, body)
        SELECT c.id, c.business_id,
          lower(trim(c.name)) || ' ' || lower(trim(coalesce(c.variant_name, ''))) || ' ' ||
          lower(trim(NEW.name)) || ' ' ||
          lower(trim(coalesce(c.barcode, '')))
        FROM items c
        WHERE c.parent_item_id = NEW.id AND c.active = 1;
      END
    `);

    const tableInfo = await query<{ name: string }>('PRAGMA table_info(items)');
    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has('barcode')) {
      console.log('⚠ items.barcode missing; FTS triggers reference barcode — run migrateBarcodeExpiry first');
    }

    await execute(`
      INSERT INTO items_fts(item_id, business_id, body)
      SELECT i.id, i.business_id,
        lower(trim(i.name)) || ' ' || lower(trim(coalesce(i.variant_name, ''))) || ' ' ||
        lower(trim(coalesce(p.name, ''))) || ' ' ||
        lower(trim(coalesce(i.barcode, '')))
      FROM items i
      LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
      WHERE i.active = 1
    `);

    await execute(
      `CREATE INDEX IF NOT EXISTS idx_items_business_barcode ON items(business_id, barcode) WHERE barcode IS NOT NULL AND length(trim(barcode)) > 0`
    );

    console.log('✅ items_fts migration completed');
    return true;
  } catch (error) {
    console.error('❌ items_fts migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateItemsFts()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
