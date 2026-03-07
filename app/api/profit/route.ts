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
    const itemType = searchParams.get('itemType');

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    // Build itemType filter clause
    const itemTypeFilter = itemType ? ` AND COALESCE(si.item_type_snapshot, 'retail') = ?` : '';
    const itemTypeParams = itemType ? [itemType] : [];

    // Buy price fallback: sale snapshot → batch/purchase at sale time → 85% of sell price.
    // If resolved buy price > sell price (would show negative profit), treat as bad data and use 85% fallback.
    const buyPriceRawSummary = `
      COALESCE(
        NULLIF(si.buy_price_per_unit, 0),
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = si.item_id AND ib.received_at <= s.sale_date
         ORDER BY ib.received_at DESC 
         LIMIT 1),
        (SELECT pb.buy_price_per_unit 
         FROM purchase_breakdowns pb
         JOIN purchase_items pi ON pb.purchase_item_id = pi.id
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE pb.item_id = si.item_id AND p.business_id = ? AND pb.confirmed_at <= s.sale_date
         ORDER BY pb.confirmed_at DESC 
         LIMIT 1),
        si.sell_price_per_unit * 0.85
      )`;
    const buyPriceFallbackSummary = `
      CASE WHEN ${buyPriceRawSummary} > si.sell_price_per_unit 
        THEN si.sell_price_per_unit * 0.85 
        ELSE ${buyPriceRawSummary} 
      END`;

    // Include ALL sale items so total_sales = full revenue and total_cost = full COGS.
    // Items without a known buy price contribute 0 to cost (COGS) and full sell to revenue.
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
          si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallbackSummary})
        ), 0) as total_profit,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
        COALESCE(SUM(si.quantity_sold * ${buyPriceFallbackSummary}), 0) as total_cost,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity_sold,
        COUNT(DISTINCT s.id) as total_transactions,
        COUNT(DISTINCT si.item_id) as unique_items_sold
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.business_id = ? 
         AND s.status = 'completed'
         AND s.sale_date >= ? 
         AND s.sale_date <= ?
         ${itemTypeFilter}`,
      [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp, ...itemTypeParams]
    );

    const summaryData = summary[0] || {
      total_profit: 0,
      total_sales: 0,
      total_cost: 0,
      total_quantity_sold: 0,
      total_transactions: 0,
      unique_items_sold: 0,
    };

    // Revenue breakdown: paid (cash/mpesa) vs credit - both from sale_items so Paid + Credit = Total
    const revenueBreakdown = await queryOne<{
      paid_revenue: number;
      credit_revenue: number;
    }>(
      `WITH sales_in_range AS (
        SELECT id, payment_method, total_amount
        FROM sales
        WHERE business_id = ? AND status = 'completed'
          AND sale_date >= ? AND sale_date <= ?
      )
      SELECT 
        COALESCE(SUM(
          si.quantity_sold * si.sell_price_per_unit * 
          CASE 
            WHEN s.payment_method IN ('cash', 'mpesa') THEN 1.0
            WHEN s.payment_method = 'credit' THEN 0.0
            WHEN s.payment_method = 'split' THEN 
              COALESCE((
                SELECT SUM(sp.amount) FROM sale_payments sp 
                WHERE sp.sale_id = s.id AND sp.payment_method IN ('cash', 'mpesa')
              ), 0) / NULLIF(s.total_amount, 0)
            ELSE 0.0
          END
        ), 0) as paid_revenue,
        COALESCE(SUM(
          si.quantity_sold * si.sell_price_per_unit * 
          CASE 
            WHEN s.payment_method IN ('cash', 'mpesa') THEN 0.0
            WHEN s.payment_method = 'credit' THEN 1.0
            WHEN s.payment_method = 'split' THEN 
              COALESCE((
                SELECT SUM(sp.amount) FROM sale_payments sp 
                WHERE sp.sale_id = s.id AND sp.payment_method = 'credit'
              ), 0) / NULLIF(s.total_amount, 0)
            ELSE 0.0
          END
        ), 0) as credit_revenue
       FROM sale_items si
       JOIN sales_in_range s ON si.sale_id = s.id
       WHERE 1=1
         ${itemTypeFilter}`,
      [auth.businessId, startTimestamp, endTimestamp, ...itemTypeParams]
    );

    const paidRevenue = revenueBreakdown?.paid_revenue ?? 0;
    const creditRevenue = revenueBreakdown?.credit_revenue ?? 0;

    // Total outstanding credit (current balance customers owe) - separate metric, not part of revenue
    const totalOutstandingCredit = !itemType
      ? (await queryOne<{ total: number }>(
          `SELECT COALESCE(SUM(total_credit), 0) as total FROM credit_accounts WHERE business_id = ?`,
          [auth.businessId]
        ))?.total ?? 0
      : undefined;

    // For customer queries, when filtering by itemType we need to join through sale_items
    const customerItemTypeJoin = itemType
      ? `JOIN sale_items si_c ON s_c.id = si_c.sale_id AND COALESCE(si_c.item_type_snapshot, 'retail') = ?`
      : '';
    const customerItemTypeParams = itemType ? [itemType] : [];

    // Get unique customers count (credit customers + walk-ins)
    const uniqueCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT 
        CASE 
          WHEN s_c.customer_name IS NOT NULL THEN s_c.customer_name || COALESCE('|' || s_c.customer_phone, '')
          ELSE 'walk-in-' || s_c.id
        END
      ) as count
       FROM sales s_c
       ${customerItemTypeJoin}
       WHERE s_c.business_id = ? 
         AND s_c.status = 'completed'
         AND s_c.sale_date >= ? 
         AND s_c.sale_date <= ?`,
      [...customerItemTypeParams, auth.businessId, startTimestamp, endTimestamp]
    );

    // Get credit customers count
    const creditCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT s_c.customer_name || COALESCE('|' || s_c.customer_phone, '')) as count
       FROM sales s_c
       ${customerItemTypeJoin}
       WHERE s_c.business_id = ? 
         AND s_c.status = 'completed'
         AND s_c.customer_name IS NOT NULL
         AND s_c.sale_date >= ? 
         AND s_c.sale_date <= ?`,
      [...customerItemTypeParams, auth.businessId, startTimestamp, endTimestamp]
    );

    // Get walk-in customers count (sales without customer name)
    const walkInCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT s_c.id) as count
       FROM sales s_c
       ${customerItemTypeJoin}
       WHERE s_c.business_id = ? 
         AND s_c.status = 'completed'
         AND s_c.customer_name IS NULL
         AND s_c.sale_date >= ? 
         AND s_c.sale_date <= ?`,
      [...customerItemTypeParams, auth.businessId, startTimestamp, endTimestamp]
    );

    // Get repeat customers (customers with multiple purchases in this period)
    const repeatCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM (
         SELECT s_c.customer_name || COALESCE('|' || s_c.customer_phone, '') as customer_key
         FROM sales s_c
         ${customerItemTypeJoin}
         WHERE s_c.business_id = ? 
           AND s_c.status = 'completed'
           AND s_c.customer_name IS NOT NULL
           AND s_c.sale_date >= ? 
           AND s_c.sale_date <= ?
         GROUP BY s_c.customer_name || COALESCE('|' || s_c.customer_phone, '')
         HAVING COUNT(*) > 1
       )`,
      [...customerItemTypeParams, auth.businessId, startTimestamp, endTimestamp]
    );

    // Get new customers (first purchase in this period)
    const newCustomers = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT s1.customer_name || COALESCE('|' || s1.customer_phone, '')) as count
       FROM sales s1
       ${itemType ? `JOIN sale_items si_n ON s1.id = si_n.sale_id AND COALESCE(si_n.item_type_snapshot, 'retail') = ?` : ''}
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
      [...customerItemTypeParams, auth.businessId, startTimestamp, endTimestamp, startTimestamp]
    );

    // Check if we should aggregate by parent item
    const groupByParent = searchParams.get('groupByParent') === 'true';

    // Buy price fallback: sale snapshot → batch/purchase at sale time → 85% of sell price.
    // If resolved buy > sell (would show negative profit), treat as bad data and use 85% fallback.
    const buyPriceRaw = `
      COALESCE(
        NULLIF(si.buy_price_per_unit, 0),
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = si.item_id AND ib.received_at <= s.sale_date
         ORDER BY ib.received_at DESC 
         LIMIT 1),
        (SELECT pb.buy_price_per_unit 
         FROM purchase_breakdowns pb
         JOIN purchase_items pi ON pb.purchase_item_id = pi.id
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE pb.item_id = si.item_id AND p.business_id = ? AND pb.confirmed_at <= s.sale_date
         ORDER BY pb.confirmed_at DESC 
         LIMIT 1),
        si.sell_price_per_unit * 0.85
      )`;
    const buyPriceFallback = `
      CASE WHEN ${buyPriceRaw} > si.sell_price_per_unit 
        THEN si.sell_price_per_unit * 0.85 
        ELSE ${buyPriceRaw} 
      END
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
        has_buy_price: number;
      }>(
        `SELECT 
          COALESCE(parent.id, i.id) as item_id,
          COALESCE(parent.name, i.name) as item_name,
          CASE WHEN parent.id IS NOT NULL THEN 1 ELSE 0 END as is_parent,
          COUNT(DISTINCT i.id) as variant_count,
          COALESCE(SUM(
            CASE WHEN ${buyPriceFallback} > 0 
              THEN si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
              ELSE 0
            END
          ), 0) as total_profit,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(
            CASE WHEN ${buyPriceFallback} > 0 
              THEN si.quantity_sold * ${buyPriceFallback}
              ELSE 0
            END
          ), 0) as total_cost,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
          CASE WHEN MAX(${buyPriceFallback}) > 0 THEN 1 ELSE 0 END as has_buy_price
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN items parent ON i.parent_item_id = parent.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
           ${itemTypeFilter}
         GROUP BY COALESCE(parent.id, i.id), COALESCE(parent.name, i.name)
         HAVING total_profit != 0 OR total_sales != 0
         ORDER BY has_buy_price DESC, total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp, ...itemTypeParams]
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
        has_buy_price: number;
      }>(
        `SELECT 
          i.id as item_id,
          i.name as item_name,
          i.variant_name as variant_name,
          parent.name as parent_name,
          COALESCE(SUM(
            CASE WHEN ${buyPriceFallback} > 0 
              THEN si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
              ELSE 0
            END
          ), 0) as total_profit,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_sales,
          COALESCE(SUM(
            CASE WHEN ${buyPriceFallback} > 0 
              THEN si.quantity_sold * ${buyPriceFallback}
              ELSE 0
            END
          ), 0) as total_cost,
          COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
          CASE WHEN MAX(${buyPriceFallback}) > 0 THEN 1 ELSE 0 END as has_buy_price
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN items parent ON i.parent_item_id = parent.id
         WHERE s.business_id = ? 
           AND s.status = 'completed'
           AND s.sale_date >= ? 
           AND s.sale_date <= ?
           ${itemTypeFilter}
         GROUP BY i.id, i.name, i.variant_name, parent.name
         HAVING total_profit != 0 OR total_sales != 0
         ORDER BY has_buy_price DESC, total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp, ...itemTypeParams]
      );
    }

    // Get stock losses (spoilage, theft, damage, other - NOT restock or counting_error)
    // These are losses that should reduce profit
    // Try to get buy price from: 1) inventory_batches, 2) purchase_breakdowns, 3) sale_items (last sold price)
    const stockLosses = await queryOne<{
      total_loss: number;
      loss_count: number;
      spoilage_loss: number;
      theft_loss: number;
      damage_loss: number;
      other_loss: number;
    }>(
      `SELECT 
        COALESCE(SUM(
          CASE WHEN sa.difference < 0 AND sa.reason IN ('spoilage', 'theft', 'damage', 'other') THEN
            ABS(sa.difference) * COALESCE(
              (SELECT ib.buy_price_per_unit 
               FROM inventory_batches ib 
               WHERE ib.item_id = sa.item_id 
               ORDER BY ib.received_at DESC 
               LIMIT 1),
              (SELECT pb.buy_price_per_unit 
               FROM purchase_breakdowns pb
               JOIN purchase_items pi ON pb.purchase_item_id = pi.id
               JOIN purchases p ON pi.purchase_id = p.id
               WHERE pb.item_id = sa.item_id AND p.business_id = ?
               ORDER BY pb.confirmed_at DESC 
               LIMIT 1),
              (SELECT si.buy_price_per_unit 
               FROM sale_items si 
               JOIN sales s ON si.sale_id = s.id
               WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0
               ORDER BY s.sale_date DESC 
               LIMIT 1),
              0
            )
          ELSE 0 END
        ), 0) as total_loss,
        COUNT(CASE WHEN sa.difference < 0 AND sa.reason IN ('spoilage', 'theft', 'damage', 'other') THEN 1 END) as loss_count,
        COALESCE(SUM(CASE WHEN sa.reason = 'spoilage' AND sa.difference < 0 THEN ABS(sa.difference) * COALESCE(
          (SELECT ib.buy_price_per_unit FROM inventory_batches ib WHERE ib.item_id = sa.item_id ORDER BY ib.received_at DESC LIMIT 1),
          (SELECT si.buy_price_per_unit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0 ORDER BY s.sale_date DESC LIMIT 1),
          0
        ) ELSE 0 END), 0) as spoilage_loss,
        COALESCE(SUM(CASE WHEN sa.reason = 'theft' AND sa.difference < 0 THEN ABS(sa.difference) * COALESCE(
          (SELECT ib.buy_price_per_unit FROM inventory_batches ib WHERE ib.item_id = sa.item_id ORDER BY ib.received_at DESC LIMIT 1),
          (SELECT si.buy_price_per_unit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0 ORDER BY s.sale_date DESC LIMIT 1),
          0
        ) ELSE 0 END), 0) as theft_loss,
        COALESCE(SUM(CASE WHEN sa.reason = 'damage' AND sa.difference < 0 THEN ABS(sa.difference) * COALESCE(
          (SELECT ib.buy_price_per_unit FROM inventory_batches ib WHERE ib.item_id = sa.item_id ORDER BY ib.received_at DESC LIMIT 1),
          (SELECT si.buy_price_per_unit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0 ORDER BY s.sale_date DESC LIMIT 1),
          0
        ) ELSE 0 END), 0) as damage_loss,
        COALESCE(SUM(CASE WHEN sa.reason = 'other' AND sa.difference < 0 THEN ABS(sa.difference) * COALESCE(
          (SELECT ib.buy_price_per_unit FROM inventory_batches ib WHERE ib.item_id = sa.item_id ORDER BY ib.received_at DESC LIMIT 1),
          (SELECT si.buy_price_per_unit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0 ORDER BY s.sale_date DESC LIMIT 1),
          0
        ) ELSE 0 END), 0) as other_loss
       FROM stock_adjustments sa
       WHERE sa.business_id = ?
         AND sa.created_at >= ?
         AND sa.created_at <= ?
         AND COALESCE(
           (SELECT ib.buy_price_per_unit 
            FROM inventory_batches ib 
            WHERE ib.item_id = sa.item_id 
            ORDER BY ib.received_at DESC 
            LIMIT 1),
           (SELECT pb.buy_price_per_unit 
            FROM purchase_breakdowns pb
            JOIN purchase_items pi ON pb.purchase_item_id = pi.id
            JOIN purchases p ON pi.purchase_id = p.id
            WHERE pb.item_id = sa.item_id AND p.business_id = ?
            ORDER BY pb.confirmed_at DESC 
            LIMIT 1),
           (SELECT si.buy_price_per_unit 
            FROM sale_items si 
            JOIN sales s ON si.sale_id = s.id
            WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0
            ORDER BY s.sale_date DESC 
            LIMIT 1),
           0
         ) > 0`,
      [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
    );

    // Stock losses are business-wide (not filterable by item type).
    // Only deduct them on the combined view (no itemType filter).
    // Stock losses ignored for now
    const totalStockLoss = 0;
    const adjustedProfit = summaryData.total_profit;

    // Gross margin = gross profit / sales (before any stock loss deduction)
    const grossMargin =
      summaryData.total_sales > 0
        ? summaryData.total_profit / summaryData.total_sales
        : 0;

    // Adjusted margin = (gross profit - stock losses) / sales
    const profitMargin =
      summaryData.total_sales > 0
        ? adjustedProfit / summaryData.total_sales
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
        totalProfit: adjustedProfit,
        grossProfit: summaryData.total_profit,
        grossMargin,
        totalSales: summaryData.total_sales,
        paidRevenue,
        creditRevenue,
        totalOutstandingCredit,
        totalCost: summaryData.total_cost,
        stockLosses: !itemType ? {
          total: totalStockLoss,
          count: stockLosses?.loss_count || 0,
          spoilage: stockLosses?.spoilage_loss || 0,
          theft: stockLosses?.theft_loss || 0,
          damage: stockLosses?.damage_loss || 0,
          other: stockLosses?.other_loss || 0,
        } : undefined,
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

