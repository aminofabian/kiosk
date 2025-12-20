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
    const dateTimestamp = parseInt(searchParams.get('date') || '0');

    if (!dateTimestamp) {
      return jsonResponse(
        { success: false, message: 'Date timestamp is required' },
        400
      );
    }

    // Calculate start and end of the selected day
    const selectedDate = new Date(dateTimestamp * 1000);
    const startOfDay = Math.floor(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      ).getTime() / 1000
    );
    const endOfDay = Math.floor(
      new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        23,
        59,
        59
      ).getTime() / 1000
    );

    // Calculate profit with fallback for buy_price_per_unit
    // Use sale_items for accurate revenue calculation (not s.total_amount)
    const salesSummary = await queryOne<{
      total_sales: number;
      sales_count: number;
      total_cost: number;
      total_profit: number;
    }>(
      `SELECT 
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
        COUNT(DISTINCT s.id) as sales_count,
        COALESCE(SUM(
          si.quantity_sold * 
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
        ), 0) as total_cost,
        COALESCE(SUM(
          si.quantity_sold * (
            si.sell_price_per_unit - 
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
          )
        ), 0) as total_profit
       FROM sales s
       JOIN sale_items si ON s.id = si.sale_id
       WHERE s.business_id = ? 
         AND s.status = 'completed'
         AND s.sale_date >= ? 
         AND s.sale_date <= ?`,
      [auth.businessId, auth.businessId, auth.businessId, startOfDay, endOfDay]
    );

    const summaryData = salesSummary || {
      total_sales: 0,
      sales_count: 0,
      total_cost: 0,
      total_profit: 0,
    };

    const profitMargin =
      summaryData.total_sales > 0
        ? summaryData.total_profit / summaryData.total_sales
        : 0;

    // Check if we should group by parent
    const groupByParent = searchParams.get('groupByParent') === 'true';

    // Buy price fallback subquery
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

    let topItems;

    if (groupByParent) {
      // Group variants under their parent
      topItems = await query<{
        item_id: string;
        item_name: string;
        is_parent: number;
        variant_count: number;
        quantity_sold: number;
        total_sales: number;
        total_cost: number;
        total_profit: number;
      }>(
        `SELECT 
          COALESCE(parent.id, i.id) as item_id,
          COALESCE(parent.name, i.name) as item_name,
          CASE WHEN parent.id IS NOT NULL THEN 1 ELSE 0 END as is_parent,
          COUNT(DISTINCT i.id) as variant_count,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
          COALESCE(SUM(si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})), 0) as total_profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN items parent ON i.parent_item_id = parent.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
         GROUP BY COALESCE(parent.id, i.id), COALESCE(parent.name, i.name)
         ORDER BY total_sales DESC
         LIMIT 5`,
        [auth.businessId, auth.businessId, auth.businessId, startOfDay, endOfDay]
      );
    } else {
      // Individual items (existing behavior) with variant info
      topItems = await query<{
        item_id: string;
        item_name: string;
        variant_name: string | null;
        parent_name: string | null;
        quantity_sold: number;
        total_sales: number;
        total_cost: number;
        total_profit: number;
      }>(
        `SELECT 
          i.id as item_id,
          i.name as item_name,
          i.variant_name as variant_name,
          parent.name as parent_name,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
          COALESCE(SUM(si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})), 0) as total_profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN items parent ON i.parent_item_id = parent.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
         GROUP BY i.id, i.name, i.variant_name, parent.name
         ORDER BY total_sales DESC
         LIMIT 5`,
        [auth.businessId, auth.businessId, auth.businessId, startOfDay, endOfDay]
      );
    }

    // Exclude parent items from low stock (they don't have actual stock)
    const lowStockItems = await query<{
      id: string;
      name: string;
      variant_name: string | null;
      parent_name: string | null;
      current_stock: number;
      min_stock_level: number;
    }>(
      `SELECT 
        i.id,
        i.name,
        i.variant_name,
        parent.name as parent_name,
        i.current_stock,
        i.min_stock_level
       FROM items i
       LEFT JOIN items parent ON i.parent_item_id = parent.id
       WHERE i.business_id = ?
         AND i.active = 1
         AND i.min_stock_level IS NOT NULL
         AND i.current_stock <= i.min_stock_level
         AND NOT EXISTS (
           SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1
         )
       ORDER BY (i.current_stock - i.min_stock_level) ASC
       LIMIT 10`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: {
        totalSales: summaryData.total_sales,
        salesCount: summaryData.sales_count,
        totalCost: summaryData.total_cost,
        totalProfit: summaryData.total_profit,
        profitMargin,
        topItems,
        lowStockItems,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch dashboard data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
