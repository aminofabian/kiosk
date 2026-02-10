import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Shift } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    // Admin/owner can request any open shift in the business (e.g. to close a cashier's shift)
    const forBusiness =
      scope === 'business' && (auth.role === 'admin' || auth.role === 'owner');

    const shift = forBusiness
      ? await queryOne<Shift>(
          `SELECT * FROM shifts 
           WHERE business_id = ? AND status = 'open'
           ORDER BY started_at DESC
           LIMIT 1`,
          [auth.businessId]
        )
      : await queryOne<Shift>(
          `SELECT * FROM shifts 
           WHERE business_id = ? AND user_id = ? AND status = 'open'
           ORDER BY started_at DESC
           LIMIT 1`,
          [auth.businessId, auth.userId]
        );

    return jsonResponse({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch current shift',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

