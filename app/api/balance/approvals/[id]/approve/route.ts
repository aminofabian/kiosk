import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

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

    // Only admin and owner can approve requests
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id } = await params;

    // Get the approval request
    const approvalRequest = await queryOne<{
      id: string;
      business_id: string;
      shift_id: string | null;
      user_id: string;
      balance_type: 'opening' | 'closing';
      amount: number;
      expected_amount: number | null;
      status: string;
      denom_1: number;
      denom_5: number;
      denom_10: number;
      denom_20: number;
      denom_40: number;
      denom_50: number;
      denom_100: number;
      denom_200: number;
      denom_500: number;
      denom_1000: number;
      cash_expenses: number;
    }>(
      `SELECT * FROM balance_approval_requests 
       WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!approvalRequest) {
      return jsonResponse(
        { success: false, message: 'Approval request not found' },
        404
      );
    }

    if (approvalRequest.status !== 'pending') {
      return jsonResponse(
        { success: false, message: 'Request has already been processed' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update approval request status
    await execute(
      `UPDATE balance_approval_requests 
       SET status = 'approved', approved_by = ?, approved_at = ?
       WHERE id = ?`,
      [auth.userId, now, id]
    );

    // Process based on balance type
    if (approvalRequest.balance_type === 'opening') {
      // Check if user already has an open shift
      const existingShift = await queryOne<{ id: string }>(
        `SELECT id FROM shifts 
         WHERE business_id = ? AND user_id = ? AND status = 'open'`,
        [auth.businessId, approvalRequest.user_id]
      );

      if (existingShift) {
        return jsonResponse(
          { success: false, message: 'User already has an open shift' },
          400
        );
      }

      // Create the shift with approved opening balance
      const shiftId = generateUUID();
      await execute(
        `INSERT INTO shifts (
          id, business_id, user_id, opening_cash, expected_closing_cash,
          status, started_at,
          opening_denom_1, opening_denom_5, opening_denom_10, opening_denom_20, opening_denom_40,
          opening_denom_50, opening_denom_100, opening_denom_200, opening_denom_500, opening_denom_1000
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shiftId,
          auth.businessId,
          approvalRequest.user_id,
          approvalRequest.amount,
          approvalRequest.amount, // Initially same as opening
          'open',
          now,
          approvalRequest.denom_1,
          approvalRequest.denom_5,
          approvalRequest.denom_10,
          approvalRequest.denom_20,
          approvalRequest.denom_40,
          approvalRequest.denom_50,
          approvalRequest.denom_100,
          approvalRequest.denom_200,
          approvalRequest.denom_500,
          approvalRequest.denom_1000,
        ]
      );

      // Update the approval request with the shift ID
      await execute(
        `UPDATE balance_approval_requests SET shift_id = ? WHERE id = ?`,
        [shiftId, id]
      );

      return jsonResponse({
        success: true,
        message: 'Opening balance approved and shift created',
        data: {
          shiftId,
          openingCash: approvalRequest.amount,
        },
      });
    } else {
      // Closing balance - close the shift
      if (!approvalRequest.shift_id) {
        return jsonResponse(
          { success: false, message: 'Shift ID not found in request' },
          400
        );
      }

      const shift = await queryOne<{
        id: string;
        expected_closing_cash: number;
        status: string;
      }>(
        'SELECT id, expected_closing_cash, status FROM shifts WHERE id = ? AND business_id = ?',
        [approvalRequest.shift_id, auth.businessId]
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

      // Expected = opening+in - withdrawals - daily expenses
      // Use expected_amount from request when provided (includes daily expenses); else recalc with daily
      let expectedAfterExpenses: number;
      if (approvalRequest.expected_amount != null) {
        expectedAfterExpenses = approvalRequest.expected_amount;
      } else {
        const dailyRows = await query<{ amount: number }>(
          `SELECT amount FROM expenses WHERE business_id = ? AND active = 1 AND frequency = 'daily' AND COALESCE(include_in_drawer, 1) = 1`,
          [auth.businessId]
        );
        const dailyOperatingCost = dailyRows.reduce((s, r) => s + r.amount, 0);
        expectedAfterExpenses = shift.expected_closing_cash - (approvalRequest.cash_expenses || 0) - dailyOperatingCost;
      }
      const cashDifference = approvalRequest.amount - expectedAfterExpenses;

      // Close the shift
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
          approvalRequest.amount,
          cashDifference,
          approvalRequest.cash_expenses || 0,
          approvalRequest.denom_1,
          approvalRequest.denom_5,
          approvalRequest.denom_10,
          approvalRequest.denom_20,
          approvalRequest.denom_40,
          approvalRequest.denom_50,
          approvalRequest.denom_100,
          approvalRequest.denom_200,
          approvalRequest.denom_500,
          approvalRequest.denom_1000,
          approvalRequest.shift_id,
        ]
      );

      return jsonResponse({
        success: true,
        message: 'Closing balance approved and shift closed',
        data: {
          shiftId: approvalRequest.shift_id,
          actualClosingCash: approvalRequest.amount,
          cashDifference,
        },
      });
    }
  } catch (error) {
    console.error('Error approving balance request:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to approve balance request',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
