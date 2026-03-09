import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { itemId, adjustmentType, quantity, reason, notes } = body;

    if (!itemId || !adjustmentType || !quantity || !reason) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400
      );
    }

    if (quantity <= 0) {
      return jsonResponse(
        { success: false, message: 'Quantity must be greater than 0' },
        400
      );
    }

    // Verify item exists
    const item = await queryOne<{ id: string; current_stock: number; name: string }>(
      'SELECT id, current_stock, name FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // If user is cashier, create a pending approval request instead
    if (auth.role === 'cashier') {
      const requestId = generateUUID();
      
      await execute(
        `INSERT INTO stock_approval_requests (
          id, business_id, item_id, adjustment_type, quantity,
          reason, notes, requested_by, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          requestId,
          auth.businessId,
          itemId,
          adjustmentType,
          quantity,
          reason,
          notes || null,
          auth.userId,
          now,
        ]
      );

      return jsonResponse({
        success: true,
        message: 'Stock adjustment request submitted. Waiting for admin approval.',
        data: {
          requestId,
          status: 'pending',
          requiresApproval: true,
        },
      });
    }

    // For admin/owner, proceed with immediate adjustment
    const adjustmentId = generateUUID();

    // Calculate values matching schema
    const systemStock = item.current_stock;
    const stockChange =
      adjustmentType === 'increase' ? quantity : -quantity;
    const actualStock = Math.max(0, systemStock + stockChange);
    const difference = actualStock - systemStock;

    // Create stock adjustment record (matching schema)
    await execute(
      `INSERT INTO stock_adjustments (
        id, business_id, item_id, system_stock, actual_stock,
        difference, reason, notes, adjusted_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adjustmentId,
        auth.businessId,
        itemId,
        systemStock,
        actualStock,
        difference,
        reason,
        notes || null,
        auth.userId,
        now,
      ]
    );

    // Update item stock
    await execute(
      `UPDATE items 
       SET current_stock = ? 
       WHERE id = ? AND business_id = ?`,
      [actualStock, itemId, auth.businessId]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'stock',
      entityId: itemId,
      entityNameSnapshot: item.name,
      details: { quantity, adjustmentType, reason, systemStock, actualStock, difference },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        adjustmentId,
        systemStock,
        actualStock,
        difference,
        requiresApproval: false,
      },
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to adjust stock',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

