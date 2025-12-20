import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import type { PaymentMethod } from '@/lib/constants';
import type { InValue } from '@libsql/client';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const startTimestamp = parseInt(searchParams.get('start') || '0');
    const endTimestamp = parseInt(searchParams.get('end') || '0');
    const paymentMethod = searchParams.get('paymentMethod');

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    let sql = `
      SELECT 
        s.id,
        s.sale_date,
        s.total_amount,
        s.payment_method,
        s.customer_name,
        u.name as user_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.business_id = ? 
        AND s.status = 'completed'
        AND s.sale_date >= ? 
        AND s.sale_date <= ?
    `;

    const params: InValue[] = [auth.businessId, startTimestamp, endTimestamp];

    if (paymentMethod && paymentMethod !== 'all') {
      sql += ' AND s.payment_method = ?';
      params.push(paymentMethod);
    }

    sql += ' ORDER BY s.sale_date DESC, s.created_at DESC';

    const sales = await query<{
      id: string;
      sale_date: number;
      total_amount: number;
      payment_method: PaymentMethod;
      customer_name: string | null;
      user_name: string | null;
      items_count: number;
    }>(sql, params);

    return jsonResponse({
      success: true,
      data: sales,
    });
  } catch (error) {
    console.error('Error fetching sales report:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch sales report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

