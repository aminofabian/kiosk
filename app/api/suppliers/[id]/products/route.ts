import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - List products linked to a supplier
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: supplierId } = await params;

    // Verify supplier belongs to this business
    const supplier = await query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = ? AND business_id = ?`,
      [supplierId, auth.businessId]
    );

    if (supplier.length === 0) {
      return jsonResponse(
        { success: false, message: 'Supplier not found' },
        404
      );
    }

    const products = await query<{
      id: string;
      supplier_product_id: string;
      item_id: string;
      item_name: string;
      variant_name: string | null;
      category_name: string;
      unit_type: string;
      item_type: string;
      current_stock: number;
      current_sell_price: number;
      default_cost_price: number | null;
      last_buy_price: number | null;
      packaging_unit_name: string | null;
      packaging_unit_qty: number | null;
    }>(
      `SELECT 
        sp.id as supplier_product_id,
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        c.name as category_name,
        i.unit_type,
        i.item_type,
        i.current_stock,
        i.current_sell_price,
        sp.default_cost_price,
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = i.id 
         ORDER BY ib.created_at DESC 
         LIMIT 1) as last_buy_price,
        COALESCE(i.packaging_unit_name, p.packaging_unit_name) as packaging_unit_name,
        COALESCE(i.packaging_unit_qty, p.packaging_unit_qty) as packaging_unit_qty
      FROM supplier_products sp
      JOIN items i ON sp.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      LEFT JOIN items p ON i.parent_item_id = p.id
      WHERE sp.supplier_id = ? AND i.active = 1
      ORDER BY c.name ASC, i.name ASC`,
      [supplierId]
    );

    return jsonResponse({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching supplier products:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch supplier products',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// POST - Link products to a supplier (supports single or bulk)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'cashier') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id: supplierId } = await params;

    // Verify supplier belongs to this business
    const supplier = await query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = ? AND business_id = ?`,
      [supplierId, auth.businessId]
    );

    if (supplier.length === 0) {
      return jsonResponse(
        { success: false, message: 'Supplier not found' },
        404
      );
    }

    const body = await request.json();
    const { items } = body as {
      items: Array<{ itemId: string; defaultCostPrice?: number }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: 'At least one item is required' },
        400
      );
    }

    // Verify all items belong to this business
    const itemIds = items.map((i) => i.itemId);
    const placeholders = itemIds.map(() => '?').join(',');
    const validItems = await query<{ id: string }>(
      `SELECT id FROM items WHERE id IN (${placeholders}) AND business_id = ?`,
      [...itemIds, auth.businessId]
    );

    const validItemIds = new Set(validItems.map((i) => i.id));

    let linked = 0;
    for (const item of items) {
      if (!validItemIds.has(item.itemId)) continue;

      try {
        await execute(
          `INSERT OR IGNORE INTO supplier_products (id, supplier_id, item_id, default_cost_price)
           VALUES (?, ?, ?, ?)`,
          [
            generateUUID(),
            supplierId,
            item.itemId,
            item.defaultCostPrice ?? null,
          ]
        );
        linked++;
      } catch {
        // Skip duplicates silently
      }
    }

    return jsonResponse({
      success: true,
      message: `${linked} product(s) linked to supplier`,
      data: { linked },
    });
  } catch (error) {
    console.error('Error linking supplier products:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to link products',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// PATCH - Update default cost price for a linked product
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'cashier') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id: supplierId } = await params;

    const supplier = await query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = ? AND business_id = ?`,
      [supplierId, auth.businessId]
    );

    if (supplier.length === 0) {
      return jsonResponse(
        { success: false, message: 'Supplier not found' },
        404
      );
    }

    const body = await request.json();
    const { itemId, defaultCostPrice } = body as {
      itemId: string;
      defaultCostPrice: number | null;
    };

    if (!itemId) {
      return jsonResponse(
        { success: false, message: 'itemId is required' },
        400
      );
    }

    await execute(
      `UPDATE supplier_products 
       SET default_cost_price = ? 
       WHERE supplier_id = ? AND item_id = ?`,
      [defaultCostPrice ?? null, supplierId, itemId]
    );

    return jsonResponse({
      success: true,
      message: 'Default cost price updated',
    });
  } catch (error) {
    console.error('Error updating supplier product cost:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update cost price',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// DELETE - Unlink a product from a supplier (via query param ?itemId=xxx)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'cashier') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id: supplierId } = await params;
    const itemId = request.nextUrl.searchParams.get('itemId');

    if (!itemId) {
      return jsonResponse(
        { success: false, message: 'itemId query parameter is required' },
        400
      );
    }

    await execute(
      `DELETE FROM supplier_products WHERE supplier_id = ? AND item_id = ?`,
      [supplierId, itemId]
    );

    return jsonResponse({
      success: true,
      message: 'Product unlinked from supplier',
    });
  } catch (error) {
    console.error('Error unlinking supplier product:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to unlink product',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
