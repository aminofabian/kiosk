import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

type ShiftRow = {
  id: string;
  user_id: string;
  user_name: string;
  started_at: number;
  ended_at: number | null;
  status: string;
  opening_cash: number;
  expected_closing_cash: number;
  actual_closing_cash: number | null;
};

/**
 * GET /api/shifts/drawers
 * Returns all open shifts (drawers) plus recently closed shifts with cash amounts.
 */
export async function GET() {
  try {
    // Only admin/owner (view_profit permission) should see drawer-level summaries
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    // All open shifts (no LIMIT – every open drawer)
    const openShifts = await query<ShiftRow>(
      `SELECT 
        s.id,
        s.user_id,
        u.name as user_name,
        s.started_at,
        s.ended_at,
        s.status,
        s.opening_cash,
        s.expected_closing_cash,
        s.actual_closing_cash
       FROM shifts s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.business_id = ? AND s.status = 'open'
       ORDER BY s.started_at ASC`,
      [auth.businessId]
    );

    // Recently closed shifts (ended in last 7 days) so we show all drawers used
    const closedFrom = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const closedShifts = await query<ShiftRow>(
      `SELECT 
        s.id,
        s.user_id,
        u.name as user_name,
        s.started_at,
        s.ended_at,
        s.status,
        s.opening_cash,
        s.expected_closing_cash,
        s.actual_closing_cash
       FROM shifts s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.business_id = ? AND s.status = 'closed' AND s.ended_at >= ?
       ORDER BY s.ended_at DESC`,
      [auth.businessId, closedFrom]
    );

    const drawers = openShifts.map((s) => ({
      shiftId: s.id,
      userId: s.user_id,
      cashierName: s.user_name || 'Unknown',
      openedAt: s.started_at,
      endedAt: null as number | null,
      status: 'open' as const,
      openingCash: s.opening_cash,
      expectedCash: s.expected_closing_cash,
      actualClosingCash: null as number | null,
    }));

    const closed = closedShifts.map((s) => ({
      shiftId: s.id,
      userId: s.user_id,
      cashierName: s.user_name || 'Unknown',
      openedAt: s.started_at,
      endedAt: s.ended_at,
      status: 'closed' as const,
      openingCash: s.opening_cash,
      expectedCash: s.expected_closing_cash,
      actualClosingCash: s.actual_closing_cash,
    }));

    return jsonResponse({
      success: true,
      data: { drawers, closed },
    });
  } catch (error) {
    console.error('Error fetching drawers:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch drawers',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
