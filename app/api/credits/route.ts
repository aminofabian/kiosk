import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { CreditAccount } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const accounts = await query<CreditAccount>(
      `SELECT * FROM credit_accounts 
       WHERE business_id = ? 
       ORDER BY total_credit DESC, last_transaction_at DESC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch credits',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

