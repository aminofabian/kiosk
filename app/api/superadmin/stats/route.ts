import { queryOne, query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    // Get overall platform stats
    const platformStats = await queryOne<{
      total_businesses: number;
      active_businesses: number;
      total_users: number;
      total_sales: number;
      total_revenue: number;
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM businesses) as total_businesses,
        (SELECT COUNT(*) FROM businesses WHERE active = 1) as active_businesses,
        (SELECT COUNT(*) FROM users WHERE active = 1) as total_users,
        (SELECT COUNT(*) FROM sales WHERE status = 'completed') as total_sales,
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE status = 'completed'), 0) as total_revenue`
    );

    // Get stats for today
    const now = Math.floor(Date.now() / 1000);
    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);

    const todayStats = await queryOne<{
      sales_count: number;
      revenue: number;
    }>(
      `SELECT 
        COUNT(*) as sales_count,
        COALESCE(SUM(total_amount), 0) as revenue
       FROM sales
       WHERE status = 'completed' AND sale_date >= ?`,
      [startOfToday]
    );

    // Get stats for last 30 days
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const monthlyStats = await queryOne<{
      sales_count: number;
      revenue: number;
      new_businesses: number;
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM sales WHERE status = 'completed' AND sale_date >= ?) as sales_count,
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE status = 'completed' AND sale_date >= ?), 0) as revenue,
        (SELECT COUNT(*) FROM businesses WHERE created_at >= ?) as new_businesses`,
      [thirtyDaysAgo, thirtyDaysAgo, thirtyDaysAgo]
    );

    // Get top performing businesses (by revenue in last 30 days)
    const topBusinesses = await query<{
      id: string;
      name: string;
      revenue: number;
      sales_count: number;
    }>(
      `SELECT 
        b.id,
        b.name,
        COALESCE(SUM(s.total_amount), 0) as revenue,
        COUNT(s.id) as sales_count
       FROM businesses b
       LEFT JOIN sales s ON b.id = s.business_id AND s.status = 'completed' AND s.sale_date >= ?
       WHERE b.active = 1
       GROUP BY b.id, b.name
       ORDER BY revenue DESC
       LIMIT 5`,
      [thirtyDaysAgo]
    );

    // Get recent activity
    const recentBusinesses = await query<{
      id: string;
      name: string;
      created_at: number;
      user_count: number;
    }>(
      `SELECT 
        b.id,
        b.name,
        b.created_at,
        (SELECT COUNT(*) FROM users WHERE business_id = b.id) as user_count
       FROM businesses b
       ORDER BY b.created_at DESC
       LIMIT 5`
    );

    return jsonResponse({
      success: true,
      data: {
        platform: platformStats || {
          total_businesses: 0,
          active_businesses: 0,
          total_users: 0,
          total_sales: 0,
          total_revenue: 0,
        },
        today: todayStats || { sales_count: 0, revenue: 0 },
        monthly: monthlyStats || { sales_count: 0, revenue: 0, new_businesses: 0 },
        topBusinesses,
        recentBusinesses,
      },
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch platform stats' },
      500
    );
  }
}
