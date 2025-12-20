import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import type { CreditAccount, CreditTransaction } from '@/lib/db/types';

// For Phase 4, we'll use hardcoded business ID
const DEMO_BUSINESS_ID = '8527dbc7-3229-489b-82a7-f8d11532acaa';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accountId = params.id;

    const account = await queryOne<CreditAccount>(
      `SELECT * FROM credit_accounts 
       WHERE id = ? AND business_id = ?`,
      [accountId, DEMO_BUSINESS_ID]
    );

    if (!account) {
      return jsonResponse(
        { success: false, message: 'Credit account not found' },
        404
      );
    }

    // Fetch all transactions for this account
    const transactions = await query<
      CreditTransaction & { user_name?: string; sale_id?: string }
    >(
      `SELECT 
        ct.*,
        u.name as user_name,
        s.id as sale_id
       FROM credit_transactions ct
       LEFT JOIN users u ON ct.recorded_by = u.id
       LEFT JOIN sales s ON ct.sale_id = s.id
       WHERE ct.credit_account_id = ?
       ORDER BY ct.created_at DESC`,
      [accountId]
    );

    return jsonResponse({
      success: true,
      data: {
        account,
        transactions,
      },
    });
  } catch (error) {
    console.error('Error fetching credit account:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch credit account',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

