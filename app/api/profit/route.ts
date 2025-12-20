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

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    const summary = await query<{
      total_profit: number;
      total_sales: number;
      total_cost: number;
      total_quantity_sold: number;
      total_transactions: number;
      unique_items_sold: number;
    }>(
      `SELECT 
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
        ), 0) as total_profit,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
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
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity_sold,
        COUNT(DISTINCT s.id) as total_transactions,
        COUNT(DISTINCT si.item_id) as unique_items_sold
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.business_id = ? 
         AND s.status = 'completed'
         AND s.sale_date >= ? 
         AND s.sale_date <= ?`,
      [auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
    );

    const summaryData = summary[0] || {
      total_profit: 0,
      total_sales: 0,
      total_cost: 0,
      total_quantity_sold: 0,
      total_transactions: 0,
      unique_items_sold: 0,
    };

    // Get unique customers count (credit customers + walk-ins)
    const uniqueCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT 
        CASE 
          WHEN customer_name IS NOT NULL THEN customer_name || COALESCE('|' || customer_phone, '')
          ELSE 'walk-in-' || id
        END
      ) as count
       FROM sales
       WHERE business_id = ? 
         AND status = 'completed'
         AND sale_date >= ? 
         AND sale_date <= ?`,
      [auth.businessId, startTimestamp, endTimestamp]
    );

    // Get credit customers count
    const creditCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT customer_name || COALESCE('|' || customer_phone, '')) as count
       FROM sales
       WHERE business_id = ? 
         AND status = 'completed'
         AND customer_name IS NOT NULL
         AND sale_date >= ? 
         AND sale_date <= ?`,
      [auth.businessId, startTimestamp, endTimestamp]
    );

    // Get walk-in customers count (sales without customer name)
    const walkInCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT id) as count
       FROM sales
       WHERE business_id = ? 
         AND status = 'completed'
         AND customer_name IS NULL
         AND sale_date >= ? 
         AND sale_date <= ?`,
      [auth.businessId, startTimestamp, endTimestamp]
    );

    // Get repeat customers (customers with multiple purchases in this period)
    const repeatCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM (
         SELECT customer_name || COALESCE('|' || customer_phone, '') as customer_key
         FROM sales
         WHERE business_id = ? 
           AND status = 'completed'
           AND customer_name IS NOT NULL
           AND sale_date >= ? 
           AND sale_date <= ?
         GROUP BY customer_name || COALESCE('|' || customer_phone, '')
         HAVING COUNT(*) > 1
       )`,
      [auth.businessId, startTimestamp, endTimestamp]
    );

    // Get new customers (first purchase in this period)
    const newCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT customer_name || COALESCE('|' || customer_phone, '')) as count
       FROM sales s1
       WHERE s1.business_id = ? 
         AND s1.status = 'completed'
         AND s1.customer_name IS NOT NULL
         AND s1.sale_date >= ? 
         AND s1.sale_date <= ?
         AND NOT EXISTS (
           SELECT 1 FROM sales s2
           WHERE s2.business_id = s1.business_id
             AND s2.customer_name = s1.customer_name
             AND COALESCE(s2.customer_phone, '') = COALESCE(s1.customer_phone, '')
             AND s2.status = 'completed'
             AND s2.sale_date < ?
         )`,
      [auth.businessId, startTimestamp, endTimestamp, startTimestamp]
    );

    // Check if we should aggregate by parent item
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

    let itemProfits;

    if (groupByParent) {
      // Group by parent item (aggregate variants under parent)
      itemProfits = await query<{
        item_id: string;
        item_name: string;
        is_parent: number;
        variant_count: number;
        total_profit: number;
        total_sales: number;
        total_cost: number;
        quantity_sold: number;
      }>(
        `SELECT 
          COALESCE(parent.id, i.id) as item_id,
          COALESCE(parent.name, i.name) as item_name,
          CASE WHEN parent.id IS NOT NULL THEN 1 ELSE 0 END as is_parent,
          COUNT(DISTINCT i.id) as variant_count,
          COALESCE(SUM(
            si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
          ), 0) as total_profit,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN items parent ON i.parent_item_id = parent.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
         GROUP BY COALESCE(parent.id, i.id), COALESCE(parent.name, i.name)
         HAVING total_profit != 0 OR total_sales != 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    } else {
      // Individual item profits (existing behavior)
      itemProfits = await query<{
        item_id: string;
        item_name: string;
        variant_name: string | null;
        parent_name: string | null;
        total_profit: number;
        total_sales: number;
        total_cost: number;
        quantity_sold: number;
      }>(
        `SELECT 
          i.id as item_id,
          i.name as item_name,
          i.variant_name as variant_name,
          parent.name as parent_name,
          COALESCE(SUM(
            si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
          ), 0) as total_profit,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(si.quantity_sold * ${buyPriceFallback}), 0) as total_cost,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN items parent ON i.parent_item_id = parent.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
         GROUP BY i.id, i.name, i.variant_name, parent.name
         HAVING total_profit != 0 OR total_sales != 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    }

    const profitMargin =
      summaryData.total_sales > 0
        ? summaryData.total_profit / summaryData.total_sales
        : 0;

    const totalCustomers = uniqueCustomers?.count || 0;
    const creditCustomersCount = creditCustomers?.count || 0;
    const walkInCustomersCount = walkInCustomers?.count || 0;
    const repeatCustomersCount = repeatCustomers?.count || 0;
    const newCustomersCount = newCustomers?.count || 0;
    const averageSalePerCustomer = totalCustomers > 0 
      ? summaryData.total_sales / totalCustomers 
      : 0;

    return jsonResponse({
      success: true,
      data: {
        totalProfit: summaryData.total_profit,
        totalSales: summaryData.total_sales,
        totalCost: summaryData.total_cost,
        profitMargin,
        totalQuantitySold: summaryData.total_quantity_sold || 0,
        totalTransactions: summaryData.total_transactions || 0,
        uniqueItemsSold: summaryData.unique_items_sold || 0,
        averageItemsPerSale: summaryData.total_transactions > 0 
          ? (summaryData.total_quantity_sold || 0) / summaryData.total_transactions 
          : 0,
        totalCustomers,
        creditCustomers: creditCustomersCount,
        walkInCustomers: walkInCustomersCount,
        repeatCustomers: repeatCustomersCount,
        newCustomers: newCustomersCount,
        averageSalePerCustomer,
        itemProfits,
      },
    });
  } catch (error) {
    console.error('Error fetching profit:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch profit data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

