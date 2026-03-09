import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Shift } from '@/lib/db/types';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const shifts = await query<
      Shift & { user_name: string }
    >(
      `SELECT 
        s.*,
        u.name as user_name
       FROM shifts s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.business_id = ? 
       ORDER BY s.started_at DESC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: shifts,
    });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch shifts',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { openingCash, denominations } = body;

    if (openingCash === undefined || openingCash < 0) {
      return jsonResponse(
        { success: false, message: 'Opening cash is required' },
        400
      );
    }

    // Check if user already has an open shift
    const existingShift = await queryOne<{ id: string }>(
      `SELECT id FROM shifts 
       WHERE business_id = ? AND user_id = ? AND status = 'open'`,
      [auth.businessId, auth.userId]
    );

    if (existingShift) {
      return jsonResponse(
        { success: false, message: 'You already have an open shift' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const shiftId = generateUUID();

    // Create shift with denomination breakdown
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
        auth.userId,
        openingCash,
        openingCash, // Initially same as opening, will update with sales
        'open',
        now,
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
      ]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'open',
      entityType: 'shift',
      entityId: shiftId,
      entityNameSnapshot: `Shift opened`,
      details: { openingCash },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Shift opened successfully',
      data: {
        shiftId,
      },
    });
  } catch (error) {
    console.error('Error opening shift:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to open shift',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
