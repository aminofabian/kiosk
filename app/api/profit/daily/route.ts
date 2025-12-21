import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

interface DailyProfit {
  date: string;
  profit: number;
  revenue: number;
  cost: number;
  transactions: number;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');
    // Get timezone offset in minutes from client (e.g., -180 for UTC+3)
    const tzOffset = parseInt(searchParams.get('tz') || '0');
    // Convert to seconds for SQL calculation
    const tzOffsetSeconds = tzOffset * 60;
    
    // Calculate date range (last N months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1); // Start from first day of that month
    
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    // Get daily aggregated profit data
    // Adjust for client's timezone by subtracting offset from Unix timestamp before DATE conversion
    // (negative offset means ahead of UTC, so we subtract to get local time)
    const dailyData = await query<{
      sale_day: string;
      total_profit: number;
      total_revenue: number;
      total_cost: number;
      transaction_count: number;
    }>(
      `SELECT 
        DATE(s.sale_date - ?, 'unixepoch') as sale_day,
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
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue,
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
        COUNT(DISTINCT s.id) as transaction_count
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.business_id = ? 
         AND s.status = 'completed'
         AND s.sale_date >= ? 
         AND s.sale_date <= ?
       GROUP BY sale_day
       ORDER BY sale_day ASC`,
      [tzOffsetSeconds, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
    );

    // Transform to a map for easy lookup
    const profitByDate: Record<string, DailyProfit> = {};
    let maxProfit = 0;
    let minProfit = 0;
    let totalDaysWithSales = 0;
    let profitableDays = 0;
    let lossDays = 0;

    for (const row of dailyData) {
      const profit = row.total_profit;
      profitByDate[row.sale_day] = {
        date: row.sale_day,
        profit,
        revenue: row.total_revenue,
        cost: row.total_cost,
        transactions: row.transaction_count,
      };
      
      if (profit > maxProfit) maxProfit = profit;
      if (profit < minProfit) minProfit = profit;
      totalDaysWithSales++;
      if (profit > 0) profitableDays++;
      if (profit < 0) lossDays++;
    }

    return jsonResponse({
      success: true,
      data: {
        dailyProfits: profitByDate,
        stats: {
          maxProfit,
          minProfit,
          totalDaysWithSales,
          profitableDays,
          lossDays,
          neutralDays: totalDaysWithSales - profitableDays - lossDays,
        },
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      },
    });
  } catch (error) {
    console.error('Error fetching daily profit:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch daily profit data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
