import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import os from 'os';

export async function OPTIONS() {
  return optionsResponse();
}

interface CountResult {
  count: number;
}

export async function GET() {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    // Fetch platform statistics
    const [
      businessesResult,
      usersResult,
      superAdminsResult,
      domainsResult,
      itemsResult,
      salesResult,
      categoriesResult,
    ] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) as count FROM businesses`),
      query<CountResult>(`SELECT COUNT(*) as count FROM users`),
      query<CountResult>(`SELECT COUNT(*) as count FROM super_admins`),
      query<CountResult>(`SELECT COUNT(*) as count FROM domains`),
      query<CountResult>(`SELECT COUNT(*) as count FROM items`),
      query<CountResult>(`SELECT COUNT(*) as count FROM sales WHERE status = 'completed'`),
      query<CountResult>(`SELECT COUNT(*) as count FROM categories`),
    ]);

    const stats = {
      businesses: businessesResult[0]?.count || 0,
      users: usersResult[0]?.count || 0,
      superAdmins: superAdminsResult[0]?.count || 0,
      domains: domainsResult[0]?.count || 0,
      items: itemsResult[0]?.count || 0,
      sales: salesResult[0]?.count || 0,
      categories: categoriesResult[0]?.count || 0,
    };

    // Get system information
    const memUsage = process.memoryUsage();
    const systemInfo = {
      nodeVersion: process.version,
      platform: `${os.type()} ${os.release()}`,
      uptime: process.uptime(),
      memoryUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
      },
    };

    return jsonResponse({
      success: true,
      data: {
        stats,
        system: systemInfo,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch settings' },
      500
    );
  }
}
