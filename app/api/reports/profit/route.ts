import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

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
    const viewBy = searchParams.get('viewBy') || 'item';

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    // Helper subquery for getting buy_price with fallback
    const buyPriceFallback = `
      COALESCE(
        NULLIF(si.buy_price_per_unit, 0),
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = si.item_id 
         ORDER BY ib.received_at DESC 
         LIMIT 1),
        (SELECT pb.buy_price_per_unit 
         FROM purchase_breakdowns pb
         JOIN purchase_items pi ON pb.purchase_item_id = pi.id
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE pb.item_id = si.item_id AND p.business_id = ?
         ORDER BY pb.confirmed_at DESC 
         LIMIT 1),
        0
      )
    `;

    // Get total summary with buy_price fallback
    const summary = await queryOne<{
      total_sales: number;
      total_cost: number;
      total_profit: number;
    }>(
      `SELECT 
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
        COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
        COALESCE(SUM(
          si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
        ), 0) as total_profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.business_id = ? 
         AND s.status = 'completed'
         AND s.sale_date >= ? 
         AND s.sale_date <= ?`,
      [auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
    );

    const totalSales = summary?.total_sales || 0;
    const totalCost = summary?.total_cost || 0;
    const totalProfit = summary?.total_profit || 0;
    const profitMargin = totalSales > 0 ? totalProfit / totalSales : 0;

    let byItem: any[] = [];
    let byCategory: any[] = [];

    if (viewBy === 'item') {
      // Profit by item with buy_price fallback
      byItem = await query<{
        item_id: string;
        item_name: string;
        quantity_sold: number;
        total_sales: number;
        total_cost: number;
        total_profit: number;
        profit_margin: number;
      }>(
        `SELECT 
          i.id as item_id,
          i.name as item_name,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
          COALESCE(SUM(
            si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
          ), 0) as total_profit,
          CASE 
            WHEN SUM(si.quantity_sold * si.sell_price_per_unit) > 0 
            THEN SUM(si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})) / SUM(si.quantity_sold * si.sell_price_per_unit)
            ELSE 0 
          END as profit_margin
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
         GROUP BY i.id, i.name
         HAVING total_sales > 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    } else {
      // Profit by category with buy_price fallback
      byCategory = await query<{
        category_id: string;
        category_name: string;
        total_sales: number;
        total_cost: number;
        total_profit: number;
        profit_margin: number;
      }>(
        `SELECT 
          c.id as category_id,
          c.name as category_name,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
          COALESCE(SUM(
            si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
          ), 0) as total_profit,
          CASE 
            WHEN SUM(si.quantity_sold * si.sell_price_per_unit) > 0 
            THEN SUM(si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})) / SUM(si.quantity_sold * si.sell_price_per_unit)
            ELSE 0 
          END as profit_margin
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN categories c ON i.category_id = c.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
         GROUP BY c.id, c.name
         HAVING total_sales > 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    }

    return jsonResponse({
      success: true,
      data: {
        totalSales,
        totalCost,
        totalProfit,
        profitMargin,
        byItem,
        byCategory,
      },
    });
  } catch (error) {
    console.error('Error fetching profit report:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch profit report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

