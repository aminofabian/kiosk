import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/batches
 * List batches with filters for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let sql = `
      SELECT 
        ib.id,
        ib.batch_number,
        ib.status,
        ib.supplier_id,
        ib.item_id,
        ib.initial_quantity,
        ib.quantity_remaining,
        ib.buy_price_per_unit,
        ib.received_at,
        ib.expiry_date,
        ib.created_at,
        i.name as item_name,
        i.unit_type as item_unit_type,
        s.name as supplier_name
      FROM inventory_batches ib
      JOIN items i ON ib.item_id = i.id
      LEFT JOIN suppliers s ON ib.supplier_id = s.id
      WHERE ib.business_id = ?
    `;
    const params: (string | number)[] = [auth.businessId];

    if (itemId) {
      sql += ` AND ib.item_id = ?`;
      params.push(itemId);
    }
    if (status) {
      sql += ` AND ib.status = ?`;
      params.push(status);
    }
    if (supplierId) {
      sql += ` AND ib.supplier_id = ?`;
      params.push(supplierId);
    }
    if (start) {
      sql += ` AND ib.received_at >= ?`;
      params.push(parseInt(start, 10));
    }
    if (end) {
      sql += ` AND ib.received_at <= ?`;
      params.push(parseInt(end, 10));
    }

    sql += ` ORDER BY ib.received_at DESC, ib.created_at DESC`;

    const batches = await query<{
      id: string;
      batch_number: string | null;
      status: string;
      supplier_id: string | null;
      item_id: string;
      initial_quantity: number;
      quantity_remaining: number;
      buy_price_per_unit: number;
      received_at: number;
      expiry_date: number | null;
      created_at: number;
      item_name: string;
      item_unit_type: string;
      supplier_name: string | null;
    }>(sql, params);

    // Get sold qty and profit per batch
    const batchIds = batches.map((b) => b.id);
    const salesData =
      batchIds.length > 0
        ? await query<{
            inventory_batch_id: string;
            quantity_sold: number;
            revenue: number;
            profit: number;
          }>(
            `SELECT 
              si.inventory_batch_id,
              SUM(si.quantity_sold) as quantity_sold,
              SUM(si.quantity_sold * si.sell_price_per_unit) as revenue,
              SUM(si.profit) as profit
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE si.inventory_batch_id IN (${batchIds.map(() => '?').join(',')})
               AND s.business_id = ?
               AND s.status = 'completed'
             GROUP BY si.inventory_batch_id`,
            [...batchIds, auth.businessId]
          )
        : [];

    const salesMap = new Map(
      salesData.map((s) => [
        s.inventory_batch_id,
        {
          quantity_sold: s.quantity_sold,
          revenue: s.revenue,
          profit: s.profit,
        },
      ])
    );

    const result = batches.map((b) => {
      const sales = salesMap.get(b.id);
      return {
        ...b,
        quantity_sold: sales?.quantity_sold ?? 0,
        revenue: sales?.revenue ?? 0,
        profit: sales?.profit ?? 0,
      };
    });

    return jsonResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch batches',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
