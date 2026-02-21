import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    const now = Math.floor(Date.now() / 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartUnix = Math.floor(todayStart.getTime() / 1000);

    let startDate = todayStartUnix;
    let endDate = now;
    let periodLabel = 'Today';
    let prevStartDate = todayStartUnix - 86400;
    let prevEndDate = todayStartUnix - 1;

    switch (period) {
      case 'today':
        startDate = todayStartUnix;
        endDate = now;
        prevStartDate = todayStartUnix - 86400;
        prevEndDate = todayStartUnix - 1;
        periodLabel = 'Today';
        break;
      case 'yesterday': {
        startDate = todayStartUnix - 86400;
        endDate = todayStartUnix - 1;
        prevStartDate = todayStartUnix - 172800;
        prevEndDate = todayStartUnix - 86401;
        periodLabel = 'Yesterday';
        break;
      }
      case 'this_week': {
        const day = new Date().getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;
        const mondayStart = new Date(todayStart);
        mondayStart.setDate(mondayStart.getDate() - mondayOffset);
        startDate = Math.floor(mondayStart.getTime() / 1000);
        endDate = now;
        prevStartDate = startDate - 604800;
        prevEndDate = startDate - 1;
        periodLabel = 'This Week';
        break;
      }
      case 'last_week': {
        const day2 = new Date().getDay();
        const mondayOffset2 = day2 === 0 ? 6 : day2 - 1;
        const mondayStart2 = new Date(todayStart);
        mondayStart2.setDate(mondayStart2.getDate() - mondayOffset2);
        const thisMondayUnix = Math.floor(mondayStart2.getTime() / 1000);
        startDate = thisMondayUnix - 604800;
        endDate = thisMondayUnix - 1;
        prevStartDate = startDate - 604800;
        prevEndDate = startDate - 1;
        periodLabel = 'Last Week';
        break;
      }
      case 'this_month': {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        startDate = Math.floor(monthStart.getTime() / 1000);
        endDate = now;
        const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        prevStartDate = Math.floor(prevMonthStart.getTime() / 1000);
        prevEndDate = startDate - 1;
        periodLabel = 'This Month';
        break;
      }
      case 'last_month': {
        const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const prevMonthStart2 = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        startDate = Math.floor(prevMonthStart2.getTime() / 1000);
        endDate = Math.floor(thisMonthStart.getTime() / 1000) - 1;
        const prevPrevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
        prevStartDate = Math.floor(prevPrevMonthStart.getTime() / 1000);
        prevEndDate = startDate - 1;
        periodLabel = 'Last Month';
        break;
      }
      case 'last_7_days':
        startDate = now - 604800;
        endDate = now;
        prevStartDate = startDate - 604800;
        prevEndDate = startDate - 1;
        periodLabel = 'Last 7 Days';
        break;
      case 'last_30_days':
        startDate = now - 2592000;
        endDate = now;
        prevStartDate = startDate - 2592000;
        prevEndDate = startDate - 1;
        periodLabel = 'Last 30 Days';
        break;
    }

    const bid = auth.businessId;

    // 1) Sales summary
    const [summaryRow] = await query<{
      total_transactions: number;
      total_items_sold: number;
      total_revenue: number;
      total_cost: number;
      total_profit: number;
      unique_customers: number;
    }>(
      `SELECT 
        COUNT(DISTINCT s.id) as total_transactions,
        COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.quantity_sold * si.buy_price_per_unit), 0) as total_cost,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COUNT(DISTINCT CASE WHEN s.customer_name IS NOT NULL AND s.customer_name != '' THEN s.customer_name END) as unique_customers
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?`,
      [bid, startDate, endDate]
    );

    // 2) Previous period summary (for comparison)
    const [prevSummaryRow] = await query<{
      total_revenue: number;
      total_profit: number;
      total_transactions: number;
      total_items_sold: number;
    }>(
      `SELECT 
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COUNT(DISTINCT s.id) as total_transactions,
        COALESCE(SUM(si.quantity_sold), 0) as total_items_sold
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?`,
      [bid, prevStartDate, prevEndDate]
    );

    // 3) Top selling items by quantity (include parent info for grouping variants)
    const topByQuantity = await query<{
      item_id: string;
      parent_item_id: string | null;
      parent_name: string | null;
      item_name: string;
      variant_name: string | null;
      category_name: string;
      item_type: string;
      total_quantity: number;
      total_revenue: number;
      total_profit: number;
      transaction_count: number;
    }>(
      `SELECT 
        i.id as item_id,
        i.parent_item_id,
        parent.name as parent_name,
        i.name as item_name,
        i.variant_name,
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(si.item_type_snapshot, i.item_type) as item_type,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items parent ON i.parent_item_id = parent.id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY i.id, i.parent_item_id, parent.name, i.name, i.variant_name, c.name, si.item_type_snapshot, i.item_type
      ORDER BY total_quantity DESC
      LIMIT 50`,
      [bid, startDate, endDate]
    );

    // 4) Top selling items by revenue
    const topByRevenue = await query<{
      item_id: string;
      parent_item_id: string | null;
      parent_name: string | null;
      item_name: string;
      variant_name: string | null;
      category_name: string;
      item_type: string;
      total_quantity: number;
      total_revenue: number;
      total_profit: number;
    }>(
      `SELECT 
        i.id as item_id,
        i.parent_item_id,
        parent.name as parent_name,
        i.name as item_name,
        i.variant_name,
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(si.item_type_snapshot, i.item_type) as item_type,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items parent ON i.parent_item_id = parent.id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY i.id, i.parent_item_id, parent.name, i.name, i.variant_name, c.name, si.item_type_snapshot, i.item_type
      ORDER BY total_revenue DESC
      LIMIT 50`,
      [bid, startDate, endDate]
    );

    // 5) Top items by type — one query, grouped by item_type_snapshot
    const topItemsByType = await query<{
      item_id: string;
      parent_item_id: string | null;
      parent_name: string | null;
      item_name: string;
      variant_name: string | null;
      category_name: string;
      item_type: string;
      total_quantity: number;
      total_revenue: number;
      total_profit: number;
    }>(
      `SELECT 
        i.id as item_id,
        i.parent_item_id,
        parent.name as parent_name,
        i.name as item_name,
        i.variant_name,
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(si.item_type_snapshot, i.item_type) as item_type,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN items parent ON i.parent_item_id = parent.id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY i.id, i.parent_item_id, parent.name, i.name, i.variant_name, c.name, item_type
      ORDER BY total_revenue DESC
      LIMIT 100`,
      [bid, startDate, endDate]
    );

    const topGrocery = topItemsByType.filter((i) => i.item_type === 'grocery').slice(0, 30);
    const topRetail = topItemsByType.filter((i) => i.item_type === 'retail').slice(0, 30);

    // 7) Sales by payment method
    const paymentMethods = await query<{
      payment_method: string;
      count: number;
      total: number;
    }>(
      `SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as total
      FROM sales
      WHERE business_id = ? AND status = 'completed'
        AND sale_date >= ? AND sale_date <= ?
      GROUP BY payment_method
      ORDER BY total DESC`,
      [bid, startDate, endDate]
    );

    // 8) Sales by item type (dynamic — all product types)
    const itemTypeBreakdown = await query<{
      item_type: string;
      transaction_count: number;
      items_sold: number;
      revenue: number;
      cost: number;
      profit: number;
    }>(
      `SELECT 
        COALESCE(si.item_type_snapshot, i.item_type) as item_type,
        COUNT(DISTINCT s.id) as transaction_count,
        COALESCE(SUM(si.quantity_sold), 0) as items_sold,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
        COALESCE(SUM(si.quantity_sold * si.buy_price_per_unit), 0) as cost,
        COALESCE(SUM(si.profit), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY item_type
      ORDER BY revenue DESC`,
      [bid, startDate, endDate]
    );

    // 9) Category breakdown
    const categoryBreakdown = await query<{
      category_name: string;
      total_revenue: number;
      total_profit: number;
      total_items_sold: number;
      transaction_count: number;
    }>(
      `SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COALESCE(SUM(si.quantity_sold), 0) as total_items_sold,
        COUNT(DISTINCT s.id) as transaction_count
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY c.name
      ORDER BY total_revenue DESC`,
      [bid, startDate, endDate]
    );

    // 10) Hourly breakdown (for today/yesterday only, otherwise daily breakdown)
    let hourlyData: { hour: number; revenue: number; items_sold: number; transactions: number }[] = [];
    let dailyData: { date_key: string; date_label: string; revenue: number; profit: number; items_sold: number; transactions: number }[] = [];

    if (period === 'today' || period === 'yesterday') {
      hourlyData = await query<{
        hour: number;
        revenue: number;
        items_sold: number;
        transactions: number;
      }>(
        `SELECT 
          CAST(strftime('%H', s.sale_date, 'unixepoch', 'localtime') AS INTEGER) as hour,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
          COALESCE(SUM(si.quantity_sold), 0) as items_sold,
          COUNT(DISTINCT s.id) as transactions
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE s.business_id = ? AND s.status = 'completed'
          AND s.sale_date >= ? AND s.sale_date <= ?
        GROUP BY hour
        ORDER BY hour ASC`,
        [bid, startDate, endDate]
      );
    } else {
      dailyData = await query<{
        date_key: string;
        date_label: string;
        revenue: number;
        profit: number;
        items_sold: number;
        transactions: number;
      }>(
        `SELECT 
          DATE(s.sale_date, 'unixepoch', 'localtime') as date_key,
          strftime('%a %d', s.sale_date, 'unixepoch', 'localtime') as date_label,
          COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as revenue,
          COALESCE(SUM(si.profit), 0) as profit,
          COALESCE(SUM(si.quantity_sold), 0) as items_sold,
          COUNT(DISTINCT s.id) as transactions
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE s.business_id = ? AND s.status = 'completed'
          AND s.sale_date >= ? AND s.sale_date <= ?
        GROUP BY date_key
        ORDER BY date_key ASC`,
        [bid, startDate, endDate]
      );
    }

    // 11) Credit summary
    const [creditSummary] = await query<{
      total_credit_given: number;
      total_credit_paid: number;
      credit_transactions: number;
    }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN ct.type = 'credit' THEN ct.amount ELSE 0 END), 0) as total_credit_given,
        COALESCE(SUM(CASE WHEN ct.type = 'payment' THEN ct.amount ELSE 0 END), 0) as total_credit_paid,
        COUNT(*) as credit_transactions
      FROM credit_transactions ct
      JOIN credit_accounts ca ON ct.credit_account_id = ca.id
      WHERE ca.business_id = ? AND ct.created_at >= ? AND ct.created_at <= ?`,
      [bid, startDate, endDate]
    );

    // 12) Expenses summary
    const [expensesSummary] = await query<{
      total_expenses: number;
      expense_count: number;
    }>(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as expense_count
      FROM expenses
      WHERE business_id = ? AND active = 1
        AND created_at >= ? AND created_at <= ?`,
      [bid, startDate, endDate]
    );

    // 13) Supplier bills summary
    const [supplierSummary] = await query<{
      total_bills: number;
      total_amount: number;
      bills_paid: number;
      amount_paid: number;
    }>(
      `SELECT 
        COUNT(*) as total_bills,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as bills_paid,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as amount_paid
      FROM supplier_bills
      WHERE business_id = ? AND created_at >= ? AND created_at <= ?`,
      [bid, startDate, endDate]
    );

    // 14) Staff performance (who made the most sales)
    const staffPerformance = await query<{
      user_name: string;
      total_sales: number;
      total_revenue: number;
      items_sold: number;
    }>(
      `SELECT 
        u.name as user_name,
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(si.quantity_sold), 0) as items_sold
      FROM sales s
      JOIN users u ON s.user_id = u.id
      JOIN sale_items si ON s.id = si.sale_id
      WHERE s.business_id = ? AND s.status = 'completed'
        AND s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY s.user_id, u.name
      ORDER BY total_revenue DESC`,
      [bid, startDate, endDate]
    );

    // 15) Peak hour (highest revenue hour for today/yesterday)
    const peakHour = hourlyData.length > 0
      ? hourlyData.reduce((max, h) => h.revenue > max.revenue ? h : max, hourlyData[0])
      : null;

    // 16) Average transaction value
    const avgTransactionValue = summaryRow.total_transactions > 0
      ? summaryRow.total_revenue / summaryRow.total_transactions
      : 0;

    // Build comparison percentages
    const revenueChange = prevSummaryRow.total_revenue > 0
      ? ((summaryRow.total_revenue - prevSummaryRow.total_revenue) / prevSummaryRow.total_revenue) * 100
      : summaryRow.total_revenue > 0 ? 100 : 0;

    const profitChange = prevSummaryRow.total_profit > 0
      ? ((summaryRow.total_profit - prevSummaryRow.total_profit) / prevSummaryRow.total_profit) * 100
      : summaryRow.total_profit > 0 ? 100 : 0;

    const transactionsChange = prevSummaryRow.total_transactions > 0
      ? ((summaryRow.total_transactions - prevSummaryRow.total_transactions) / prevSummaryRow.total_transactions) * 100
      : summaryRow.total_transactions > 0 ? 100 : 0;

    // Business name
    const [business] = await query<{ name: string }>(
      `SELECT name FROM businesses WHERE id = ?`,
      [bid]
    );

    return jsonResponse({
      success: true,
      data: {
        businessName: business?.name || 'Business',
        period: periodLabel,
        dateRange: {
          start: startDate,
          end: endDate,
          startFormatted: new Date(startDate * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          endFormatted: new Date(endDate * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        },
        summary: {
          totalTransactions: summaryRow.total_transactions,
          totalItemsSold: summaryRow.total_items_sold,
          totalRevenue: summaryRow.total_revenue,
          totalCost: summaryRow.total_cost,
          totalProfit: summaryRow.total_profit,
          profitMargin: summaryRow.total_revenue > 0 ? (summaryRow.total_profit / summaryRow.total_revenue) * 100 : 0,
          uniqueCustomers: summaryRow.unique_customers,
          avgTransactionValue,
        },
        comparison: {
          revenueChange,
          profitChange,
          transactionsChange,
          prevRevenue: prevSummaryRow.total_revenue,
          prevProfit: prevSummaryRow.total_profit,
          prevTransactions: prevSummaryRow.total_transactions,
        },
        topByQuantity,
        topByRevenue,
        topGrocery,
        topRetail,
        paymentMethods,
        itemTypeBreakdown,
        categoryBreakdown,
        hourlyData,
        dailyData,
        creditSummary: creditSummary || { total_credit_given: 0, total_credit_paid: 0, credit_transactions: 0 },
        expensesSummary: expensesSummary || { total_expenses: 0, expense_count: 0 },
        supplierSummary: supplierSummary || { total_bills: 0, total_amount: 0, bills_paid: 0, amount_paid: 0 },
        staffPerformance,
        peakHour,
      },
    });
  } catch (error) {
    console.error('Error fetching daily summary report:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch report data', error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
}
