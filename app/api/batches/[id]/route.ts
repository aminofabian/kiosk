import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/batches/[id]?start=&end=
 * Single batch with sales history. Omit start/end for all-time completed sales.
 * With start & end (unix seconds, inclusive of end-of-day if client sends 23:59:59),
 * salesHistory and salesPeriod are filtered; quantity_sold / revenue / profit stay lifetime totals for the lot.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const { id: batchId } = await params;

    const batch = await queryOne<
      {
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
      }
    >(
      `SELECT 
        ib.*,
        i.name as item_name,
        i.unit_type as item_unit_type,
        s.name as supplier_name
       FROM inventory_batches ib
       JOIN items i ON ib.item_id = i.id
       LEFT JOIN suppliers s ON ib.supplier_id = s.id
       WHERE ib.id = ? AND ib.business_id = ?`,
      [batchId, auth.businessId]
    );

    if (!batch) {
      return jsonResponse({ success: false, message: 'Batch not found' }, 404);
    }

    const { searchParams } = request.nextUrl;
    const periodStart = parseInt(searchParams.get('start') || '0', 10);
    const periodEnd = parseInt(searchParams.get('end') || '0', 10);
    const hasPeriod =
      periodStart > 0 && periodEnd > 0 && periodEnd >= periodStart;

    const baseSaleJoin = `
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE si.inventory_batch_id = ?
         AND s.business_id = ?
         AND s.status = 'completed'`;

    const lifetimeTotals = await queryOne<{
      quantity_sold: number;
      revenue: number;
      profit: number;
    }>(
      `SELECT 
        COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
        COALESCE(SUM(si.profit), 0) as profit
       ${baseSaleJoin}`,
      [batchId, auth.businessId]
    );

    let periodTotals: {
      quantity_sold: number;
      revenue: number;
      profit: number;
    } | null = null;
    if (hasPeriod) {
      periodTotals = await queryOne<{
        quantity_sold: number;
        revenue: number;
        profit: number;
      }>(
        `SELECT 
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
          COALESCE(SUM(si.profit), 0) as profit
         ${baseSaleJoin}
           AND s.sale_date >= ?
           AND s.sale_date <= ?`,
        [batchId, auth.businessId, periodStart, periodEnd]
      );
    }

    const historyParams: (string | number)[] = [batchId, auth.businessId];
    let historyDateClause = '';
    if (hasPeriod) {
      historyDateClause = ' AND s.sale_date >= ? AND s.sale_date <= ?';
      historyParams.push(periodStart, periodEnd);
    }

    const salesHistory = await query<
      {
        sale_id: string;
        quantity_sold: number;
        sell_price_per_unit: number;
        profit: number;
        sale_date: number;
      }
    >(
      `SELECT si.sale_id, si.quantity_sold, si.sell_price_per_unit, si.profit, s.sale_date
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE si.inventory_batch_id = ? AND s.business_id = ?
         AND s.status = 'completed'
         ${historyDateClause}
       ORDER BY s.sale_date DESC`,
      historyParams
    );

    return jsonResponse({
      success: true,
      data: {
        ...batch,
        salesHistory,
        quantity_sold: lifetimeTotals?.quantity_sold ?? 0,
        revenue: lifetimeTotals?.revenue ?? 0,
        profit: lifetimeTotals?.profit ?? 0,
        salesPeriod: hasPeriod
          ? {
              start: periodStart,
              end: periodEnd,
              quantity_sold: periodTotals?.quantity_sold ?? 0,
              revenue: periodTotals?.revenue ?? 0,
              profit: periodTotals?.profit ?? 0,
            }
          : undefined,
      },
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch batch',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * PATCH /api/batches/[id]
 * Update batch status (deactivate / reactivate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    const { id: batchId } = await params;
    const body = await request.json();
    const { status } = body as { status?: string };

    if (!status || !['active', 'deactivated'].includes(status)) {
      return jsonResponse(
        { success: false, message: 'status must be "active" or "deactivated"' },
        400
      );
    }

    const existing = await queryOne<{
      id: string;
      status: string;
      quantity_remaining: number;
    }>(
      `SELECT id, status, quantity_remaining FROM inventory_batches
       WHERE id = ? AND business_id = ?`,
      [batchId, auth.businessId]
    );

    if (!existing) {
      return jsonResponse({ success: false, message: 'Batch not found' }, 404);
    }

    await execute(
      `UPDATE inventory_batches SET status = ? WHERE id = ? AND business_id = ?`,
      [status, batchId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: `Batch ${status === 'deactivated' ? 'deactivated' : 'reactivated'} successfully`,
      data: { batchId, status },
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update batch',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
