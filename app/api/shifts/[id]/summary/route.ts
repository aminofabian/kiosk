import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;

    // Get shift info first
    const shiftInfo = await queryOne<{
      started_at: number;
      ended_at: number | null;
      user_id: string;
    }>(
      'SELECT started_at, ended_at, user_id FROM shifts WHERE id = ? AND business_id = ?',
      [shiftId, auth.businessId]
    );

    if (!shiftInfo) {
      return jsonResponse(
        { success: false, message: 'Shift not found' },
        404
      );
    }

    const endTime = shiftInfo.ended_at || Math.floor(Date.now() / 1000);

    // Get cash sales summary (only cash payments count toward drawer)
    const salesSummary = await queryOne<{
      count: number;
      total: number;
    }>(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total
       FROM sales
       WHERE shift_id = ? AND business_id = ? AND status = 'completed' AND payment_method = 'cash'`,
      [shiftId, auth.businessId]
    );

    // Get credit payments collected during this shift (cash payments only)
    const creditPayments = await queryOne<{
      count: number;
      total: number;
    }>(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(ct.amount), 0) as total
       FROM credit_transactions ct
       JOIN credit_accounts ca ON ct.credit_account_id = ca.id
       WHERE ca.business_id = ?
         AND ct.type = 'payment'
         AND ct.payment_method = 'cash'
         AND ct.created_at >= ?
         AND ct.created_at <= ?`,
      [auth.businessId, shiftInfo.started_at, endTime]
    );

    // Get cash expenses during this shift
    // Expenses are considered "today" based on created_at timestamp
    const cashExpenses = await queryOne<{
      count: number;
      total: number;
    }>(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE business_id = ?
         AND created_at >= ?
         AND created_at <= ?
         AND active = 1`,
      [auth.businessId, shiftInfo.started_at, endTime]
    );

    return jsonResponse({
      success: true,
      data: {
        sales: salesSummary || { count: 0, total: 0 },
        creditPayments: creditPayments || { count: 0, total: 0 },
        cashExpenses: cashExpenses || { count: 0, total: 0 },
      },
    });
  } catch (error) {
    console.error('Error fetching shift summary:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch shift summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
