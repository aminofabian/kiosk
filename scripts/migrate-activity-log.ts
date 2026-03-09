import { migrateActivityLog } from '../lib/db/migrate-activity-log';

async function run() {
  try {
    console.log('Running activity_log migration...');
    await migrateActivityLog();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
