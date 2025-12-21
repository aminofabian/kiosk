import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

interface SaleRow {
  id: string;
  total_amount: number;
  payment_method: string;
  sale_date: number;
  item_count: number;
  total_profit: number;
}

interface HourlyStat {
  hour: number;
  customers: number;
  sales: number;
  profit: number;
  items: number;
}

interface DayOfWeekStat {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  dayName: string;
  customers: number;
  sales: number;
  profit: number;
  items: number;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // Default to today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const startTimestamp = startParam ? parseInt(startParam) : Math.floor(todayStart.getTime() / 1000);
    const endTimestamp = endParam ? parseInt(endParam) : Math.floor(todayEnd.getTime() / 1000);

    // Get all sales with aggregated data
    const sales = await query<SaleRow>(
      `SELECT 
        s.id,
        s.total_amount,
        s.payment_method,
        s.sale_date,
        COALESCE(SUM(si.quantity_sold), 0) as item_count,
        COALESCE(SUM(si.profit), 0) as total_profit
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.business_id = ? 
        AND s.status = 'completed'
        AND s.sale_date >= ? 
        AND s.sale_date <= ?
      GROUP BY s.id
      ORDER BY s.sale_date ASC`,
      [auth.businessId, startTimestamp, endTimestamp]
    );

    // Calculate metrics
    const totalCustomers = sales.length;
    const totalSales = sales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalProfit = sales.reduce((sum, s) => sum + s.total_profit, 0);
    const totalItems = sales.reduce((sum, s) => sum + s.item_count, 0);

    const avgSpend = totalCustomers > 0 ? totalSales / totalCustomers : 0;
    const avgProfit = totalCustomers > 0 ? totalProfit / totalCustomers : 0;
    const avgItems = totalCustomers > 0 ? totalItems / totalCustomers : 0;

