import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body || {};

    // Get the approval request (need user_id to allow requester to withdraw own)
    const approvalRequest = await queryOne<{
      id: string;
      business_id: string;
      user_id: string;
      balance_type: string;
      status: string;
    }>(
      `SELECT id, business_id, user_id, balance_type, status FROM balance_approval_requests 
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

    // Requester can withdraw their own request; admin/owner can reject any
    const canAct =
      auth.userId === approvalRequest.user_id ||
      auth.role === 'admin' ||
      auth.role === 'owner';
    if (!canAct) {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const isWithdraw = auth.userId === approvalRequest.user_id;
    const rejectionReason = reason || (isWithdraw ? 'Withdrawn by user' : null);

    // Update approval request status
    await execute(
      `UPDATE balance_approval_requests 
       SET status = 'rejected', approved_by = ?, approved_at = ?, rejection_reason = ?
       WHERE id = ?`,
      [auth.userId, now, rejectionReason, id]
    );

    return jsonResponse({
      success: true,
      message: isWithdraw
        ? `${approvalRequest.balance_type === 'opening' ? 'Opening' : 'Closing'} balance request withdrawn`
        : `${approvalRequest.balance_type === 'opening' ? 'Opening' : 'Closing'} balance request rejected`,
    });
  } catch (error) {
    console.error('Error rejecting balance request:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to reject balance request',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
