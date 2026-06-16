import { execute, query } from './index';

const SALES_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shift_id TEXT,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'credit', 'split')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'pending', 'discarded')),
  voided_reason TEXT,
  voided_by TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  sale_date INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
)`;

const SALES_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(business_id, sale_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(business_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_sales_user_pending ON sales(user_id, status)`,
];

async function tableExists(name: string): Promise<boolean> {
  const rows = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [name],
  );
  return rows.length > 0;
}

async function recreateSalesTable(): Promise<void> {
  console.log('Recreating missing sales table...');
  await execute('PRAGMA foreign_keys = OFF');
  try {
    await execute(SALES_TABLE_DDL);
    for (const idx of SALES_INDEXES) {
      await execute(idx);
    }
  } finally {
    await execute('PRAGMA foreign_keys = ON');
  }
}

/**
 * Recover from a failed table-swap migration (sales dropped but sales_new not renamed).
 */
async function recoverSalesTable(): Promise<void> {
  const hasSales = await tableExists('sales');
  const hasSalesNew = await tableExists('sales_new');

  if (hasSales && hasSalesNew) {
    console.log('Recovering from incomplete sales migration (both sales and sales_new exist)...');
    await execute('PRAGMA foreign_keys = OFF');
    try {
      await execute('DROP TABLE sales');
      await execute('ALTER TABLE sales_new RENAME TO sales');
      for (const idx of SALES_INDEXES) {
        await execute(idx);
      }
    } finally {
      await execute('PRAGMA foreign_keys = ON');
    }
    return;
  }

  if (hasSales) {
    return;
  }

  if (hasSalesNew) {
    console.log('Recovering sales table from sales_new...');
    await execute('PRAGMA foreign_keys = OFF');
    try {
      await execute('ALTER TABLE sales_new RENAME TO sales');
      for (const idx of SALES_INDEXES) {
        await execute(idx);
      }
    } finally {
      await execute('PRAGMA foreign_keys = ON');
    }
    return;
  }

  await recreateSalesTable();
}

async function migrateSalesStatusConstraint(): Promise<void> {
  const statusInfo = await query<{ sql: string }>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='sales'`,
  );

  if (statusInfo.length === 0) {
    return;
  }

  const currentSql = statusInfo[0].sql ?? '';
  const needsPending = !currentSql.includes("'pending'");
  const needsDiscarded = !currentSql.includes("'discarded'");
  if (!needsPending && !needsDiscarded) {
    console.log('sales status already allows pending and discarded');
    return;
  }

  console.log('Updating sales status constraint (pending/discarded)...');
  const columns = await query<{ name: string }>(`PRAGMA table_info(sales)`);
  const columnNames = new Set(columns.map((c) => c.name));
  const hasNewStatus = columnNames.has('new_status');

  if (await tableExists('sales_new')) {
    console.log('Cleaning up leftover sales_new before status migration...');
    await execute('PRAGMA foreign_keys = OFF');
    try {
      await execute('DROP TABLE sales_new');
    } finally {
      await execute('PRAGMA foreign_keys = ON');
    }
  }

  await execute('PRAGMA foreign_keys = OFF');
  try {
    if (!hasNewStatus) {
      await execute(
        `ALTER TABLE sales ADD COLUMN new_status TEXT NOT NULL DEFAULT 'completed'`,
      );
      await execute(`UPDATE sales SET new_status = status`);
    }

    await execute(`
      CREATE TABLE sales_new (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        shift_id TEXT,
        total_amount REAL NOT NULL,
        payment_method TEXT CHECK (payment_method IN ('cash', 'mpesa', 'credit', 'split')),
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'pending', 'discarded')),
        voided_reason TEXT,
        voided_by TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        sale_date INTEGER NOT NULL DEFAULT (unixepoch()),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
        FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await execute(`
      INSERT INTO sales_new (
        id, business_id, user_id, shift_id, total_amount, payment_method,
        status, voided_reason, voided_by, customer_name, customer_phone,
        sale_date, created_at, updated_at
      )
      SELECT
        id, business_id, user_id, shift_id, total_amount, payment_method,
        ${hasNewStatus ? 'new_status' : 'status'},
        voided_reason, voided_by, customer_name, customer_phone,
        sale_date, created_at, created_at
      FROM sales
    `);

    await execute(`DROP TABLE sales`);
    await execute(`ALTER TABLE sales_new RENAME TO sales`);

    for (const idx of SALES_INDEXES) {
      await execute(idx);
    }

    console.log('✅ Updated sales status constraint (pending/discarded)');
  } finally {
    await execute('PRAGMA foreign_keys = ON');
  }
}

async function ensureSalesUpdatedAt(): Promise<void> {
  if (!(await tableExists('sales'))) {
    return;
  }

  const columns = await query<{ name: string }>(`PRAGMA table_info(sales)`);
  const hasUpdatedAt = columns.some((c) => c.name === 'updated_at');
  if (!hasUpdatedAt) {
    console.log('Adding updated_at to sales...');
    const now = Math.floor(Date.now() / 1000);
    await execute(
      `ALTER TABLE sales ADD COLUMN updated_at INTEGER NOT NULL DEFAULT ${now}`,
    );
    await execute(`UPDATE sales SET updated_at = created_at WHERE updated_at = 0`);
  } else {
    console.log('updated_at already exists on sales');
  }
}

let pendingSalesMigration: Promise<void> | null = null;

async function runPendingSalesMigration(): Promise<void> {
  console.log('🔄 Starting pending sales migration...');

  await recoverSalesTable();
  await migrateSalesStatusConstraint();
  await ensureSalesUpdatedAt();

  if (await tableExists('sales')) {
    const indices = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sales_user_pending'`,
    );
    if (indices.length === 0) {
      await execute(`CREATE INDEX idx_sales_user_pending ON sales(user_id, status)`);
    }
  }

  console.log('✅ Pending sales migration completed');
}

/** Schema checks run once per server process — not on every checkout. */
export async function migratePendingSales(): Promise<void> {
  if (!pendingSalesMigration) {
    pendingSalesMigration = runPendingSalesMigration().catch((err) => {
      pendingSalesMigration = null;
      throw err;
    });
  }
  return pendingSalesMigration;
}