    // Hourly breakdown (0-23)
    const hourlyMap = new Map<number, HourlyStat>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { hour: h, customers: 0, sales: 0, profit: 0, items: 0 });
    }

    for (const sale of sales) {
      const saleDate = new Date(sale.sale_date * 1000);
      const hour = saleDate.getHours();
      const stat = hourlyMap.get(hour)!;
      stat.customers += 1;
      stat.sales += sale.total_amount;
      stat.profit += sale.total_profit;
      stat.items += sale.item_count;
    }

    const hourlyStats = Array.from(hourlyMap.values()).filter(h => h.customers > 0);
    
    // Day of week breakdown (for monthly/weekly views)
    const dayOfWeekMap = new Map<number, DayOfWeekStat>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let d = 0; d < 7; d++) {
      dayOfWeekMap.set(d, { 
        day: d, 
        dayName: dayNames[d],
        customers: 0, 
        sales: 0, 
        profit: 0, 
        items: 0 
      });
    }

    for (const sale of sales) {
      const saleDate = new Date(sale.sale_date * 1000);
      const dayOfWeek = saleDate.getDay();
      const stat = dayOfWeekMap.get(dayOfWeek)!;
      stat.customers += 1;
      stat.sales += sale.total_amount;
      stat.profit += sale.total_profit;
      stat.items += sale.item_count;
    }

    const dayOfWeekStats = Array.from(dayOfWeekMap.values()).filter(d => d.customers > 0);
    const sortedByDaySales = [...dayOfWeekStats].sort((a, b) => b.sales - a.sales);
    const bestDayBySales = sortedByDaySales[0] || null;
    const worstDayBySales = sortedByDaySales[sortedByDaySales.length - 1] || null;
    
    // Find best/worst hours
    const sortedByCustomers = [...hourlyStats].sort((a, b) => b.customers - a.customers);
    const sortedBySales = [...hourlyStats].sort((a, b) => b.sales - a.sales);
    const sortedByProfit = [...hourlyStats].sort((a, b) => b.profit - a.profit);

    const bestHourByCustomers = sortedByCustomers[0] || null;
    const worstHourByCustomers = sortedByCustomers[sortedByCustomers.length - 1] || null;
    const bestHourBySales = sortedBySales[0] || null;
    const bestHourByProfit = sortedByProfit[0] || null;

    // Calculate hours open (first sale to last sale)
    let hoursOpen = 0;
    let avgCustomersPerHour = 0;
    if (sales.length > 0) {
      const firstSale = sales[0].sale_date;
      const lastSale = sales[sales.length - 1].sale_date;
      hoursOpen = Math.max(1, Math.ceil((lastSale - firstSale) / 3600));
      avgCustomersPerHour = totalCustomers / hoursOpen;
    }

    // Basket size distribution
    const smallBuyers = sales.filter(s => s.total_amount < 100).length;
    const mediumBuyers = sales.filter(s => s.total_amount >= 100 && s.total_amount <= 500).length;
    const largeBuyers = sales.filter(s => s.total_amount > 500).length;

    const basketDistribution = {
      small: { count: smallBuyers, percent: totalCustomers > 0 ? (smallBuyers / totalCustomers) * 100 : 0 },
      medium: { count: mediumBuyers, percent: totalCustomers > 0 ? (mediumBuyers / totalCustomers) * 100 : 0 },
      large: { count: largeBuyers, percent: totalCustomers > 0 ? (largeBuyers / totalCustomers) * 100 : 0 },
    };

    // Payment method distribution
    const paymentMethods = {
      cash: sales.filter(s => s.payment_method === 'cash').length,
      mpesa: sales.filter(s => s.payment_method === 'mpesa').length,
      credit: sales.filter(s => s.payment_method === 'credit').length,
    };

    const paymentDistribution = {
      cash: { count: paymentMethods.cash, percent: totalCustomers > 0 ? (paymentMethods.cash / totalCustomers) * 100 : 0 },
      mpesa: { count: paymentMethods.mpesa, percent: totalCustomers > 0 ? (paymentMethods.mpesa / totalCustomers) * 100 : 0 },
      credit: { count: paymentMethods.credit, percent: totalCustomers > 0 ? (paymentMethods.credit / totalCustomers) * 100 : 0 },
    };

    // Generate insights
    const insights: string[] = [];
    
    if (bestHourBySales && hourlyStats.length > 1) {
      const peakPercent = (bestHourBySales.sales / totalSales) * 100;
      if (peakPercent > 15) {
        insights.push(`Peak hour (${formatHour(bestHourBySales.hour)}) drives ${peakPercent.toFixed(0)}% of sales`);
      }
    }
    
    if (basketDistribution.small.percent > 50) {
      insights.push(`${basketDistribution.small.percent.toFixed(0)}% of customers buy less than KES 100`);
    }
    
    if (basketDistribution.large.percent > 10) {
      insights.push(`${basketDistribution.large.percent.toFixed(0)}% are high-value customers (>KES 500)`);
    }

    if (paymentDistribution.mpesa.percent > 30) {
      insights.push(`M-Pesa usage is strong at ${paymentDistribution.mpesa.percent.toFixed(0)}%`);
    }

    if (avgProfit > 0 && avgSpend > 0) {
      const profitMarginPerCustomer = (avgProfit / avgSpend) * 100;
      insights.push(`Average ${profitMarginPerCustomer.toFixed(0)}% margin per customer`);
    }

    // Profitable hours count
    const profitableHours = hourlyStats.filter(h => h.profit > 0).length;
    if (hourlyStats.length > 0) {
      insights.push(`Profitable in ${profitableHours} of ${hourlyStats.length} active hours`);
    }

    return jsonResponse({
      success: true,
      data: {
        summary: {
          totalCustomers,
          totalSales,
          totalProfit,
          totalItems,
          avgSpend,
          avgProfit,
          avgItems,
          hoursOpen,
          avgCustomersPerHour,
        },
        hourly: hourlyStats,
        peakHours: {
          byCustomers: bestHourByCustomers,
          bySales: bestHourBySales,
          byProfit: bestHourByProfit,
          slowest: worstHourByCustomers,
        },
        dayOfWeek: dayOfWeekStats,
        peakDays: {
          bySales: bestDayBySales,
          worst: worstDayBySales,
        },
        basketDistribution,
        paymentDistribution,
        insights,
      },
    });
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    return jsonResponse({ success: false, message: 'Failed to fetch customer analytics' }, 500);
  }
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}
