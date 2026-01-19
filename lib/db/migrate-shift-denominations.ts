import { execute } from './index';

export async function migrateShiftDenominations() {
  console.log('Running shift denominations migration...');

  // Add denomination columns for opening cash
  const openingColumns = [
    'opening_denom_1',
    'opening_denom_5',
    'opening_denom_10',
    'opening_denom_20',
    'opening_denom_50',
    'opening_denom_100',
    'opening_denom_200',
    'opening_denom_500',
    'opening_denom_1000',
  ];

  // Add denomination columns for closing cash
  const closingColumns = [
    'closing_denom_1',
    'closing_denom_5',
    'closing_denom_10',
    'closing_denom_20',
    'closing_denom_50',
    'closing_denom_100',
    'closing_denom_200',
    'closing_denom_500',
    'closing_denom_1000',
  ];

  // Add cash_expenses column to track expenses during shift
  try {
    await execute(`ALTER TABLE shifts ADD COLUMN cash_expenses REAL DEFAULT 0`);
    console.log('  Added cash_expenses column');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('duplicate column')) {
      console.log('  cash_expenses column already exists');
    } else {
      throw error;
    }
  }

  // Add opening denomination columns
  for (const col of openingColumns) {
    try {
      await execute(`ALTER TABLE shifts ADD COLUMN ${col} INTEGER DEFAULT 0`);
      console.log(`  Added ${col} column`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('duplicate column')) {
        console.log(`  ${col} column already exists`);
      } else {
        throw error;
      }
    }
  }

  // Add closing denomination columns
  for (const col of closingColumns) {
    try {
      await execute(`ALTER TABLE shifts ADD COLUMN ${col} INTEGER DEFAULT 0`);
      console.log(`  Added ${col} column`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('duplicate column')) {
        console.log(`  ${col} column already exists`);
      } else {
        throw error;
      }
    }
  }

  console.log('Shift denominations migration complete!');
}
