import { readFileSync } from 'fs';
import { join } from 'path';
import { execute, query } from './index';
import { migrateItemVariants } from './migrate-item-variants';
import { migrateDomains } from './migrate-domains';
import { migratePasswordResetTokens } from './migrate-password-reset';

const SCHEMA_PATH = join(process.cwd(), 'lib', 'db', 'sql', 'schema.sql');

/**
 * Migration: Add 'restock' to stock_adjustments reason CHECK constraint
 * SQLite doesn't support ALTER TABLE to modify CHECK constraints, so we recreate the table
 */
async function migrateStockAdjustmentsReason() {
  try {
    // Check if table exists
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_adjustments'"
    );
    
    if (tableInfo.length === 0) {
      console.log('⚠ stock_adjustments table does not exist, will be created by schema');
      return;
    }

    const oldSql = tableInfo[0].sql;
    if (oldSql && oldSql.includes("'restock'")) {
      console.log('✓ stock_adjustments.reason already includes restock');
      return;
    }

    console.log('🔄 Migrating stock_adjustments table to add restock reason...');

    // Disable foreign keys temporarily
    await execute('PRAGMA foreign_keys = OFF');

    // Create new table with updated CHECK constraint
    await execute(`
      CREATE TABLE stock_adjustments_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        system_stock REAL NOT NULL,
        actual_stock REAL NOT NULL,
        difference REAL NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('restock', 'spoilage', 'theft', 'counting_error', 'damage', 'other')),
        notes TEXT,
        adjusted_by TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    // Copy data from old table
    await execute(`
      INSERT INTO stock_adjustments_new 
      SELECT * FROM stock_adjustments
    `);

    // Drop old table
    await execute('DROP TABLE stock_adjustments');

    // Rename new table
    await execute('ALTER TABLE stock_adjustments_new RENAME TO stock_adjustments');

    // Recreate indexes
    await execute('CREATE INDEX IF NOT EXISTS idx_stock_adjustments_business_id ON stock_adjustments(business_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(business_id, created_at DESC)');

    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    console.log('✅ Successfully migrated stock_adjustments table');
  } catch (error) {
    console.error('❌ Error migrating stock_adjustments:', error);
    // Re-enable foreign keys even on error
    await execute('PRAGMA foreign_keys = ON').catch(() => {});
    throw error;
  }
}

/**
 * Migration: Make source_breakdown_id nullable in inventory_batches
 * SQLite doesn't support ALTER COLUMN, so we recreate the table
 */
async function migrateInventoryBatchesNullable() {
  try {
    // Check if table exists and has the old constraint
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_batches'"
    );
    
    if (tableInfo.length === 0) {
      console.log('⚠ inventory_batches table does not exist, will be created by schema');
      return;
    }

    const oldSql = tableInfo[0].sql;
    if (oldSql && (oldSql.includes('source_breakdown_id TEXT,') || oldSql.includes('source_breakdown_id TEXT NULL'))) {
      console.log('✓ inventory_batches.source_breakdown_id is already nullable');
      return;
    }

    console.log('🔄 Migrating inventory_batches table to make source_breakdown_id nullable...');

    // Disable foreign keys temporarily
    await execute('PRAGMA foreign_keys = OFF');

    // Create new table with nullable source_breakdown_id
    await execute(`
      CREATE TABLE inventory_batches_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        source_breakdown_id TEXT,
        initial_quantity REAL NOT NULL,
        quantity_remaining REAL NOT NULL,
        buy_price_per_unit REAL NOT NULL,
        received_at INTEGER NOT NULL DEFAULT (unixepoch()),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (source_breakdown_id) REFERENCES purchase_breakdowns(id) ON DELETE RESTRICT
      )
    `);

    // Copy data from old table
    await execute(`
      INSERT INTO inventory_batches_new 
      SELECT * FROM inventory_batches
    `);

    // Drop old table
    await execute('DROP TABLE inventory_batches');

    // Rename new table
    await execute('ALTER TABLE inventory_batches_new RENAME TO inventory_batches');

    // Recreate indexes
    await execute('CREATE INDEX IF NOT EXISTS idx_inventory_batches_business_id ON inventory_batches(business_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON inventory_batches(item_id)');
    await execute('CREATE INDEX IF NOT EXISTS idx_inventory_batches_received_at ON inventory_batches(item_id, received_at ASC)');

    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    console.log('✅ Successfully migrated inventory_batches table');
  } catch (error) {
    console.error('❌ Error migrating inventory_batches:', error);
    // Re-enable foreign keys even on error
    await execute('PRAGMA foreign_keys = ON').catch(() => {});
    throw error;
  }
}

export async function runMigrations() {
  try {
    console.log('Reading schema file...');
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    
    // Remove comments and split by semicolons
    const lines = schema.split('\n');
    const cleanedLines: string[] = [];
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and full-line comments
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }
      
      // Remove inline comments
      const withoutComment = trimmed.split('--')[0].trim();
      if (withoutComment) {
        currentStatement += withoutComment + ' ';
        
        // If line ends with semicolon, we have a complete statement
        if (trimmed.endsWith(';')) {
          const statement = currentStatement.trim();
          if (statement) {
            cleanedLines.push(statement);
          }
          currentStatement = '';
        }
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      cleanedLines.push(currentStatement.trim());
    }

    console.log(`Found ${cleanedLines.length} SQL statements to execute`);

    // First, disable foreign key checks temporarily
    await execute('PRAGMA foreign_keys = OFF');
    
    // Execute each statement
    for (let i = 0; i < cleanedLines.length; i++) {
      const statement = cleanedLines[i];
      if (statement && !statement.startsWith('PRAGMA foreign_keys')) {
        try {
          await execute(statement);
          console.log(`✓ Executed statement ${i + 1}/${cleanedLines.length}`);
        } catch (error) {
          // Some statements like CREATE INDEX IF NOT EXISTS might fail if already exists
          if (error instanceof Error && 
              (error.message.includes('already exists') || 
               error.message.includes('duplicate column'))) {
            console.log(`⚠ Statement ${i + 1} skipped (already exists)`);
          } else {
            console.error(`✗ Error executing statement ${i + 1}:`, error);
            console.error(`Statement was: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }
      }
    }
    
    // Re-enable foreign keys
    await execute('PRAGMA foreign_keys = ON');

    // Run additional migrations AFTER schema is created
    console.log('Running additional migrations...');
    
    try {
      await migrateStockAdjustmentsReason();
    } catch (error) {
      console.error('⚠ stock_adjustments migration skipped:', error);
    }
    
    try {
      await migrateInventoryBatchesNullable();
    } catch (error) {
      console.error('⚠ inventory_batches migration skipped:', error);
    }
    
    try {
      await migrateItemVariants();
    } catch (error) {
      console.error('⚠ item_variants migration skipped:', error);
    }
    
    try {
      await migrateDomains();
    } catch (error) {
      console.error('⚠ domains migration skipped:', error);
    }

    try {
      await migratePasswordResetTokens();
    } catch (error) {
      console.error('⚠ password_reset_tokens migration skipped:', error);
    }

    console.log('✅ Migration completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// To run migrations, use the API route: /api/db/migrate
// Or import and call runMigrations() from a script

