import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { BalanceApprovalRequest } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - List balance approval requests
// For admin/owner: show all pending requests
// For cashier: show their own pending requests
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let requests;

    if (auth.role === 'admin' || auth.role === 'owner') {
      // Admin/owner can see all requests
      requests = await query<BalanceApprovalRequest & {
        user_name: string;
        user_email: string;
        approver_name: string | null;
        shift_opening_cash: number | null;
        shift_started_at: number | null;
      }>(
        `SELECT 
          bar.*,
          u.name as user_name,
          u.email as user_email,
          a.name as approver_name,
          s.opening_cash as shift_opening_cash,
          s.started_at as shift_started_at
        FROM balance_approval_requests bar
        JOIN users u ON bar.user_id = u.id
        LEFT JOIN users a ON bar.approved_by = a.id
        LEFT JOIN shifts s ON bar.shift_id = s.id
        WHERE bar.business_id = ? AND bar.status = ?
        ORDER BY bar.created_at DESC`,
        [auth.businessId, status]
      );
    } else {
      // Cashier can only see their own requests
      requests = await query<BalanceApprovalRequest & {
        user_name: string;
        user_email: string;
        approver_name: string | null;
        shift_opening_cash: number | null;
        shift_started_at: number | null;
      }>(
        `SELECT 
          bar.*,
          u.name as user_name,
          u.email as user_email,
          a.name as approver_name,
          s.opening_cash as shift_opening_cash,
          s.started_at as shift_started_at
        FROM balance_approval_requests bar
        JOIN users u ON bar.user_id = u.id
        LEFT JOIN users a ON bar.approved_by = a.id
        LEFT JOIN shifts s ON bar.shift_id = s.id
        WHERE bar.business_id = ? AND bar.user_id = ? AND bar.status = ?
        ORDER BY bar.created_at DESC`,
        [auth.businessId, auth.userId, status]
      );
    }

    return jsonResponse({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching balance approval requests:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch balance approval requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// POST - Submit a balance approval request
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const {
      balanceType,
      amount,
      expectedAmount,
      shiftId,
      notes,
      denominations,
      cashExpenses,
    } = body;

    // Validate balance type
    if (!balanceType || !['opening', 'closing'].includes(balanceType)) {
      return jsonResponse(
        { success: false, message: 'Invalid balance type' },
        400
      );
    }

    // Validate amount
    if (amount === undefined || amount < 0) {
      return jsonResponse(
        { success: false, message: 'Valid amount is required' },
        400
      );
    }

    // For closing balance, verify shift exists
    if (balanceType === 'closing') {
      if (!shiftId) {
        return jsonResponse(
          { success: false, message: 'Shift ID is required for closing balance' },
          400
        );
      }

      const shift = await queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM shifts WHERE id = ? AND business_id = ? AND user_id = ?',
        [shiftId, auth.businessId, auth.userId]
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
    }

    // Check if there's already a pending request for this user and balance type
    const existingRequest = await queryOne<{ id: string }>(
      `SELECT id FROM balance_approval_requests 
       WHERE business_id = ? AND user_id = ? AND balance_type = ? AND status = 'pending'
       ${balanceType === 'closing' ? 'AND shift_id = ?' : ''}`,
      balanceType === 'closing'
        ? [auth.businessId, auth.userId, balanceType, shiftId]
        : [auth.businessId, auth.userId, balanceType]
    );

    if (existingRequest) {
      return jsonResponse(
        { success: false, message: 'You already have a pending balance request' },
        400
      );
    }

    const requestId = generateUUID();

    await execute(
      `INSERT INTO balance_approval_requests (
        id, business_id, shift_id, user_id, balance_type, amount, expected_amount,
        notes, status,
        denom_1, denom_5, denom_10, denom_20, denom_50,
        denom_100, denom_200, denom_500, denom_1000, cash_expenses
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        auth.businessId,
        shiftId || null,
        auth.userId,
        balanceType,
        amount,
        expectedAmount || null,
        notes || null,
        denominations?.denom_1 || 0,
        denominations?.denom_5 || 0,
        denominations?.denom_10 || 0,
        denominations?.denom_20 || 0,
        denominations?.denom_50 || 0,
        denominations?.denom_100 || 0,
        denominations?.denom_200 || 0,
        denominations?.denom_500 || 0,
        denominations?.denom_1000 || 0,
        cashExpenses || 0,
      ]
    );

    return jsonResponse({
      success: true,
      message: `${balanceType === 'opening' ? 'Opening' : 'Closing'} balance submitted for approval`,
      data: {
        requestId,
      },
    });
  } catch (error) {
    console.error('Error creating balance approval request:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to submit balance for approval',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
