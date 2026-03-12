import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/items/[id]/cost-history?supplierId=xxx
 * Returns cost price history for an item, optionally filtered by supplier.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;
    const supplierId = request.nextUrl.searchParams.get('supplierId');

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

    // Check if buying_prices table exists
    const tableCheck = await query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='buying_prices'`
    );
    if (tableCheck.length === 0) {
      return jsonResponse({
        success: true,
        data: [],
      });
    }

    let sql = `
      SELECT 
        bp.id,
        bp.item_id,
        bp.supplier_id,
        s.name as supplier_name,
        bp.price,
        bp.effective_from,
        bp.set_by,
        u.name as set_by_name,
        bp.notes,
        bp.created_at
      FROM buying_prices bp
      LEFT JOIN suppliers s ON bp.supplier_id = s.id AND s.business_id = ?
      LEFT JOIN users u ON bp.set_by = u.id
      WHERE bp.item_id = ?
    `;
    const sqlParams: (string | number)[] = [auth.businessId, itemId];

    if (supplierId) {
      sql += ` AND bp.supplier_id = ?`;
      sqlParams.push(supplierId);
    }

    sql += ` ORDER BY bp.effective_from DESC, bp.created_at DESC`;

    const rows = await query<{
      id: string;
      item_id: string;
      supplier_id: string | null;
      supplier_name: string | null;
      price: number;
      effective_from: number;
      set_by: string | null;
      set_by_name: string | null;
      notes: string | null;
      created_at: number;
    }>(sql, sqlParams);

    return jsonResponse({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        supplierId: r.supplier_id,
        supplierName: r.supplier_name ?? (r.supplier_id ? null : 'Default'),
        price: r.price,
        effectiveFrom: r.effective_from,
        setBy: r.set_by,
        setByName: r.set_by_name,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching cost history:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch cost history',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
