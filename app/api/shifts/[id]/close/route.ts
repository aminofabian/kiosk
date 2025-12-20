import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
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

    const { id: shiftId } = await params;
    const body = await request.json();
    const { actualClosingCash } = body;

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
    const cashDifference = actualClosingCash - shift.expected_closing_cash;

    // Update shift
    await execute(
      `UPDATE shifts 
       SET status = 'closed',
           ended_at = ?,
           actual_closing_cash = ?,
           cash_difference = ?
       WHERE id = ?`,
      [now, actualClosingCash, cashDifference, shiftId]
    );

    return jsonResponse({
      success: true,
      message: 'Shift closed successfully',
      data: {
        shiftId,
        cashDifference,
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

