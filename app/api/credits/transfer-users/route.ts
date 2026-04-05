import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { isAuthResponse, requireRole } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/** Active staff list for reassigning credit transaction recorders (owner + admin only). */
export async function GET() {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const users = await query<{ id: string; name: string; role: string }>(
      `SELECT id, name, role FROM users
       WHERE business_id = ? AND active = 1
       ORDER BY name ASC`,
      [auth.businessId]
    );

    return jsonResponse({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users for credit transfer:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to load staff list',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
