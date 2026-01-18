import { NextRequest } from 'next/server';
import { execute, query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import type { StockApprovalRequest } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - List pending approval requests (admin/owner only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    // Only admin and owner can view approval requests
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const requests = await query<StockApprovalRequest & {
      item_name: string;
      item_unit_type: string;
      item_current_stock: number;
      requester_name: string;
      requester_email: string;
    }>(
      `SELECT 
        sar.*,
        i.name as item_name,
        i.unit_type as item_unit_type,
        i.current_stock as item_current_stock,
        u.name as requester_name,
        u.email as requester_email
      FROM stock_approval_requests sar
      JOIN items i ON sar.item_id = i.id
      JOIN users u ON sar.requested_by = u.id
      WHERE sar.business_id = ? AND sar.status = ?
      ORDER BY sar.created_at DESC`,
      [auth.businessId, status]
    );

    return jsonResponse({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching approval requests:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch approval requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
