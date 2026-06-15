import { execute, query } from './index';

export async function migrateUserDepartment(): Promise<void> {
  console.log('🔄 Adding department column to users...');

  const columns = await query<{ name: string }>(`PRAGMA table_info(users)`);
  const hasColumn = columns.some((c) => c.name === 'department');

  if (hasColumn) {
    console.log('✓ department column already exists on users');
    return;
  }

  await execute(`ALTER TABLE users ADD COLUMN department TEXT`);

  console.log('✅ Successfully added department column to users');
}
