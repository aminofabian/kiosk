import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import type { Business, User } from '@/lib/db/types';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id: businessId } = await params;

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

    return jsonResponse({
      success: true,
      data: {
        business,
        users,
        recentStats: recentStats || { recent_sales: 0, recent_revenue: 0 },
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
