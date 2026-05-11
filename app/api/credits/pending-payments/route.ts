import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireRole, isAuthResponse } from '@/lib/auth/api-auth';

/**
 * GET /api/credits/pending-payments
 *
 * List all payment transactions that are pending admin approval.
 * Only available to owner and admin roles.
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requireRole(['owner', 'admin']);
    if (isAuthResponse(auth)) return auth;

    const pending = await query<{
      id: string;
      credit_account_id: string;
      customer_name: string;
      amount: number;
      payment_method: string | null;
      notes: string | null;
      recorded_by: string;
      recorder_name: string;
      recorder_role: string;
      created_at: number;
      customer_phone: string | null;
      total_credit: number;
    }>(
      `SELECT
        ct.id,
        ct.credit_account_id,
        ca.customer_name,
        ct.amount,
        ct.payment_method,
        ct.notes,
        ct.recorded_by,
        u.name AS recorder_name,
        u.role AS recorder_role,
        ct.created_at,
        ca.customer_phone,
        ca.total_credit
       FROM credit_transactions ct
       JOIN credit_accounts ca ON ct.credit_account_id = ca.id
       JOIN users u ON ct.recorded_by = u.id
       WHERE ct.type = 'payment'
         AND ct.payment_approval_status = 'pending'
         AND ca.business_id = ?
       ORDER BY ct.created_at DESC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: { pending },
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch pending payments',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
