import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { SupplierBill } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - Get notification counts for pending/overdue bills
export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Only admin and owner can see notifications
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const threeDaysFromNow = now + (3 * 24 * 60 * 60); // 3 days in seconds

    // Get pending bills
    const pendingBills = await query<SupplierBill>(
      `SELECT * FROM supplier_bills 
       WHERE business_id = ? AND status = 'pending' AND due_date >= ?
       ORDER BY due_date ASC`,
      [auth.businessId, now]
    );

    // Get overdue bills
    const overdueBills = await query<SupplierBill>(
      `SELECT * FROM supplier_bills 
       WHERE business_id = ? AND status IN ('pending', 'overdue') AND due_date < ?
       ORDER BY due_date ASC`,
      [auth.businessId, now]
    );

    // Get bills due in next 3 days
    const upcomingBills = await query<SupplierBill>(
      `SELECT * FROM supplier_bills 
       WHERE business_id = ? AND status = 'pending' 
       AND due_date >= ? AND due_date <= ?
       ORDER BY due_date ASC`,
      [auth.businessId, now, threeDaysFromNow]
    );

    // Calculate total amounts
    const totalPending = pendingBills.reduce((sum, bill) => sum + bill.amount, 0);
    const totalOverdue = overdueBills.reduce((sum, bill) => sum + bill.amount, 0);
    const totalUpcoming = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);

    return jsonResponse({
      success: true,
      data: {
        pending: {
          count: pendingBills.length,
          total: totalPending,
          bills: pendingBills,
        },
        overdue: {
          count: overdueBills.length,
          total: totalOverdue,
          bills: overdueBills,
        },
        upcoming: {
          count: upcomingBills.length,
          total: totalUpcoming,
          bills: upcomingBills,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching bill notifications:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch notifications',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
