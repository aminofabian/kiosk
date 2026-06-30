import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { migrateExpectedStock } from '@/lib/db/migrate-expected-stock';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { enforceDepartmentStaffStockEditPolicy } from '@/lib/auth/department-stock-policy';
import { hasPermission } from '@/lib/auth/permissions';
import { logActivity } from '@/lib/db/activity-log';
import type { Item } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/expected-stock
 * Update par / expected restock level (department staff with adjust_stock)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const stockPolicyBlock = await enforceDepartmentStaffStockEditPolicy(auth);
    if (stockPolicyBlock) return stockPolicyBlock;

    const { id } = await params;
    const body = await request.json();
    const { expectedStockLevel } = body as { expectedStockLevel: number | null };

    await migrateExpectedStock();

    if (
      expectedStockLevel !== null &&
      (typeof expectedStockLevel !== 'number' ||
        isNaN(expectedStockLevel) ||
        expectedStockLevel < 0)
    ) {
      return jsonResponse(
        {
          success: false,
          message: 'Expected stock must be a non-negative number or empty',
        },
        400,
      );
    }

    const item = await queryOne<Item>(
      'SELECT * FROM items WHERE id = ? AND business_id = ? AND active = 1',
      [id, auth.businessId],
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    await execute(
      'UPDATE items SET expected_stock_level = ? WHERE id = ? AND business_id = ?',
      [expectedStockLevel, id, auth.businessId],
    );

    const displayName = item.variant_name
      ? `${item.name} (${item.variant_name})`
      : item.name;
    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: id,
      entityNameSnapshot: displayName,
      details: { field: 'expected_stock_level', expectedStockLevel },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Expected stock updated',
      data: { itemId: id, expectedStockLevel },
    });
  } catch (error) {
    console.error('Error updating expected stock:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update expected stock',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
