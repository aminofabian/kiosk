/**
 * Run all database migrations (including item_type CHECK removal, supplier_type, etc.).
 *
 * Ensure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set, e.g.:
 *   npx dotenv -e .env.local -- npx tsx scripts/run-migrations.ts
 * or export them before running.
 */
import { runMigrations } from '../lib/db/migrate';

async function main() {
  console.log('Running migrations...\n');
  await runMigrations();
  console.log('\nMigrations completed successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
