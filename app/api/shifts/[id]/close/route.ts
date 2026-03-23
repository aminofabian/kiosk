import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;
    const body = await request.json();
    const { actualClosingCash, cashExpenses, denominations } = body;

    if (actualClosingCash === undefined || actualClosingCash < 0) {
      return jsonResponse(
        { success: false, message: 'Actual closing cash is required' },
        400
      );
    }

    // Verify shift exists and is open
    const shift = await queryOne<{
      id: string;
      expected_closing_cash: number;
      status: string;
    }>(
      'SELECT id, expected_closing_cash, status FROM shifts WHERE id = ? AND business_id = ?',
      [shiftId, auth.businessId]
    );

    if (!shift) {
      return jsonResponse(
        { success: false, message: 'Shift not found' },
        404
      );
    }

    if (shift.status !== 'open') {
      return jsonResponse(
        { success: false, message: 'Shift is already closed' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Daily operating cost (lunch, etc.) - same as shift summary
    const dailyRows = await query<{ amount: number }>(
      `SELECT amount FROM expenses WHERE business_id = ? AND active = 1 AND frequency = 'daily' AND COALESCE(include_in_drawer, 1) = 1`,
      [auth.businessId]
    );
    const dailyOperatingCost = dailyRows.reduce((s, r) => s + r.amount, 0);

    // Expected = opening+in - withdrawals - daily expenses
    const expectedAfterExpenses = shift.expected_closing_cash - (cashExpenses || 0) - dailyOperatingCost;
    const cashDifference = actualClosingCash - expectedAfterExpenses;

    // Update shift with closing info and denominations
    await execute(
      `UPDATE shifts 
       SET status = 'closed',
           ended_at = ?,
           actual_closing_cash = ?,
           cash_difference = ?,
           cash_expenses = ?,
           closing_denom_1 = ?,
           closing_denom_5 = ?,
           closing_denom_10 = ?,
           closing_denom_20 = ?,
           closing_denom_40 = ?,
           closing_denom_50 = ?,
           closing_denom_100 = ?,
           closing_denom_200 = ?,
           closing_denom_500 = ?,
           closing_denom_1000 = ?
       WHERE id = ?`,
      [
        now,
        actualClosingCash,
        cashDifference,
        cashExpenses || 0,
        denominations?.denom_1 || 0,
        denominations?.denom_5 || 0,
        denominations?.denom_10 || 0,
        denominations?.denom_20 || 0,
        denominations?.denom_40 || 0,
        denominations?.denom_50 || 0,
        denominations?.denom_100 || 0,
        denominations?.denom_200 || 0,
        denominations?.denom_500 || 0,
        denominations?.denom_1000 || 0,
        shiftId,
      ]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'close',
      entityType: 'shift',
      entityId: shiftId,
      entityNameSnapshot: 'Shift closed',
      details: { actualClosingCash, cashDifference },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Shift closed successfully',
      data: {
        shiftId,
        cashDifference,
        expectedAfterExpenses,
      },
    });
  } catch (error) {
    console.error('Error closing shift:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to close shift',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
