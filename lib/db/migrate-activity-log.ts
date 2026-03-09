import { execute, query } from './index';

/**
 * Migration: Create activity_log table for centralized audit trail
 * Records stock updates, supplier changes, item edits, and other mutations
 */
export async function migrateActivityLog() {
  try {
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='activity_log'"
    );

    if (tableInfo.length > 0) {
      console.log('✓ activity_log table already exists');
      return;
    }

    console.log('🔄 Creating activity_log table...');

    await execute(`
      CREATE TABLE activity_log (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        entity_name_snapshot TEXT,
        details TEXT,
        performed_by TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT
      )
    `);

    await execute(
      'CREATE INDEX IF NOT EXISTS idx_activity_log_business_id ON activity_log(business_id)'
    );
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(business_id, created_at DESC)'
    );
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(business_id, entity_type)'
    );

    console.log('✅ Successfully created activity_log table');
  } catch (error) {
    console.error('❌ Error creating activity_log table:', error);
    throw error;
  }
}
