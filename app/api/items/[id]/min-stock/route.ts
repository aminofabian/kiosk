import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import { logActivity } from '@/lib/db/activity-log';
import type { Item } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/min-stock
 * Update minimum stock level (department staff with adjust_stock)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (
      !hasPermission(auth.role, 'manage_items') &&
      !hasPermission(auth.role, 'adjust_stock')
    ) {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const { id } = await params;
    const body = await request.json();
    const { minStockLevel } = body as { minStockLevel: number | null };

    if (
      minStockLevel !== null &&
      (typeof minStockLevel !== 'number' || isNaN(minStockLevel) || minStockLevel < 0)
    ) {
      return jsonResponse(
        { success: false, message: 'Minimum stock must be a non-negative number or empty' },
        400
      );
    }

    const item = await queryOne<Item>(
      'SELECT * FROM items WHERE id = ? AND business_id = ? AND active = 1',
      [id, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    await execute(
      'UPDATE items SET min_stock_level = ? WHERE id = ? AND business_id = ?',
      [minStockLevel, id, auth.businessId]
    );

    const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: id,
      entityNameSnapshot: displayName,
      details: { field: 'min_stock_level', minStockLevel },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Minimum stock updated',
      data: { itemId: id, minStockLevel },
    });
  } catch (error) {
    console.error('Error updating min stock:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update minimum stock',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
