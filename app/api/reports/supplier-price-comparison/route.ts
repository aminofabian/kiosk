import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/reports/supplier-price-comparison
 * Returns all items with multiple suppliers, their prices, and the cheapest supplier.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const minSuppliers = parseInt(searchParams.get('minSuppliers') || '2', 10);

    let sql = `
      SELECT 
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        i.unit_type,
        c.name as category_name,
        c.id as category_id,
        sp.supplier_id,
        s.name as supplier_name,
        sp.default_cost_price,
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = i.id AND ib.supplier_id = sp.supplier_id AND ib.business_id = ?
         ORDER BY ib.created_at DESC 
         LIMIT 1) as last_buy_price
      FROM supplier_products sp
      JOIN items i ON sp.item_id = i.id AND i.active = 1
      JOIN categories c ON i.category_id = c.id
      JOIN suppliers s ON sp.supplier_id = s.id AND s.business_id = ? AND s.active = 1
      WHERE i.business_id = ?
    `;
    const params: (string | number)[] = [auth.businessId, auth.businessId, auth.businessId];

    if (categoryId) {
      sql += ` AND i.category_id = ?`;
      params.push(categoryId);
    }

    sql += ` ORDER BY c.name ASC, i.name ASC, i.variant_name ASC, s.name ASC`;

    const rows = await query<{
      item_id: string;
      item_name: string;
      variant_name: string | null;
      unit_type: string;
      category_name: string;
      category_id: string;
      supplier_id: string;
      supplier_name: string;
      default_cost_price: number | null;
      last_buy_price: number | null;
    }>(sql, params);

    // Group by item and compute cheapest
    const itemMap = new Map<
      string,
      {
        itemId: string;
        itemName: string;
        variantName: string | null;
        unitType: string;
        categoryName: string;
        categoryId: string;
        suppliers: {
          supplierId: string;
          supplierName: string;
          defaultCostPrice: number | null;
          lastBuyPrice: number | null;
          effectivePrice: number;
        }[];
      }
    >();

    for (const r of rows) {
      const effectivePrice = r.default_cost_price ?? r.last_buy_price ?? Infinity;
      if (effectivePrice === Infinity) continue;

      const key = r.item_id;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          itemId: r.item_id,
          itemName: r.item_name,
          variantName: r.variant_name,
          unitType: r.unit_type,
          categoryName: r.category_name,
          categoryId: r.category_id,
          suppliers: [],
        });
      }
      const item = itemMap.get(key)!;
      item.suppliers.push({
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        defaultCostPrice: r.default_cost_price,
        lastBuyPrice: r.last_buy_price,
        effectivePrice,
      });
    }

    const items = Array.from(itemMap.values())
      .filter((item) => item.suppliers.length >= minSuppliers)
      .map((item) => {
        const sorted = [...item.suppliers].sort((a, b) => a.effectivePrice - b.effectivePrice);
        const cheapest = sorted[0];
        const mostExpensive = sorted[sorted.length - 1];
        const savings =
          mostExpensive.effectivePrice > cheapest.effectivePrice
            ? mostExpensive.effectivePrice - cheapest.effectivePrice
            : 0;

        return {
          ...item,
          cheapestSupplierId: cheapest.supplierId,
          cheapestSupplierName: cheapest.supplierName,
          cheapestPrice: cheapest.effectivePrice,
          mostExpensivePrice: mostExpensive.effectivePrice,
          savings,
          supplierCount: item.suppliers.length,
        };
      });

    return jsonResponse({
      success: true,
      data: { items },
    });
  } catch (error) {
    console.error('Error fetching supplier price comparison:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch supplier price comparison',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
