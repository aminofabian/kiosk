import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/sales/summary?start=unix&end=unix
 * Returns total revenue and transaction count for completed sales in the date range.
 * sale_date is stored in Unix seconds; start/end are inclusive.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const startRaw = searchParams.get('start');
    const endRaw = searchParams.get('end');

    const start = startRaw ? parseInt(startRaw, 10) : 0;
    const end = endRaw ? parseInt(endRaw, 10) : Math.ceil(Date.now() / 1000);

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
      return jsonResponse(
        { success: false, message: 'Valid start and end (Unix seconds) are required' },
        400
      );
    }

    const row = await queryOne<{ total_revenue: number; total_transactions: number }>(
      `SELECT 
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COUNT(DISTINCT s.id) as total_transactions
       FROM sales s
       WHERE s.business_id = ? AND s.status = 'completed'
         AND s.sale_date >= ? AND s.sale_date <= ?`,
      [auth.businessId, start, end]
    );

    return jsonResponse({
      success: true,
      data: {
        totalRevenue: row?.total_revenue ?? 0,
        totalTransactions: row?.total_transactions ?? 0,
        start,
        end,
      },
    });
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch sales summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
