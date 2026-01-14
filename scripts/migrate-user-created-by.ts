/**
 * Migration: Add created_by column to users table
 * 
 * This migration adds audit logging for user creation by tracking
 * which user created each user account.
 * 
 * IMPORTANT: This script requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
 * to be set in your environment. You can either:
 * 
 * 1. Export them before running:
 *    export TURSO_DATABASE_URL="your-url"
 *    export TURSO_AUTH_TOKEN="your-token"
 *    npx tsx scripts/migrate-user-created-by.ts
 * 
 * 2. Or run with inline env vars:
 *    TURSO_DATABASE_URL="your-url" TURSO_AUTH_TOKEN="your-token" npx tsx scripts/migrate-user-created-by.ts
 * 
 * 3. Or source your .env file first (if using bash/zsh):
 *    set -a; source .env; set +a
 *    npx tsx scripts/migrate-user-created-by.ts
 */

import { execute, query } from '../lib/db';

async function migrate() {
  console.log('Starting migration: Add created_by column to users table...\n');

  try {
    // Check if column already exists
    const tableInfo = await query<{ name: string }>(
      `PRAGMA table_info(users)`
    );
    
    const columnExists = tableInfo.some(col => col.name === 'created_by');
    
    if (columnExists) {
      console.log('✓ Column "created_by" already exists. Skipping migration.');
      return;
    }

    // Add the created_by column
    console.log('Adding created_by column to users table...');
    await execute(`
      ALTER TABLE users ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('✓ Column added successfully!\n');
    console.log('Note: Existing users will have NULL for created_by.');
    console.log('New users created by admins/owners will have their creator logged.\n');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
