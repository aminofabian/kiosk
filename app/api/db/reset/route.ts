import { db } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { runMigrations } from '@/lib/db/migrate';

export async function OPTIONS() {
  return optionsResponse();
}

// GET also triggers reset for convenience during development
export async function GET() {
  return POST();
}

/**
 * POST /api/db/reset
 * 
 * WARNING: This will DELETE ALL DATA and recreate the database schema.
 * Only use this in development or when you need a complete fresh start.
 */
export async function POST() {
  try {
    console.log('🗑️ Starting database reset...');

    // Get all table names
    const tablesResult = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_libsql_%'`
    );

    const tables = tablesResult.rows.map(row => row.name as string);
    console.log(`Found ${tables.length} tables to drop:`, tables);

    // Drop each table
    for (const tableName of tables) {
      try {
        await db.execute(`DROP TABLE IF EXISTS "${tableName}"`);
        console.log(`✓ Dropped table: ${tableName}`);
      } catch (err) {
        console.warn(`⚠ Could not drop ${tableName}:`, err);
      }
    }

    console.log('🔄 Running migrations to recreate schema...');
    
    // Run migrations to recreate all tables
    await runMigrations();

    console.log('✅ Database reset complete!');

    return jsonResponse({
      success: true,
      message: 'Database reset complete. All data has been deleted and schema recreated.',
      instructions: [
        '1. Visit /superadmin/setup to create your super admin account',
        '2. Login at /superadmin/login',
        '3. Create your first business from the super admin panel',
        '4. Add a domain mapping for kiosk.ke → your business'
      ]
    });
  } catch (error) {
    console.error('Database reset error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Database reset failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
