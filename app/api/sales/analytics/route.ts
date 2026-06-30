import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { getSalesPeriodRange } from '@/lib/utils/sales-period';
import { salesByPaymentMethodQuery, saleLineAllocatedRevenueSql } from '@/lib/utils/sales-payment-allocation';
import {
  resolvedBuyPriceSql,
  saleLineCostSql,
  saleLineProfitSql,
  isCappedBuyPriceSql,
  isZeroCostSql,
} from '@/lib/utils/profit-sql';

export async function OPTIONS() {
  return optionsResponse();
}

interface ItemSalesData {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  category_name: string;
  parent_name: string | null;
  parent_item_id: string | null;
  item_type: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  current_stock: number;
  min_stock_level: number | null;
  transaction_count: number;
  avg_sell_price: number;
}

interface SalesSummary {
  totalTransactions: number;
  totalItemsSold: number;
  totalRevenue: number;
  transactionRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  uniqueProductsSold: number;
  lowStockCount: number;
  outOfStockCount: number;
  cappedLines: number;
  zeroCostLines: number;
}

export async function GET(request: NextRequest) {
  try {
    // Only users with profit/report permissions (typically admin/owner) can view analytics
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const categoryId = searchParams.get('categoryId');
    const parentId = searchParams.get('parentId');
    const itemType = searchParams.get('itemType');

    // Prefer client-provided bounds (user's local timezone); fall back to server-local period math.
    const startRaw = searchParams.get('start');
    const endRaw = searchParams.get('end');
    const clientStart = startRaw ? parseInt(startRaw, 10) : null;
    const clientEnd = endRaw ? parseInt(endRaw, 10) : null;

    let startDate = 0;
    let endDate: number | null = null;

    if (
      clientStart !== null &&
      Number.isInteger(clientStart) &&
      clientStart >= 0 &&
      (clientEnd === null || (Number.isInteger(clientEnd) && clientEnd > clientStart))
    ) {
      startDate = clientStart;
      endDate = clientEnd;
    } else {
      const range = getSalesPeriodRange(period);
      startDate = range.start;
      endDate = range.end;
    }

    const dateFilter = endDate != null
      ? 's.sale_date >= ? AND s.sale_date < ?'
      : 's.sale_date >= ?';
    const dateFilterCreated = endDate != null
      ? 'ct.created_at >= ? AND ct.created_at < ?'
      : 'ct.created_at >= ?';
    const dateParams = endDate != null ? [startDate, endDate] : [startDate];

    // Build filters for item-level sales data
    let itemFilters = '';
    const itemParams: (string | number)[] = [...dateParams, auth.businessId];

    if (categoryId) {
      itemFilters += ' AND i.category_id = ?';
      itemParams.push(categoryId);
    }

    if (parentId) {
      itemFilters += ' AND i.parent_item_id = ?';
      itemParams.push(parentId);
    }

    // Helpers for recomputed cost/profit. Each call injects 2 business_id placeholders.
    const lineCost = saleLineCostSql('si');
    const lineProfit = saleLineProfitSql('si');

    // Get item-level sales data (filter by period + item_type_snapshot when itemType provided)
    const siJoin =
      itemType !== null && itemType !== undefined && itemType !== ''
        ? `LEFT JOIN sale_items si ON i.id = si.item_id AND COALESCE(si.item_type_snapshot, 'retail') = ?`
        : `LEFT JOIN sale_items si ON i.id = si.item_id`;
    const siParams = itemType ? [itemType] : [];
    const itemSales = await query<ItemSalesData>(
      `SELECT
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        c.name as category_name,
        parent.name as parent_name,
        i.parent_item_id,
        i.item_type,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.quantity_sold ELSE 0 END), 0) as total_quantity_sold,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.quantity_sold * si.sell_price_per_unit ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN ${lineCost} ELSE 0 END), 0) as total_cost,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN ${lineProfit} ELSE 0 END), 0) as total_profit,
        i.current_stock,
        i.min_stock_level,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN si.sale_id END) as transaction_count,
        COALESCE(AVG(CASE WHEN s.id IS NOT NULL THEN si.sell_price_per_unit END), i.current_sell_price) as avg_sell_price
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items parent ON i.parent_item_id = parent.id
      ${siJoin}
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed' AND ${dateFilter}
      WHERE i.business_id = ?
        AND i.active = 1
        AND (i.parent_item_id IS NOT NULL OR
             (i.parent_item_id IS NULL AND NOT EXISTS (
               SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1
             )))
        ${itemFilters}
        ${itemType ? ' AND i.item_type = ?' : ''}
      GROUP BY i.id, i.name, i.variant_name, c.name, parent.name, i.parent_item_id, i.item_type, i.current_stock, i.min_stock_level, i.current_sell_price
      ORDER BY total_quantity_sold DESC`,
      itemType
        ? [...siParams, ...itemParams, auth.businessId, auth.businessId, auth.businessId, auth.businessId, itemType]
        : [...itemParams, auth.businessId, auth.businessId, auth.businessId, auth.businessId]
    );

    // Get sales summary (filtered by itemType when provided)
    const summaryResult = await query<{
      total_transactions: number;
      total_items_sold: number;
      total_revenue: number;
      transaction_revenue: number;
      sales_without_items_count: number;
      sales_without_items_value: number;
      total_cost: number;
      total_profit: number;
      capped_lines: number;
      zero_cost_lines: number;
    }>(
      itemType
        ? `SELECT
            COUNT(DISTINCT s.id) as total_transactions,
            COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
            COALESCE(SUM(${saleLineAllocatedRevenueSql()}), 0) as total_revenue,
            COALESCE(SUM(${saleLineAllocatedRevenueSql()}), 0) as transaction_revenue,
            COALESCE(SUM(${lineCost}), 0) as total_cost,
            COALESCE(SUM(${lineProfit}), 0) as total_profit,
            COALESCE(SUM(${isCappedBuyPriceSql('si')}), 0) as capped_lines,
            COALESCE(SUM(${isZeroCostSql('si')}), 0) as zero_cost_lines
          FROM sales s
          JOIN sale_items si ON s.id = si.sale_id
          WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}
            AND COALESCE(si.item_type_snapshot, 'retail') = ?`
        : `SELECT
            COUNT(DISTINCT s.id) as total_transactions,
            COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
            COALESCE(SUM(${saleLineAllocatedRevenueSql()}), 0) as total_revenue,
            (
              SELECT COALESCE(SUM(sr.total_amount), 0)
              FROM sales sr
              WHERE sr.business_id = ? AND sr.status = 'completed' AND ${dateFilter.replace(/s\./g, 'sr.')}
            ) as transaction_revenue,
            (
              SELECT COUNT(*)
              FROM sales sr
              WHERE sr.business_id = ? AND sr.status = 'completed' AND ${dateFilter.replace(/s\./g, 'sr.')}
                AND NOT EXISTS (SELECT 1 FROM sale_items si2 WHERE si2.sale_id = sr.id)
            ) as sales_without_items_count,
            (
              SELECT COALESCE(SUM(sr.total_amount), 0)
              FROM sales sr
              WHERE sr.business_id = ? AND sr.status = 'completed' AND ${dateFilter.replace(/s\./g, 'sr.')}
                AND NOT EXISTS (SELECT 1 FROM sale_items si2 WHERE si2.sale_id = sr.id)
            ) as sales_without_items_value,
            COALESCE(SUM(${lineCost}), 0) as total_cost,
            COALESCE(SUM(${lineProfit}), 0) as total_profit,
            COALESCE(SUM(${isCappedBuyPriceSql('si')}), 0) as capped_lines,
            COALESCE(SUM(${isZeroCostSql('si')}), 0) as zero_cost_lines
          FROM sales s
          JOIN sale_items si ON s.id = si.sale_id
          WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}`,
      itemType
        ? [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, ...dateParams, itemType]
        : [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, ...dateParams, auth.businessId, ...dateParams, auth.businessId, ...dateParams, auth.businessId, ...dateParams]
    );

    const summaryData = summaryResult[0] || {
      total_transactions: 0,
      total_items_sold: 0,
      total_revenue: 0,
      transaction_revenue: 0,
      sales_without_items_count: 0,
      sales_without_items_value: 0,
      total_cost: 0,
      total_profit: 0,
      capped_lines: 0,
      zero_cost_lines: 0,
    };

    // Calculate additional stats
    const uniqueProductsSold = itemSales.filter((i) => i.total_quantity_sold > 0).length;
    const lowStockCount = itemSales.filter(
      (i) => i.min_stock_level !== null && i.current_stock > 0 && i.current_stock <= i.min_stock_level
    ).length;
    const outOfStockCount = itemSales.filter((i) => i.current_stock <= 0).length;

    const summary: SalesSummary = {
      totalTransactions: summaryData.total_transactions,
      totalItemsSold: summaryData.total_items_sold,
      totalRevenue: summaryData.total_revenue,
      transactionRevenue: summaryData.transaction_revenue,
      totalCost: summaryData.total_cost,
      totalProfit: summaryData.total_profit,
      profitMargin: summaryData.total_revenue > 0
        ? (summaryData.total_profit / summaryData.total_revenue) * 100
        : 0,
      uniqueProductsSold,
      lowStockCount,
      outOfStockCount,
      cappedLines: summaryData.capped_lines,
      zeroCostLines: summaryData.zero_cost_lines,
    };

    // Payment breakdown uses the same line-item revenue as total revenue, allocated by payment method.
    const paymentQuery = salesByPaymentMethodQuery(dateFilter, itemType);
    const paymentParams = itemType
      ? [auth.businessId, ...dateParams, itemType, auth.businessId, ...dateParams, itemType, auth.businessId, ...dateParams, itemType, auth.businessId, ...dateParams, itemType]
      : [auth.businessId, ...dateParams, auth.businessId, ...dateParams, auth.businessId, ...dateParams, auth.businessId, ...dateParams];

    const salesByPaymentMethod = await query<{
      payment_method: string;
      count: number;
      total: number;
    }>(paymentQuery, paymentParams);

    // Get top sellers
    const topSellers = itemSales
      .filter((i) => i.total_quantity_sold > 0)
      .slice(0, 10);

    // Get top sellers per item type (from sale_items snapshot)
    const itemSalesByType = await query<{
      item_id: string;
      item_name: string;
      item_type: string;
      total_quantity_sold: number;
      total_revenue: number;
    }>(
      `SELECT
        i.id as item_id,
        i.name as item_name,
        COALESCE(si.item_type_snapshot, 'retail') as item_type,
        SUM(si.quantity_sold) as total_quantity_sold,
        SUM(si.quantity_sold * si.sell_price_per_unit) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}
      GROUP BY i.id, i.name, COALESCE(si.item_type_snapshot, 'retail')
      HAVING total_quantity_sold > 0
      ORDER BY item_type, total_quantity_sold DESC`,
      [auth.businessId, ...dateParams]
    );

    const topSellersByType: Record<string, { item_id: string; item_name: string; total_quantity_sold: number; total_revenue: number }[]> = {};
    for (const row of itemSalesByType) {
      if (!topSellersByType[row.item_type]) topSellersByType[row.item_type] = [];
      if (topSellersByType[row.item_type].length < 5) {
        topSellersByType[row.item_type].push({
          item_id: row.item_id,
          item_name: row.item_name,
          total_quantity_sold: row.total_quantity_sold,
          total_revenue: row.total_revenue,
        });
      }
    }

    // Get credit paid during period (payments collected against credit accounts)
    const creditPaidResult = await query<{ total: number; count: number }>(
      `SELECT
        COALESCE(SUM(ct.amount), 0) as total,
        COUNT(*) as count
      FROM credit_transactions ct
      JOIN credit_accounts ca ON ct.credit_account_id = ca.id
      WHERE ca.business_id = ? AND ct.type = 'payment' AND ${dateFilterCreated}`,
      [auth.businessId, ...dateParams]
    );
    const creditPaid = creditPaidResult[0] || { total: 0, count: 0 };

    // Get items with no sales
    const noSalesItems = itemSales
      .filter((i) => i.total_quantity_sold === 0)
      .slice(0, 20);

    // Get sales breakdown by item type (grocery vs retail)
    const salesByItemType = await query<{
      item_type: string;
      transaction_count: number;
      items_sold: number;
      revenue: number;
      cost: number;
      profit: number;
    }>(
      `SELECT
        COALESCE(si.item_type_snapshot, 'retail') as item_type,
        COUNT(DISTINCT s.id) as transaction_count,
        COALESCE(SUM(si.quantity_sold), 0) as items_sold,
        COALESCE(SUM(${saleLineAllocatedRevenueSql()}), 0) as revenue,
        COALESCE(SUM(${lineCost}), 0) as cost,
        COALESCE(SUM(${lineProfit}), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.business_id = ? AND s.status = 'completed' AND ${dateFilter}
      GROUP BY si.item_type_snapshot
      ORDER BY revenue DESC`,
      [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, ...dateParams]
    );

    return jsonResponse({
      success: true,
      data: {
        summary,
        items: itemSales,
        topSellers,
        topSellersByType,
        creditPaid: { total: creditPaid.total, count: creditPaid.count },
        noSalesItems,
        salesByPaymentMethod,
        salesByItemType,
        period,
      },
    });
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch sales analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
