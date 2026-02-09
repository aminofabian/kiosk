import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

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
  item_type: string; // 'grocery' or 'retail'
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
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  uniqueProductsSold: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const categoryId = searchParams.get('categoryId');
    const parentId = searchParams.get('parentId');
    const itemType = searchParams.get('itemType'); // 'grocery' or 'retail' or null for all

    // Calculate date range
    const now = Math.floor(Date.now() / 1000);
    let startDate = 0;

    switch (period) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        startDate = Math.floor(todayStart.getTime() / 1000);
        break;
      case '3days':
        startDate = now - (3 * 24 * 60 * 60);
        break;
      case 'week':
        startDate = now - (7 * 24 * 60 * 60);
        break;
      case 'month':
        startDate = now - (30 * 24 * 60 * 60);
        break;
      case 'all':
      default:
        startDate = 0;
        break;
    }

    // Build filters for item-level sales data
    let itemFilters = '';
    const itemParams: (string | number)[] = [startDate, auth.businessId];

    if (categoryId) {
      itemFilters += ' AND i.category_id = ?';
      itemParams.push(categoryId);
    }

    if (parentId) {
      itemFilters += ' AND i.parent_item_id = ?';
      itemParams.push(parentId);
    }

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
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.quantity_sold * si.buy_price_per_unit ELSE 0 END), 0) as total_cost,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.profit ELSE 0 END), 0) as total_profit,
        i.current_stock,
        i.min_stock_level,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN si.sale_id END) as transaction_count,
        COALESCE(AVG(CASE WHEN s.id IS NOT NULL THEN si.sell_price_per_unit END), i.current_sell_price) as avg_sell_price
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items parent ON i.parent_item_id = parent.id
      ${siJoin}
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed' AND s.sale_date >= ?
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
      itemType ? [...siParams, ...itemParams, itemType] : itemParams
    );

    // Get sales summary (filtered by itemType when provided)
    const summaryResult = await query<{
      total_transactions: number;
      total_items_sold: number;
      total_revenue: number;
      total_cost: number;
      total_profit: number;
    }>(
      itemType
        ? `SELECT 
            COUNT(DISTINCT s.id) as total_transactions,
            COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
            COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
            COALESCE(SUM(si.quantity_sold * si.buy_price_per_unit), 0) as total_cost,
            COALESCE(SUM(si.profit), 0) as total_profit
          FROM sales s
          JOIN sale_items si ON s.id = si.sale_id
          WHERE s.business_id = ? AND s.status = 'completed' AND s.sale_date >= ?
            AND COALESCE(si.item_type_snapshot, 'retail') = ?`
        : `SELECT 
            COUNT(DISTINCT s.id) as total_transactions,
            COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
            COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
            COALESCE(SUM(si.quantity_sold * si.buy_price_per_unit), 0) as total_cost,
            COALESCE(SUM(si.profit), 0) as total_profit
          FROM sales s
          JOIN sale_items si ON s.id = si.sale_id
          WHERE s.business_id = ? AND s.status = 'completed' AND s.sale_date >= ?`,
      itemType ? [auth.businessId, startDate, itemType] : [auth.businessId, startDate]
    );

    const summaryData = summaryResult[0] || {
      total_transactions: 0,
      total_items_sold: 0,
      total_revenue: 0,
      total_cost: 0,
      total_profit: 0,
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
      totalCost: summaryData.total_cost,
      totalProfit: summaryData.total_profit,
      profitMargin: summaryData.total_revenue > 0
        ? (summaryData.total_profit / summaryData.total_revenue) * 100
        : 0,
      uniqueProductsSold,
      lowStockCount,
      outOfStockCount,
    };

    // Get sales by payment method (filtered by itemType when provided)
    const salesByPaymentMethod = await query<{
      payment_method: string;
      count: number;
      total: number;
    }>(
      itemType
        ? `SELECT 
            s.payment_method,
            COUNT(DISTINCT s.id) as count,
            COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total
          FROM sales s
          JOIN sale_items si ON s.id = si.sale_id
          WHERE s.business_id = ? AND s.status = 'completed' AND s.sale_date >= ?
            AND COALESCE(si.item_type_snapshot, 'retail') = ?
          GROUP BY s.payment_method
          ORDER BY total DESC`
        : `SELECT 
            payment_method,
            COUNT(*) as count,
            SUM(total_amount) as total
          FROM sales
          WHERE business_id = ? AND status = 'completed' AND sale_date >= ?
          GROUP BY payment_method
          ORDER BY total DESC`,
      itemType ? [auth.businessId, startDate, itemType] : [auth.businessId, startDate]
    );

    // Get top sellers
    const topSellers = itemSales
      .filter((i) => i.total_quantity_sold > 0)
      .slice(0, 10);

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
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
        COALESCE(SUM(si.quantity_sold * si.buy_price_per_unit), 0) as cost,
        COALESCE(SUM(si.profit), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.business_id = ? AND s.status = 'completed' AND s.sale_date >= ?
      GROUP BY si.item_type_snapshot
      ORDER BY revenue DESC`,
      [auth.businessId, startDate]
    );

    return jsonResponse({
      success: true,
      data: {
        summary,
        items: itemSales,
        topSellers,
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
