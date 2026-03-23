import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
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

    // Get cash from FULL cash sales (payment_method = 'cash' - entire sale is cash)
    const fullCashSales = await queryOne<{
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

    // Get cash from SPLIT payments (payment_method = 'split' - only the cash portion goes in drawer)
    // sale_payments stores each method's amount; we sum the cash portions only
    const splitCashSales = await queryOne<{
      count: number;
      total: number;
    }>(
      `SELECT 
        COUNT(DISTINCT s.id) as count,
        COALESCE(SUM(sp.amount), 0) as total
       FROM sale_payments sp
       JOIN sales s ON sp.sale_id = s.id
       WHERE s.shift_id = ? AND s.business_id = ? AND s.status = 'completed' 
         AND s.payment_method = 'split' AND sp.payment_method = 'cash'`,
      [shiftId, auth.businessId]
    );

    // Combine: total cash received from sales = full cash + cash portion of splits
    const fullCash = fullCashSales || { count: 0, total: 0 };
    const splitCash = splitCashSales || { count: 0, total: 0 };
    const salesSummary = {
      count: fullCash.count + splitCash.count,
      total: fullCash.total + splitCash.total,
    };

    // Get credit payments collected during this shift (cash payments only)
    // IMPORTANT: we scope by both business AND cashier (recorded_by) so that:
    // - Only payments recorded by this shift's user are counted for this drawer
    // - This stays consistent with how we update shift.expected_closing_cash
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
         AND ct.recorded_by = ?
         AND ct.type = 'payment'
         AND ct.payment_method = 'cash'
         AND ct.created_at >= ?
         AND ct.created_at <= ?`,
      [auth.businessId, shiftInfo.user_id, shiftInfo.started_at, endTime]
    );

    // Get cash expenses during this shift
    // Expenses are considered "today" based on created_at timestamp
    const cashExpensesSummary = await queryOne<{
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

    // Get detailed expenses list for this shift
    const expensesList = await query<{
      id: string;
      name: string;
      amount: number;
      category: string;
      created_at: number;
      created_by: string | null;
      notes: string | null;
    }>(
      `SELECT 
        id, name, amount, category, created_at, created_by, notes
       FROM expenses
       WHERE business_id = ?
         AND created_at >= ?
         AND created_at <= ?
         AND active = 1
       ORDER BY created_at DESC`,
      [auth.businessId, shiftInfo.started_at, endTime]
    );

    // Daily expenses only (e.g. lunch, petty cash) - not monthly rent/salaries
    // Only frequency='daily' with include_in_drawer=1 affects the drawer
    const dailyDrawerExpenses = await query<{ id: string; name: string; amount: number }>(
      `SELECT id, name, amount FROM expenses
       WHERE business_id = ? AND active = 1 AND frequency = 'daily'
         AND COALESCE(include_in_drawer, 1) = 1
       ORDER BY name`,
      [auth.businessId]
    );
    const dailyOperatingCost = dailyDrawerExpenses.reduce((sum, e) => sum + e.amount, 0);

    return jsonResponse({
      success: true,
      data: {
        sales: salesSummary,
        salesBreakdown: {
          fullCashSales: fullCash,
          splitCashSales: splitCash,
        },
        creditPayments: creditPayments || { count: 0, total: 0 },
        cashExpenses: cashExpensesSummary || { count: 0, total: 0 },
        expensesList: expensesList || [],
        dailyOperatingCost,
        dailyDrawerExpenses: dailyDrawerExpenses || [],
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
