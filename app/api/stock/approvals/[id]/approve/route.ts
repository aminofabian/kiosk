import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

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

    // Only admin and owner can approve requests
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id } = await params;

    // Get the approval request
    const request = await queryOne<{
      id: string;
      business_id: string;
      item_id: string;
      adjustment_type: 'increase' | 'decrease';
      quantity: number;
      reason: string;
      notes: string | null;
      status: string;
      requested_by: string;
    }>(
      `SELECT * FROM stock_approval_requests 
       WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!request) {
      return jsonResponse(
        { success: false, message: 'Approval request not found' },
        404
      );
    }

    if (request.status !== 'pending') {
      return jsonResponse(
        { success: false, message: 'Request has already been processed' },
        400
      );
    }

    // Get current item stock
    const item = await queryOne<{ id: string; current_stock: number; name: string }>(
      'SELECT id, current_stock, name FROM items WHERE id = ? AND business_id = ?',
      [request.item_id, auth.businessId]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const adjustmentId = generateUUID();

    // Calculate new stock
    const systemStock = item.current_stock;
    const stockChange =
      request.adjustment_type === 'increase' ? request.quantity : -request.quantity;
    const actualStock = Math.max(0, systemStock + stockChange);
    const difference = actualStock - systemStock;

    // Update approval request status
    await execute(
      `UPDATE stock_approval_requests 
       SET status = 'approved', approved_by = ?, approved_at = ?
       WHERE id = ?`,
      [auth.userId, now, id]
    );

    // Create stock adjustment record
    await execute(
      `INSERT INTO stock_adjustments (
        id, business_id, item_id, system_stock, actual_stock,
        difference, reason, notes, adjusted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adjustmentId,
        auth.businessId,
        request.item_id,
        systemStock,
        actualStock,
        difference,
        request.reason,
        request.notes,
        request.requested_by, // Original requester
        now,
      ]
    );

    // Update item stock
    await execute(
      `UPDATE items 
       SET current_stock = ? 
       WHERE id = ? AND business_id = ?`,
      [actualStock, request.item_id, auth.businessId]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'approve',
      entityType: 'stock',
      entityId: request.item_id,
      entityNameSnapshot: item.name,
      details: { quantity: request.quantity, reason: request.reason, systemStock, actualStock, difference },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Stock adjustment approved and applied',
      data: {
        adjustmentId,
        systemStock,
        actualStock,
        difference,
      },
    });
  } catch (error) {
    console.error('Error approving stock adjustment:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to approve stock adjustment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
