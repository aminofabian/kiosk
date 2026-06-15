import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { migrateSaleReturns } from '@/lib/db/migrate-sale-returns';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/** GET — list sale returns / refunds for admin */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_all_sales');
    if (isAuthResponse(auth)) return auth;

    await migrateSaleReturns();

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conditions = ['sr.business_id = ?'];
    const params: (string | number)[] = [auth.businessId];

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const startTs = Math.floor(new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000);
      const endTs = Math.floor(new Date(y, m - 1, d, 23, 59, 59, 999).getTime() / 1000);
      conditions.push('sr.created_at >= ?', 'sr.created_at <= ?');
      params.push(startTs, endTs);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const returns = await query<{
      id: string;
      sale_id: string;
      refund_method: string;
      total_refund_amount: number;
      reason: string;
      mpesa_reference: string | null;
      created_at: number;
      processor_name: string | null;
      customer_name: string | null;
      item_count: number;
    }>(
      `SELECT
        sr.id,
        sr.sale_id,
        sr.refund_method,
        sr.total_refund_amount,
        sr.reason,
        sr.mpesa_reference,
        sr.created_at,
        u.name AS processor_name,
        s.customer_name,
        (SELECT COUNT(*) FROM sale_return_items sri WHERE sri.return_id = sr.id) AS item_count
       FROM sale_returns sr
       LEFT JOIN users u ON u.id = sr.processed_by
       LEFT JOIN sales s ON s.id = sr.sale_id
       ${where}
       ORDER BY sr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sale_returns sr ${where}`,
      params
    );

    const sumRow = await query<{ total: number }>(
      `SELECT COALESCE(SUM(sr.total_refund_amount), 0) AS total FROM sale_returns sr ${where}`,
      params
    );

    return jsonResponse({
      success: true,
      data: {
        returns,
        total: totalRow[0]?.count ?? 0,
        totalRefunded: sumRow[0]?.total ?? 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error listing sale returns:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to load returns',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
