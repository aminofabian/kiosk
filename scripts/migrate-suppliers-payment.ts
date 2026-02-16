/**
 * Run the suppliers payment fields migration (preferred_payment_method, payment_details).
 * Usage: npx tsx scripts/migrate-suppliers-payment.ts
 * Or:    bun run scripts/migrate-suppliers-payment.ts
 */
import { migrateSuppliersPayment } from '../lib/db/migrate-suppliers-payment';

async function main() {
  await migrateSuppliersPayment();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
