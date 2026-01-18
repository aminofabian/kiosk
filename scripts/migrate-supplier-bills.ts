import { migrateSupplierBills } from '../lib/db/migrate-supplier-bills';

async function run() {
  try {
    console.log('Running supplier bills migration...');
    await migrateSupplierBills();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();
