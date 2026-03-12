import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/items/[id]/supplier-costs
 * Returns supplier-specific cost prices for an item: default cost from supplier_products
 * and last buy price from inventory_batches.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;

    // Verify item belongs to this business
    const item = await query<{ id: string }>(
      `SELECT id FROM items WHERE id = ? AND business_id = ?`,
      [itemId, auth.businessId]
    );
    if (item.length === 0) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    const rows = await query<{
      supplier_id: string;
      supplier_name: string;
      default_cost_price: number | null;
      last_buy_price: number | null;
    }>(
      `SELECT 
        sp.supplier_id,
        s.name as supplier_name,
        sp.default_cost_price,
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = ? AND ib.supplier_id = sp.supplier_id AND ib.business_id = ?
         ORDER BY ib.created_at DESC 
         LIMIT 1) as last_buy_price
      FROM supplier_products sp
      JOIN suppliers s ON sp.supplier_id = s.id AND s.business_id = ?
      WHERE sp.item_id = ? AND s.active = 1
      ORDER BY s.name ASC`,
      [itemId, auth.businessId, auth.businessId, itemId]
    );

    return jsonResponse({
      success: true,
      data: rows.map((r) => ({
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        defaultCostPrice: r.default_cost_price,
        lastBuyPrice: r.last_buy_price,
      })),
    });
  } catch (error) {
    console.error('Error fetching supplier costs:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch supplier costs',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
