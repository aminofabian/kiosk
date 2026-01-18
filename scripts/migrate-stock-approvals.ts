import { migrateStockApprovals } from '../lib/db/migrate-stock-approvals';

async function run() {
  try {
    console.log('Running stock approvals migration...');
    await migrateStockApprovals();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
