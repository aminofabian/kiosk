import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

type LastClosedShift = {
  id: string;
  closing_denom_1: number;
  closing_denom_5: number;
  closing_denom_10: number;
  closing_denom_20: number;
  closing_denom_50: number;
  closing_denom_100: number;
  closing_denom_200: number;
  closing_denom_500: number;
  closing_denom_1000: number;
};

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const shift = await queryOne<LastClosedShift>(
      `SELECT id,
        closing_denom_1, closing_denom_5, closing_denom_10, closing_denom_20,
        closing_denom_50, closing_denom_100, closing_denom_200, closing_denom_500, closing_denom_1000
       FROM shifts
       WHERE business_id = ? AND user_id = ? AND status = 'closed'
       ORDER BY ended_at DESC
       LIMIT 1`,
      [auth.businessId, auth.userId]
    );

    return jsonResponse({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error('Error fetching last closed shift:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch last closed shift',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
