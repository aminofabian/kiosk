import { migrateExpensesOneTime } from '../lib/db/migrate-expenses-one-time';

async function run() {
  try {
    console.log('Running expenses one-time migration...');
    await migrateExpensesOneTime();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
