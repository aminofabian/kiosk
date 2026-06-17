import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import { getSalesPeriodRange } from '@/lib/utils/sales-period';
import type { Business, User, Domain } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

interface BusinessDetails extends Business {
  user_count: number;
  total_sales: number;
  sales_count: number;
  items_count: number;
  categories_count: number;
}

const PERIOD_LABELS: Record<string, string> = {
  all: 'All time',
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month: 'Last 30 days',
};

function resolveSalesPeriod(request: NextRequest): {
  period: string;
  start: number;
  end: number | null;
} {
  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') || 'all';

  const startRaw = searchParams.get('start');
  const endRaw = searchParams.get('end');
  const clientStart = startRaw ? parseInt(startRaw, 10) : null;
  const clientEnd = endRaw ? parseInt(endRaw, 10) : null;

  if (
    clientStart !== null &&
    Number.isInteger(clientStart) &&
    clientStart >= 0 &&
    (clientEnd === null || (Number.isInteger(clientEnd) && clientEnd > clientStart))
  ) {
    return { period: 'custom', start: clientStart, end: clientEnd };
  }

  const range = getSalesPeriodRange(period);
  return { period, start: range.start, end: range.end };
}

function saleTimestampSql(alias: string): string {
  return `COALESCE(${alias}.sale_date, ${alias}.created_at)`;
}

