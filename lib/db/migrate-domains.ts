import { execute, query } from './index';

export async function migrateDomains(): Promise<void> {
  console.log('🔄 Starting domains table migration...');

  const tableInfo = await query<{ name: string }>(
    `PRAGMA table_info(domains)`
  );

  if (tableInfo.length > 0) {
    console.log('✅ domains table already exists');
    return;
  }

  console.log('Creating domains table...');

  await execute(`
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      business_id TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_domains_business_id ON domains(business_id)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_domains_active ON domains(domain, active)`);

  console.log('✅ Domains table migration completed');
}
