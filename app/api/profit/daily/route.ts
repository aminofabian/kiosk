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
  grossProfit: number;
  revenue: number;
  cost: number;
  stockLoss: number;
  expenses: number;
  transactions: number;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get('months') || '12');
    const itemType = searchParams.get('itemType');
    // Timezone offset in minutes from client (e.g., -180 for UTC+3)
    const tzOffset = parseInt(searchParams.get('tz') || '0');
    const tzOffsetSeconds = tzOffset * 60;

    // Prefer client-provided bounds (user's local timezone)
    const startRaw = searchParams.get('start');
    const endRaw = searchParams.get('end');
    const clientStart = startRaw ? parseInt(startRaw, 10) : null;
    const clientEnd = endRaw ? parseInt(endRaw, 10) : null;

    let startTimestamp: number;
    let endTimestamp: number;
    let rangeStartLabel: string;
    let rangeEndLabel: string;

    if (
      clientStart !== null &&
      clientEnd !== null &&
      Number.isInteger(clientStart) &&
      Number.isInteger(clientEnd) &&
      clientStart >= 0 &&
      clientEnd >= clientStart
    ) {
      startTimestamp = clientStart;
      endTimestamp = clientEnd;
      rangeStartLabel = searchParams.get('startDate') || '';
      rangeEndLabel = searchParams.get('endDate') || '';
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
      startTimestamp = Math.floor(startDate.getTime() / 1000);
      endTimestamp = Math.floor(endDate.getTime() / 1000);
      rangeStartLabel = startDate.toISOString().split('T')[0];
      rangeEndLabel = endDate.toISOString().split('T')[0];
    }

    // Build itemType filter
    const itemTypeFilter = itemType ? ` AND COALESCE(si.item_type_snapshot, 'retail') = ?` : '';
    const itemTypeParams = itemType ? [itemType] : [];

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
      END`;

    // Get daily aggregated profit data
    // Items without a known buy price are excluded from profit/revenue/cost
    // to avoid inflating profits (same approach as the main /api/profit endpoint).
    // Adjust for client's timezone by subtracting offset from Unix timestamp before DATE conversion.
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
          CASE WHEN ${buyPriceFallback} > 0
            THEN si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
            ELSE 0
          END
        ), 0) as total_profit,
        COALESCE(SUM(
          CASE WHEN ${buyPriceFallback} > 0
            THEN si.quantity_sold * si.sell_price_per_unit
            ELSE 0
          END
        ), 0) as total_revenue,
        COALESCE(SUM(
          CASE WHEN ${buyPriceFallback} > 0
            THEN si.quantity_sold * ${buyPriceFallback}
            ELSE 0
          END
        ), 0) as total_cost,
        COUNT(DISTINCT s.id) as transaction_count
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.business_id = ? 
         AND s.status = 'completed'
         AND s.sale_date >= ? 
         AND s.sale_date <= ?
         ${itemTypeFilter}
       GROUP BY sale_day
       ORDER BY sale_day ASC`,
      [
        tzOffsetSeconds,
        // buyPriceFallback: 5 usages × 2 buyPriceRaw = 10 placeholders
        auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId,
        auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId,
        // WHERE clause
        auth.businessId,
        startTimestamp, endTimestamp,
        ...itemTypeParams
      ]
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

    // Get daily operating cost from expenses (must match /api/expenses/daily-cost logic)
    const expenses = await query<{ amount: number; frequency: string }>(
      `SELECT amount, frequency FROM expenses 
       WHERE business_id = ? AND active = 1`,
      [auth.businessId]
    );

    const FREQUENCY_DIVISORS: Record<string, number> = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      yearly: 365,
      'one-time': Infinity, // one-time expenses do not contribute to daily cost
    };

    let dailyOperatingCost = 0;
    for (const expense of expenses) {
      if (expense.frequency === 'one-time') continue;
      const divisor = FREQUENCY_DIVISORS[expense.frequency] ?? 30;
      dailyOperatingCost += expense.amount / divisor;
    }

    // When filtering by department (itemType), show gross profit only (revenue - COGS).
    // Stock losses and operating expenses are business-wide and only make sense on the combined view.
    const isFiltered = !!itemType;

    // Map daily stock losses by local date
    const lossByDate: Record<string, number> = {};
    for (const row of dailyLosses) {
      lossByDate[row.loss_day] = row.total_loss;
    }

    // Transform to a map for easy lookup
    const profitByDate: Record<string, DailyProfit> = {};
    let maxProfit = 0;
    let minProfit = 0;
    let totalDaysWithActivity = 0;
    let profitableDays = 0;
    let lossDays = 0;

    // Process sales data
    for (const row of dailyData) {
      let dayProfit: number;
      let dayCost: number;

      let dayStockLoss = 0;
      let dayExpenses = 0;

      if (isFiltered) {
        // Department view: gross profit only (revenue - COGS)
        dayProfit = row.total_profit;
        dayCost = row.total_cost;
      } else {
        // Combined view: net profit (gross profit - stock losses - daily expenses)
        dayStockLoss = lossByDate[row.sale_day] || 0;
        dayExpenses = dailyOperatingCost;
        dayProfit = row.total_profit - dayStockLoss - dayExpenses;
        dayCost = row.total_cost;
      }

      profitByDate[row.sale_day] = {
        date: row.sale_day,
        profit: dayProfit,
        grossProfit: row.total_profit,
        revenue: row.total_revenue,
        cost: dayCost,
        stockLoss: dayStockLoss,
        expenses: dayExpenses,
        transactions: row.transaction_count,
      };
      
      if (dayProfit > maxProfit) maxProfit = dayProfit;
      if (dayProfit < minProfit) minProfit = dayProfit;
      totalDaysWithActivity++;
      if (dayProfit > 0) profitableDays++;
      if (dayProfit < 0) lossDays++;
    }

    // Add loss-only days (days with stock losses but no sales)
    if (!isFiltered) {
      for (const [day, loss] of Object.entries(lossByDate)) {
        if (profitByDate[day]) continue;
        const dayExpenses = dailyOperatingCost;
        const dayProfit = -loss - dayExpenses;

        profitByDate[day] = {
          date: day,
          profit: dayProfit,
          grossProfit: 0,
          revenue: 0,
          cost: 0,
          stockLoss: loss,
          expenses: dayExpenses,
          transactions: 0,
        };

        if (dayProfit > maxProfit) maxProfit = dayProfit;
        if (dayProfit < minProfit) minProfit = dayProfit;
        totalDaysWithActivity++;
        if (dayProfit > 0) profitableDays++;
        else if (dayProfit < 0) lossDays++;
      }
    }

    return jsonResponse({
      success: true,
      data: {
        dailyProfits: profitByDate,
        mode: isFiltered ? 'gross' : 'net',
        stats: {
          maxProfit,
          minProfit,
          totalDaysWithActivity,
          profitableDays,
          lossDays,
          neutralDays: totalDaysWithActivity - profitableDays - lossDays,
        },
        dateRange: {
          start: rangeStartLabel,
          end: rangeEndLabel,
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
