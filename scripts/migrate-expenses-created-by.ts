import { migrateExpensesCreatedBy } from '../lib/db/migrate-expenses-created-by';

async function run() {
  try {
    console.log('Running expenses created_by migration...');
    await migrateExpensesCreatedBy();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
