import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

interface DailySales {
  date_label: string;
  date_key: string;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_items_sold: number;
  transaction_count: number;
}

interface HourlySales {
  hour: number;
  revenue: number;
  items_sold: number;
  transaction_count: number;
}

interface CategoryBreakdown {
  category_name: string;
  total_revenue: number;
  total_profit: number;
  total_items_sold: number;
  transaction_count: number;
}

interface DailyProduct {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  category_name: string;
  unit_type: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_profit: number;
  avg_sell_price: number;
  transaction_count: number;
  current_stock: number;
  min_stock_level: number | null;
}

/** Start of the next calendar day after `dateYmd` (YYYY-MM-DD), server local TZ, as Unix seconds. */
function startOfNextLocalDayUnix(dateYmd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) return Math.floor(Date.now() / 1000);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const next = new Date(y, mo - 1, d);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return Math.floor(next.getTime() / 1000);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const itemType = searchParams.get('itemType') || '';
    const days = parseInt(searchParams.get('days') || '7', 10);
    const selectedDate = searchParams.get('date'); // specific date in YYYY-MM-DD format

    const now = Math.floor(Date.now() / 1000);
    const startDate = now - (days * 24 * 60 * 60);

    // Daily sales totals
    const dailySales = await query<DailySales>(
      `SELECT 
        DATE(s.sale_date, 'unixepoch', 'localtime') as date_key,
        CASE 
          WHEN DATE(s.sale_date, 'unixepoch', 'localtime') = DATE('now', 'localtime') THEN 'Today'
          WHEN DATE(s.sale_date, 'unixepoch', 'localtime') = DATE('now', '-1 day', 'localtime') THEN 'Yesterday'
          ELSE strftime('%a %d %b', s.sale_date, 'unixepoch', 'localtime')
        END as date_label,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.quantity_sold * si.buy_price_per_unit), 0) as total_cost,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = ? AND s.status = 'completed' AND s.sale_date >= ?
        AND COALESCE(si.item_type_snapshot, 'retail') = ?
      GROUP BY date_key
      ORDER BY date_key DESC`,
      [auth.businessId, startDate, itemType]
    );

    // Hourly breakdown for today (or selected date)
    const hourlyDateFilter = selectedDate
      ? `DATE(s.sale_date, 'unixepoch', 'localtime') = ?`
      : `DATE(s.sale_date, 'unixepoch', 'localtime') = DATE('now', 'localtime')`;
    const hourlyParams = selectedDate
      ? [auth.businessId, itemType, selectedDate]
      : [auth.businessId, itemType];

    const hourlySales = await query<HourlySales>(
      `SELECT 
        CAST(strftime('%H', s.sale_date, 'unixepoch', 'localtime') AS INTEGER) as hour,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
        COALESCE(SUM(si.quantity_sold), 0) as items_sold,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND COALESCE(si.item_type_snapshot, 'retail') = ?
        AND ${hourlyDateFilter}
      GROUP BY hour
      ORDER BY hour ASC`,
      hourlyParams
    );

    // Category breakdown for the period
    const categoryBreakdown = await query<CategoryBreakdown>(
      `SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE s.business_id = ? AND s.status = 'completed' AND s.sale_date >= ?
        AND COALESCE(si.item_type_snapshot, 'retail') = ?
      GROUP BY c.name
      ORDER BY total_revenue DESC`,
      [auth.businessId, startDate, itemType]
    );

    // Products sold on selected date (or today). For a past date, stock is estimated at end of
    // that day by rolling back completed sales, adjustments, and batch receipts since then.
    const productsDateFilter = selectedDate
      ? `DATE(s.sale_date, 'unixepoch', 'localtime') = ?`
      : `DATE(s.sale_date, 'unixepoch', 'localtime') = DATE('now', 'localtime')`;
    const productsParams = selectedDate
      ? [auth.businessId, itemType, selectedDate]
      : [auth.businessId, itemType];

    const dailyProductsSqlBase = `
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND COALESCE(si.item_type_snapshot, 'retail') = ?
        AND ${productsDateFilter}`;

    let dailyProducts: DailyProduct[];

    if (selectedDate) {
      const boundary = startOfNextLocalDayUnix(selectedDate);
      dailyProducts = await query<DailyProduct>(
        `SELECT 
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        COALESCE(c.name, 'Uncategorized') as category_name,
        i.unit_type,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity_sold,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COALESCE(AVG(si.sell_price_per_unit), 0) as avg_sell_price,
        COUNT(DISTINCT s.id) as transaction_count,
        max(0,
          i.current_stock
          + COALESCE((SELECT SUM(si2.quantity_sold) FROM sale_items si2
              INNER JOIN sales s2 ON s2.id = si2.sale_id
              WHERE si2.item_id = i.id AND s2.business_id = ?
                AND s2.status = 'completed' AND s2.sale_date >= ?
                AND COALESCE(si2.item_type_snapshot, 'retail') = ?), 0)
          - COALESCE((SELECT SUM(sa.difference) FROM stock_adjustments sa
              WHERE sa.item_id = i.id AND sa.business_id = ? AND sa.created_at >= ?), 0)
          - COALESCE((SELECT SUM(ib.initial_quantity) FROM inventory_batches ib
              WHERE ib.item_id = i.id AND ib.business_id = ? AND ib.created_at >= ?), 0)
        ) as current_stock,
        i.min_stock_level
      ${dailyProductsSqlBase}
      GROUP BY i.id, i.name, i.variant_name, c.name, i.unit_type, i.current_stock, i.min_stock_level
      ORDER BY total_revenue DESC`,
        [
          auth.businessId,
          boundary,
          itemType,
          auth.businessId,
          boundary,
          auth.businessId,
          boundary,
          ...productsParams,
        ]
      );
    } else {
      dailyProducts = await query<DailyProduct>(
        `SELECT 
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        COALESCE(c.name, 'Uncategorized') as category_name,
        i.unit_type,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity_sold,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COALESCE(AVG(si.sell_price_per_unit), 0) as avg_sell_price,
        COUNT(DISTINCT s.id) as transaction_count,
        i.current_stock,
        i.min_stock_level
      ${dailyProductsSqlBase}
      GROUP BY i.id, i.name, i.variant_name, c.name, i.unit_type, i.current_stock, i.min_stock_level
      ORDER BY total_revenue DESC`,
        productsParams
      );
    }

    // Overall summary for the period
    const periodSummary = dailySales.reduce(
      (acc, day) => ({
        totalRevenue: acc.totalRevenue + day.total_revenue,
        totalCost: acc.totalCost + day.total_cost,
        totalProfit: acc.totalProfit + day.total_profit,
        totalItemsSold: acc.totalItemsSold + day.total_items_sold,
        totalTransactions: acc.totalTransactions + day.transaction_count,
        daysWithSales: acc.daysWithSales + 1,
      }),
      { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalItemsSold: 0, totalTransactions: 0, daysWithSales: 0 }
    );

    const avgDailyRevenue = periodSummary.daysWithSales > 0
      ? periodSummary.totalRevenue / periodSummary.daysWithSales
      : 0;

    // Today vs yesterday comparison
    const todayData = dailySales.find(d => d.date_label === 'Today');
    const yesterdayData = dailySales.find(d => d.date_label === 'Yesterday');
    const todayRevenue = todayData?.total_revenue ?? 0;
    const yesterdayRevenue = yesterdayData?.total_revenue ?? 0;
    const revenueChange = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : todayRevenue > 0 ? 100 : 0;

    // Stock alerts for this item type
    const stockAlerts = await query<{
      item_id: string;
      item_name: string;
      variant_name: string | null;
      current_stock: number;
      min_stock_level: number | null;
      unit_type: string;
    }>(
      `SELECT 
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        i.current_stock,
        i.min_stock_level,
        i.unit_type
      FROM items i
      WHERE i.business_id = ? AND i.item_type = ? AND i.active = 1
        AND (i.current_stock <= 0 OR (i.min_stock_level IS NOT NULL AND i.current_stock <= i.min_stock_level))
        AND (i.parent_item_id IS NOT NULL OR 
             (i.parent_item_id IS NULL AND NOT EXISTS (
               SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1
             )))
      ORDER BY i.current_stock ASC`,
      [auth.businessId, itemType]
    );

    return jsonResponse({
      success: true,
      data: {
        dailySales,
        hourlySales,
        categoryBreakdown,
        dailyProducts,
        stockAlerts,
        summary: {
          ...periodSummary,
          avgDailyRevenue,
          profitMargin: periodSummary.totalRevenue > 0
            ? (periodSummary.totalProfit / periodSummary.totalRevenue) * 100
            : 0,
        },
        comparison: {
          todayRevenue,
          yesterdayRevenue,
          revenueChange,
          todayItems: todayData?.total_items_sold ?? 0,
          todayTransactions: todayData?.transaction_count ?? 0,
          todayProfit: todayData?.total_profit ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching daily sales analytics:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch daily sales analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
