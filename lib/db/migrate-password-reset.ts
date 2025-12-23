import { execute, query } from './index';

export async function migratePasswordResetTokens(): Promise<void> {
  try {
    const tableInfo = await query<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='password_reset_tokens'"
    );

    if (tableInfo.length > 0) {
      console.log('✓ password_reset_tokens table already exists');
      return;
    }

    console.log('🔄 Creating password_reset_tokens table...');

    await execute(`
      CREATE TABLE password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await execute(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)'
    );
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)'
    );
    await execute(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)'
    );

    console.log('✅ Successfully created password_reset_tokens table');
  } catch (error) {
    console.error('❌ Error creating password_reset_tokens table:', error);
    throw error;
  }
}