function buildSaleDateWhere(alias: string, start: number, end: number | null): {
  sql: string;
  params: number[];
} {
  const ts = saleTimestampSql(alias);
  if (end != null) {
    return {
      sql: ` AND ${ts} >= ? AND ${ts} < ?`,
      params: [start, end],
    };
  }
  if (start > 0) {
    return { sql: ` AND ${ts} >= ?`, params: [start] };
  }
  return { sql: '', params: [] };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id: businessId } = await params;
    const { period, start: periodStart, end: periodEnd } = resolveSalesPeriod(request);
    const periodLabel = PERIOD_LABELS[period] ?? 'Custom range';
    const saleDateWhere = buildSaleDateWhere('s', periodStart, periodEnd);
    const salesLimit = period === 'all' ? 15 : 50;

    const business = await queryOne<BusinessDetails>(
      `SELECT 
        b.*,
        (SELECT COUNT(*) FROM users WHERE business_id = b.id) as user_count,
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE business_id = b.id AND status = 'completed'), 0) as total_sales,
        (SELECT COUNT(*) FROM sales WHERE business_id = b.id AND status = 'completed') as sales_count,
        (SELECT COUNT(*) FROM items WHERE business_id = b.id) as items_count,
        (SELECT COUNT(*) FROM categories WHERE business_id = b.id) as categories_count
       FROM businesses b
       WHERE b.id = ?`,
      [businessId]
    );

    if (!business) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    const users = await query<Omit<User, 'password_hash'>>(
      `SELECT id, business_id, name, email, role, pin, active, created_at
       FROM users
       WHERE business_id = ?
       ORDER BY created_at DESC`,
      [businessId]
    );

    // Get recent sales stats
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const recentStats = await queryOne<{
      recent_sales: number;
      recent_revenue: number;
    }>(
      `SELECT 
        COUNT(*) as recent_sales,
        COALESCE(SUM(total_amount), 0) as recent_revenue
       FROM sales
       WHERE business_id = ? AND status = 'completed' AND sale_date >= ?`,
      [businessId, thirtyDaysAgo]
    );

    let domains: Domain[] = [];
    try {
      domains = await query<Domain>(
        `SELECT * FROM domains WHERE business_id = ? ORDER BY is_primary DESC, domain ASC`,
        [businessId]
      );
    } catch (error) {
      // Domains table might not exist yet if migration hasn't run
      console.warn('Domains table not found, skipping domain fetch:', error);
    }

    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

    const todayStats = await queryOne<{
      sales_count: number;
      revenue: number;
    }>(
      `SELECT 
        COUNT(*) as sales_count,
        COALESCE(SUM(total_amount), 0) as revenue
       FROM sales
       WHERE business_id = ? AND status = 'completed' AND COALESCE(sale_date, created_at) >= ?`,
      [businessId, startOfToday]
    );

    const periodStats = await queryOne<{
      sales_count: number;
      revenue: number;
    }>(
      `SELECT 
        COUNT(*) as sales_count,
        COALESCE(SUM(total_amount), 0) as revenue
       FROM sales s
       WHERE s.business_id = ? AND s.status = 'completed'${saleDateWhere.sql}`,
      [businessId, ...saleDateWhere.params]
    );

    const recentSales = await query<{
      id: string;
      total_amount: number;
      payment_method: string;
      status: string;
      sale_date: number | null;
      created_at: number;
      cashier_name: string;
      item_count: number;
    }>(
      `SELECT 
        s.id,
        s.total_amount,
        s.payment_method,
        s.status,
        s.sale_date,
        s.created_at,
        u.name as cashier_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
       FROM sales s
       JOIN users u ON s.user_id = u.id
       WHERE s.business_id = ? AND s.status = 'completed'${saleDateWhere.sql}
       ORDER BY ${saleTimestampSql('s')} DESC
       LIMIT ${salesLimit}`,
      [businessId, ...saleDateWhere.params]
    );

    const topItemsDateWhere = buildSaleDateWhere('s', periodStart, periodEnd);
    const topItemsHaving = period !== 'all' ? ' HAVING total_quantity_sold > 0' : '';
    const topItems = await query<{
      id: string;
      name: string;
      category_name: string;
      current_stock: number;
      current_sell_price: number;
      total_quantity_sold: number;
      total_revenue: number;
    }>(
      `SELECT 
        i.id,
        i.name,
        c.name as category_name,
        i.current_stock,
        i.current_sell_price,
        COALESCE(SUM(si.quantity_sold), 0) as total_quantity_sold,
        COALESCE(SUM(si.quantity_sold * si.sell_price_per_unit), 0) as total_revenue
       FROM items i
       JOIN categories c ON i.category_id = c.id
       LEFT JOIN sale_items si ON si.item_id = i.id
       LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'${topItemsDateWhere.sql}
       WHERE i.business_id = ? AND i.active = 1 AND i.parent_item_id IS NULL
       GROUP BY i.id${topItemsHaving}
       ORDER BY total_revenue DESC, i.name ASC
       LIMIT 10`,
      [...topItemsDateWhere.params, businessId]
    );

    const categories = await query<{
      id: string;
      name: string;
      active: number;
      items_count: number;
    }>(
      `SELECT 
        c.id,
        c.name,
        c.active,
        (SELECT COUNT(*) FROM items WHERE category_id = c.id AND active = 1) as items_count
       FROM categories c
       WHERE c.business_id = ?
       ORDER BY c.position ASC, c.name ASC`,
      [businessId]
    );

    const inventoryStats = await queryOne<{
      active_items: number;
      out_of_stock: number;
      low_stock: number;
      suppliers_count: number;
      expenses_count: number;
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE business_id = ? AND active = 1) as active_items,
        (SELECT COUNT(*) FROM items WHERE business_id = ? AND active = 1 AND current_stock <= 0) as out_of_stock,
        (SELECT COUNT(*) FROM items WHERE business_id = ? AND active = 1 AND min_stock_level IS NOT NULL AND current_stock > 0 AND current_stock <= min_stock_level) as low_stock,
        (SELECT COUNT(*) FROM suppliers WHERE business_id = ? AND active = 1) as suppliers_count,
        (SELECT COUNT(*) FROM expenses WHERE business_id = ? AND active = 1) as expenses_count`,
      [businessId, businessId, businessId, businessId, businessId]
    );

    const paymentBreakdown = await query<{
      payment_method: string;
      count: number;
      total: number;
    }>(
      `SELECT 
        s.payment_method,
        COUNT(*) as count,
        COALESCE(SUM(s.total_amount), 0) as total
       FROM sales s
       WHERE s.business_id = ? AND s.status = 'completed'${saleDateWhere.sql}
       GROUP BY s.payment_method
       ORDER BY total DESC`,
      [businessId, ...saleDateWhere.params]
    );

    return jsonResponse({
      success: true,
      data: {
        business,
        users,
        domains,
        period,
        periodLabel,
        periodStats: periodStats || { sales_count: 0, revenue: 0 },
        recentStats: recentStats || { recent_sales: 0, recent_revenue: 0 },
        todayStats: todayStats || { sales_count: 0, revenue: 0 },
        recentSales,
        topItems,
        categories,
        inventoryStats: inventoryStats || {
          active_items: 0,
          out_of_stock: 0,
          low_stock: 0,
          suppliers_count: 0,
          expenses_count: 0,
        },
        paymentBreakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching business:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch business' },
      500
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id: businessId } = await params;
    const body = await request.json();
    const { name, currency, timezone, active } = body;

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM businesses WHERE id = ?`,
      [businessId]
    );

    if (!existing) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    await execute(
      `UPDATE businesses 
       SET name = COALESCE(?, name),
           currency = COALESCE(?, currency),
           timezone = COALESCE(?, timezone),
           active = COALESCE(?, active)
       WHERE id = ?`,
      [name?.trim(), currency, timezone, active, businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Business updated successfully',
    });
  } catch (error) {
    console.error('Error updating business:', error);
    return jsonResponse(
      { success: false, message: 'Failed to update business' },
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id: businessId } = await params;

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM businesses WHERE id = ?`,
      [businessId]
    );

    if (!existing) {
      return jsonResponse(
        { success: false, message: 'Business not found' },
        404
      );
    }

    // Soft delete by setting active = 0
    await execute(
      `UPDATE businesses SET active = 0 WHERE id = ?`,
      [businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Business suspended successfully',
    });
  } catch (error) {
    console.error('Error deleting business:', error);
    return jsonResponse(
      { success: false, message: 'Failed to suspend business' },
      500
    );
  }
}
