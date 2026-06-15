import { runMigrations } from '../lib/db/migrate';

async function main() {
  console.log('Running migrations...');
  await runMigrations();
  console.log('Migrations complete!');
}

main().catch(console.error);
