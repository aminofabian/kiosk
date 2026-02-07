import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Shift } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;

    const shift = await queryOne<Shift>(
      `SELECT * FROM shifts WHERE id = ? AND business_id = ?`,
      [shiftId, auth.businessId]
    );

    if (!shift) {
      return jsonResponse(
        { success: false, message: 'Shift not found' },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error('Error fetching shift:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch shift',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: shiftId } = await params;
    const body = await request.json();

    const shift = await queryOne<{
      id: string;
      opening_cash: number;
      expected_closing_cash: number;
      actual_closing_cash: number | null;
      cash_difference: number | null;
      status: string;
      started_at: number;
      ended_at: number | null;
      cash_expenses?: number;
    }>(
      `SELECT 
        id,
        opening_cash,
        expected_closing_cash,
        actual_closing_cash,
        cash_difference,
        status,
        started_at,
        ended_at,
        COALESCE(cash_expenses, 0) as cash_expenses
       FROM shifts
       WHERE id = ? AND business_id = ?`,
      [shiftId, auth.businessId]
    );

    if (!shift) {
      return jsonResponse(
        { success: false, message: 'Shift not found' },
        404
      );
    }

    const updates: string[] = [];
    const values: (number | null)[] = [];

    // Editable: opening_cash
    if (body.openingCash !== undefined) {
      const openingCash = Number(body.openingCash);
      if (openingCash < 0 || !Number.isFinite(openingCash)) {
        return jsonResponse(
          { success: false, message: 'Opening cash must be a non-negative number' },
          400
        );
      }
      updates.push('opening_cash = ?');
      values.push(openingCash);

      // For open shifts, keep expected_closing_cash in sync (same delta)
      if (shift.status === 'open') {
        const delta = openingCash - shift.opening_cash;
        updates.push('expected_closing_cash = expected_closing_cash + ?');
        values.push(delta);
      }
    }

    // Editable: started_at (Unix seconds)
    if (body.startedAt !== undefined) {
      const startedAt = Number(body.startedAt);
      if (!Number.isInteger(startedAt) || startedAt <= 0) {
        return jsonResponse(
          { success: false, message: 'Started at must be a valid Unix timestamp' },
          400
        );
      }
      updates.push('started_at = ?');
      values.push(startedAt);
    }

    // For closed shifts only: actual_closing_cash, cash_expenses, ended_at, closing denominations
    let newActualClosingCash = shift.actual_closing_cash;
    let newCashExpenses = shift.cash_expenses ?? 0;

    if (shift.status === 'closed') {
      if (body.actualClosingCash !== undefined) {
        const actualClosingCash = Number(body.actualClosingCash);
        if (actualClosingCash < 0 || !Number.isFinite(actualClosingCash)) {
          return jsonResponse(
            { success: false, message: 'Actual closing cash must be a non-negative number' },
            400
          );
        }
        updates.push('actual_closing_cash = ?');
        values.push(actualClosingCash);
        newActualClosingCash = actualClosingCash;
      }

      if (body.cashExpenses !== undefined) {
        const cashExpenses = Number(body.cashExpenses);
        if (cashExpenses < 0 || !Number.isFinite(cashExpenses)) {
          return jsonResponse(
            { success: false, message: 'Cash expenses must be a non-negative number' },
            400
          );
        }
        updates.push('cash_expenses = ?');
        values.push(cashExpenses);
        newCashExpenses = cashExpenses;
      }

      if (body.endedAt !== undefined) {
        const endedAt = Number(body.endedAt);
        if (!Number.isInteger(endedAt) || endedAt <= 0) {
          return jsonResponse(
            { success: false, message: 'Ended at must be a valid Unix timestamp' },
            400
          );
        }
        updates.push('ended_at = ?');
        values.push(endedAt);
      }

      // Closing denominations (optional)
      if (body.closingDenominations) {
        const d = body.closingDenominations as Record<string, number>;
        const safe = (key: string) => Number(d[key] ?? 0) || 0;
        updates.push(
          'closing_denom_1 = ?,' +
          'closing_denom_5 = ?,' +
          'closing_denom_10 = ?,' +
          'closing_denom_20 = ?,' +
          'closing_denom_50 = ?,' +
          'closing_denom_100 = ?,' +
          'closing_denom_200 = ?,' +
          'closing_denom_500 = ?,' +
          'closing_denom_1000 = ?'
        );
        values.push(
          safe('denom_1'),
          safe('denom_5'),
          safe('denom_10'),
          safe('denom_20'),
          safe('denom_50'),
          safe('denom_100'),
          safe('denom_200'),
          safe('denom_500'),
          safe('denom_1000')
        );
      }
    }

    // Opening denominations (for any shift)
    if (body.openingDenominations) {
      const d = body.openingDenominations as Record<string, number>;
      const safe = (key: string) => Number(d[key] ?? 0) || 0;
      updates.push(
        'opening_denom_1 = ?,' +
        'opening_denom_5 = ?,' +
        'opening_denom_10 = ?,' +
        'opening_denom_20 = ?,' +
        'opening_denom_50 = ?,' +
        'opening_denom_100 = ?,' +
        'opening_denom_200 = ?,' +
        'opening_denom_500 = ?,' +
        'opening_denom_1000 = ?'
      );
      values.push(
        safe('denom_1'),
        safe('denom_5'),
        safe('denom_10'),
        safe('denom_20'),
        safe('denom_50'),
        safe('denom_100'),
        safe('denom_200'),
        safe('denom_500'),
        safe('denom_1000')
      );
    }

    // Recalculate cash_difference when we have closed shift and either actualClosingCash or cashExpenses changed
    if (
      shift.status === 'closed' &&
      newActualClosingCash !== null &&
      (body.actualClosingCash !== undefined || body.cashExpenses !== undefined)
    ) {
      const expectedAfterExpenses = shift.expected_closing_cash - newCashExpenses;
      const cashDifference = newActualClosingCash - expectedAfterExpenses;
      updates.push('cash_difference = ?');
      values.push(cashDifference);
    }

    if (updates.length === 0) {
      return jsonResponse(
        { success: false, message: 'No valid fields to update' },
        400
      );
    }

    values.push(shiftId);
    await execute(
      `UPDATE shifts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return jsonResponse({
      success: true,
      message: 'Shift updated successfully',
      data: { shiftId },
    });
  } catch (error) {
    console.error('Error updating shift:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update shift',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
