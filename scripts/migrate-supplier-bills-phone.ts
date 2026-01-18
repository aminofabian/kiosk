import { migrateSupplierBillsPhone } from '../lib/db/migrate-supplier-bills-phone';

async function run() {
  try {
    console.log('Running supplier bills phone migration...');
    await migrateSupplierBillsPhone();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
