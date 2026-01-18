import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    // Only admin and owner can reject requests
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { rejection_reason } = body;

    // Get the approval request
    const approvalRequest = await queryOne<{
      id: string;
      business_id: string;
      status: string;
    }>(
      `SELECT * FROM stock_approval_requests 
       WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!approvalRequest) {
      return jsonResponse(
        { success: false, message: 'Approval request not found' },
        404
      );
    }

    if (approvalRequest.status !== 'pending') {
      return jsonResponse(
        { success: false, message: 'Request has already been processed' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update approval request status
    await execute(
      `UPDATE stock_approval_requests 
       SET status = 'rejected', 
           approved_by = ?, 
           approved_at = ?,
           rejection_reason = ?
       WHERE id = ?`,
      [auth.userId, now, rejection_reason || null, id]
    );

    return jsonResponse({
      success: true,
      message: 'Stock adjustment request rejected',
    });
  } catch (error) {
    console.error('Error rejecting stock adjustment:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to reject stock adjustment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
