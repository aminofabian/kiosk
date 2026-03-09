import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';
import type { Item } from '@/lib/db/types';
import { UNIT_TYPES } from '@/lib/constants';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/unit
 * Quick endpoint to update an item's unit type
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const { unitType } = body as { unitType: string };

    if (!unitType || typeof unitType !== 'string' || !unitType.trim()) {
      return jsonResponse(
        { success: false, message: 'Invalid unit type.' },
        400
      );
    }

    const validUnits = UNIT_TYPES as readonly string[];
    if (!validUnits.includes(unitType)) {
      return jsonResponse(
        { success: false, message: `Unit must be one of: ${validUnits.join(', ')}` },
        400
      );
    }

    const item = await queryOne<Item>(
      'SELECT * FROM items WHERE id = ? AND business_id = ?',
      [id, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    await execute(
      'UPDATE items SET unit_type = ? WHERE id = ? AND business_id = ?',
      [unitType, id, auth.businessId]
    );

    const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: id,
      entityNameSnapshot: displayName,
      details: { field: 'unit_type', unitType },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: `Unit updated to ${unitType}`,
      data: { itemId: id, unitType },
    });
  } catch (error) {
    console.error('Error updating item unit:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update item unit',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
