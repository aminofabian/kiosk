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

    // Get daily stock losses (spoilage, theft, damage, other)
    // Try to get buy price from: 1) inventory_batches, 2) purchase_breakdowns, 3) sale_items
    const dailyLosses = await query<{
      loss_day: string;
      total_loss: number;
    }>(
      `SELECT 
        DATE(sa.created_at - ?, 'unixepoch') as loss_day,
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
        ), 0) as total_loss
       FROM stock_adjustments sa
       WHERE sa.business_id = ?
         AND sa.created_at >= ?
         AND sa.created_at <= ?
       GROUP BY loss_day
       HAVING total_loss > 0
       ORDER BY loss_day ASC`,
      [tzOffsetSeconds, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
    );

    // Create a map of daily losses
    const lossByDate: Record<string, number> = {};
    for (const row of dailyLosses) {
      lossByDate[row.loss_day] = row.total_loss;
    }

    // Transform to a map for easy lookup, subtracting losses from profit
    const profitByDate: Record<string, DailyProfit> = {};
    let maxProfit = 0;
    let minProfit = 0;
    let totalDaysWithActivity = 0;
    let profitableDays = 0;
    let lossDays = 0;

    // Process sales data
    for (const row of dailyData) {
      const stockLoss = lossByDate[row.sale_day] || 0;
      const adjustedProfit = row.total_profit - stockLoss;
      
      profitByDate[row.sale_day] = {
        date: row.sale_day,
        profit: adjustedProfit,
        revenue: row.total_revenue,
        cost: row.total_cost + stockLoss,
        transactions: row.transaction_count,
      };
      
      // Remove from losses map since we've processed it
      delete lossByDate[row.sale_day];
      
      if (adjustedProfit > maxProfit) maxProfit = adjustedProfit;
      if (adjustedProfit < minProfit) minProfit = adjustedProfit;
      totalDaysWithActivity++;
      if (adjustedProfit > 0) profitableDays++;
      if (adjustedProfit < 0) lossDays++;
    }

    // Add days that only have losses (no sales)
    for (const [lossDay, lossAmount] of Object.entries(lossByDate)) {
      const adjustedProfit = -lossAmount;
      
      profitByDate[lossDay] = {
        date: lossDay,
        profit: adjustedProfit,
        revenue: 0,
        cost: lossAmount,
        transactions: 0,
      };
      
      if (adjustedProfit < minProfit) minProfit = adjustedProfit;
      totalDaysWithActivity++;
      lossDays++;
    }

    return jsonResponse({
      success: true,
      data: {
        dailyProfits: profitByDate,
        stats: {
          maxProfit,
          minProfit,
          totalDaysWithActivity,
          profitableDays,
          lossDays,
          neutralDays: totalDaysWithActivity - profitableDays - lossDays,
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
