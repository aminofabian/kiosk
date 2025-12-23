import { migratePasswordResetTokens } from '../lib/db/migrate-password-reset';

async function main() {
  try {
    console.log('🔄 Running password reset tokens migration...');
    await migratePasswordResetTokens();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

