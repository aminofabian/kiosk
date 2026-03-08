import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/batches/[id]
 * Get single batch with sales history
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
       ORDER BY s.sale_date DESC`,
      [batchId, auth.businessId]
    );

    const totals = await queryOne<{
      quantity_sold: number;
      revenue: number;
      profit: number;
    }>(
      `SELECT 
        COALESCE(SUM(quantity_sold), 0) as quantity_sold,
        COALESCE(SUM(quantity_sold * sell_price_per_unit), 0) as revenue,
        COALESCE(SUM(profit), 0) as profit
       FROM sale_items
       WHERE inventory_batch_id = ?`,
      [batchId]
    );

    return jsonResponse({
      success: true,
      data: {
        ...batch,
        salesHistory,
        quantity_sold: totals?.quantity_sold ?? 0,
        revenue: totals?.revenue ?? 0,
        profit: totals?.profit ?? 0,
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
