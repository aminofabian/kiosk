import { execute, query } from './index';

/**
 * Migration: Create count_shifts, count_batches, and count_item_pool tables
 * for the Department Stock Manager feature.
 */
export async function migrateCountShifts(): Promise<void> {
  console.log('🔄 Starting count shifts migration...');

  // Check if tables already exist
  const existingTables = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('count_shifts', 'count_batches', 'count_item_pool')`
  );
  const existingNames = new Set(existingTables.map((r) => r.name));

  // 1. Create count_shifts table
  if (!existingNames.has('count_shifts')) {
    console.log('Creating count_shifts table...');
    await execute(`
      CREATE TABLE count_shifts (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'counting', 'morning_complete', 'closed')),
        opened_at INTEGER NOT NULL DEFAULT (unixepoch()),
        closed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_shifts_business ON count_shifts(business_id, status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_shifts_user ON count_shifts(user_id, status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_shifts_department ON count_shifts(business_id, department, status)`);
    console.log('✅ count_shifts table created');
  } else {
    console.log('✓ count_shifts table already exists');
    await upgradeCountShiftsStatusConstraint();
  }

  // 2. Create count_batches table
  if (!existingNames.has('count_batches')) {
    console.log('Creating count_batches table...');
    await execute(`
      CREATE TABLE count_batches (
        id TEXT PRIMARY KEY,
        count_shift_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        morning_count REAL,
        morning_count_status TEXT NOT NULL DEFAULT 'pending' CHECK (morning_count_status IN ('pending', 'counted', 'not_located')),
        morning_counted_at INTEGER,
        system_stock_morning REAL NOT NULL DEFAULT 0,
        evening_count REAL,
        evening_count_status TEXT NOT NULL DEFAULT 'pending' CHECK (evening_count_status IN ('pending', 'counted', 'not_located')),
        evening_counted_at INTEGER,
        system_stock_evening REAL,
        variance_morning REAL,
        variance_evening REAL,
        variance_intraday REAL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'escalated', 'acknowledged')),
        escalation_notes TEXT,
        selection_source TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (count_shift_id) REFERENCES count_shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_batches_shift ON count_batches(count_shift_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_batches_item ON count_batches(item_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_batches_status ON count_batches(status)`);
    console.log('✅ count_batches table created');
  } else {
    console.log('✓ count_batches table already exists');
    await upgradeCountBatchesSelectionSource();
  }

  // 3. Create count_item_pool table
  if (!existingNames.has('count_item_pool')) {
    console.log('Creating count_item_pool table...');
    await execute(`
      CREATE TABLE count_item_pool (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        department TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        excluded INTEGER NOT NULL DEFAULT 0,
        last_selected_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE(business_id, item_id)
      )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_pool_business ON count_item_pool(business_id, department)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_count_pool_pinned ON count_item_pool(business_id, pinned)`);
    console.log('✅ count_item_pool table created');
  } else {
    console.log('✓ count_item_pool table already exists');
  }

  console.log('✅ Count shifts migration completed successfully!');
}

/** Add morning_complete to count_shifts.status CHECK when upgrading older DBs. */
async function upgradeCountShiftsStatusConstraint(): Promise<void> {
  const tableSql = await query<{ sql: string }>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='count_shifts'`,
  );
  const sql = tableSql[0]?.sql ?? '';
  if (sql.includes("'morning_complete'")) {
    return;
  }

  console.log('🔄 Upgrading count_shifts status constraint...');
  await execute(`
    CREATE TABLE count_shifts_new (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'counting', 'morning_complete', 'closed')),
      opened_at INTEGER NOT NULL DEFAULT (unixepoch()),
      closed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await execute(`
    INSERT INTO count_shifts_new
    SELECT id, business_id, user_id, department, status, opened_at, closed_at, created_at
    FROM count_shifts
  `);
  await execute(`DROP TABLE count_shifts`);
  await execute(`ALTER TABLE count_shifts_new RENAME TO count_shifts`);
  await execute(
    `CREATE INDEX IF NOT EXISTS idx_count_shifts_business ON count_shifts(business_id, status)`,
  );
  await execute(
    `CREATE INDEX IF NOT EXISTS idx_count_shifts_user ON count_shifts(user_id, status)`,
  );
  await execute(
    `CREATE INDEX IF NOT EXISTS idx_count_shifts_department ON count_shifts(business_id, department, status)`,
  );
  console.log('✅ count_shifts status constraint upgraded');
}

async function upgradeCountBatchesSelectionSource(): Promise<void> {
  const columns = await query<{ name: string }>(`PRAGMA table_info(count_batches)`);
  if (columns.some((c) => c.name === 'selection_source')) {
    return;
  }
  console.log('🔄 Adding selection_source to count_batches...');
  try {
    await execute(`ALTER TABLE count_batches ADD COLUMN selection_source TEXT`);
    console.log('✅ count_batches.selection_source added');
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message} ${(error as Error & { cause?: Error }).cause?.message ?? ''}`
        : String(error);
    if (message.includes('duplicate column')) {
      console.log('✓ count_batches.selection_source already exists');
      return;
    }
    throw error;
  }
}
