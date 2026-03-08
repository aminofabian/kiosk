import { execute, query } from './index';

/**
 * Migration: Add batch_number, status, supplier_id, expiry_date to inventory_batches
 * Also adds product_code to items for batch numbering
 *
 * Run via: lib/db/migrate.ts (or npx tsx lib/db/migrate-batch-tracking.ts)
 */
export async function migrateBatchTracking() {
  try {
    console.log('🔄 Starting batch tracking migration...');

    // 1. Check inventory_batches columns
    const batchTableInfo = await query<{ name: string }>(
      'PRAGMA table_info(inventory_batches)'
    );
    const batchColumns = batchTableInfo.map((c) => c.name);

    // Add batch_number if missing
    if (!batchColumns.includes('batch_number')) {
      console.log('Adding batch_number column to inventory_batches...');
      await execute('ALTER TABLE inventory_batches ADD COLUMN batch_number TEXT');
      console.log('✓ Added batch_number');
    } else {
      console.log('✓ batch_number already exists');
    }

    // Add status if missing
    if (!batchColumns.includes('status')) {
      console.log('Adding status column to inventory_batches...');
      await execute(
        "ALTER TABLE inventory_batches ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
      );
      console.log('✓ Added status');
    } else {
      console.log('✓ status already exists');
    }

    // Add supplier_id if missing
    if (!batchColumns.includes('supplier_id')) {
      console.log('Adding supplier_id column to inventory_batches...');
      await execute(
        'ALTER TABLE inventory_batches ADD COLUMN supplier_id TEXT'
      );
      console.log('✓ Added supplier_id');
    } else {
      console.log('✓ supplier_id already exists');
    }

    // Add expiry_date if missing
    if (!batchColumns.includes('expiry_date')) {
      console.log('Adding expiry_date column to inventory_batches...');
      await execute(
        'ALTER TABLE inventory_batches ADD COLUMN expiry_date INTEGER'
      );
      console.log('✓ Added expiry_date');
    } else {
      console.log('✓ expiry_date already exists');
    }

    // 2. Add product_code to items if missing
    const itemTableInfo = await query<{ name: string }>(
      'PRAGMA table_info(items)'
    );
    const itemColumns = itemTableInfo.map((c) => c.name);

    if (!itemColumns.includes('product_code')) {
      console.log('Adding product_code column to items...');
      await execute('ALTER TABLE items ADD COLUMN product_code TEXT');
      console.log('✓ Added product_code');
    } else {
      console.log('✓ product_code already exists');
    }

    // 3. Backfill existing inventory_batches
    const batchesNeedingBackfill = await query<{
      id: string;
      batch_number: string | null;
      quantity_remaining: number;
      source_breakdown_id: string | null;
      received_at: number;
      item_id: string;
    }>(
      `SELECT id, batch_number, quantity_remaining, source_breakdown_id, received_at, item_id
       FROM inventory_batches
       WHERE batch_number IS NULL OR batch_number = ''`
    );

    if (batchesNeedingBackfill.length > 0) {
      console.log(
        `Backfilling ${batchesNeedingBackfill.length} existing batch(es)...`
      );

      for (let i = 0; i < batchesNeedingBackfill.length; i++) {
        const b = batchesNeedingBackfill[i];
        const dateStr = new Date(b.received_at * 1000)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, '');
        const seq = String(i + 1).padStart(2, '0');
        const batchNumber = `LEGACY-${dateStr}-${seq}`;
        const status =
          b.quantity_remaining <= 0 ? 'depleted' : 'active';

        await execute(
          `UPDATE inventory_batches SET batch_number = ?, status = ? WHERE id = ?`,
          [batchNumber, status, b.id]
        );
      }

      // Backfill supplier_id from purchase_breakdowns -> purchase_items -> purchases
      await execute(`
        UPDATE inventory_batches
        SET supplier_id = (
          SELECT p.supplier_id
          FROM purchase_breakdowns pb
          JOIN purchase_items pi ON pb.purchase_item_id = pi.id
          JOIN purchases p ON pi.purchase_id = p.id
          WHERE pb.id = inventory_batches.source_breakdown_id
        )
        WHERE source_breakdown_id IS NOT NULL
          AND (supplier_id IS NULL OR supplier_id = '')
      `);

      console.log('✓ Backfill complete');
    } else {
      console.log('✓ No batches need backfill');
    }

    // 4. Create index for status (for FIFO filtering)
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON inventory_batches(item_id, status, received_at)'
    );
    console.log('✓ Created status index');

    console.log('✅ Batch tracking migration completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Batch tracking migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrateBatchTracking()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
