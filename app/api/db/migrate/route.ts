import { runMigrations } from '@/lib/db/migrate';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

async function executeMigration() {
  const auth = await requireSuperAdmin();
  if (isAuthResponse(auth)) {
    return auth;
  }

  try {
    await runMigrations();
    return jsonResponse({
      success: true,
      message: 'Migration completed successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function GET() {
  return executeMigration();
}

export async function POST() {
  return executeMigration();
}

