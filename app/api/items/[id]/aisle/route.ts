import { NextRequest } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/aisle
 * Quick update of item's aisle assignment.
 * Body: { aisleId: string | null }
 * - If aisleId: look up aisle, set item.aisle = aisle.name, item.aisle_number = aisle.number
 * - If null: clear item.aisle and item.aisle_number
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;
    const body = await request.json();
    const { aisleId } = body;

    const item = await queryOne<{ id: string; name: string; variant_name: string | null }>(
      'SELECT id, name, variant_name FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    if (aisleId === null || aisleId === undefined || aisleId === '') {
      await execute(
        `UPDATE items SET aisle = NULL, aisle_number = NULL WHERE id = ? AND business_id = ?`,
        [itemId, auth.businessId]
      );
      const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
      logActivity({
        businessId: auth.businessId,
        action: 'update',
        entityType: 'item',
        entityId: itemId,
        entityNameSnapshot: displayName,
        details: { field: 'aisle', cleared: true },
        performedBy: auth.userId,
      }).catch(() => {});
      return jsonResponse({
        success: true,
        message: 'Aisle cleared',
      });
    }

    const aisle = await queryOne<{ name: string; number: string | null }>(
      'SELECT name, number FROM aisles WHERE id = ? AND business_id = ?',
      [aisleId, auth.businessId]
    );

    if (!aisle) {
      return jsonResponse({ success: false, message: 'Aisle not found' }, 404);
    }

    await execute(
      `UPDATE items SET aisle = ?, aisle_number = ? WHERE id = ? AND business_id = ?`,
      [aisle.name, aisle.number, itemId, auth.businessId]
    );

    const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: itemId,
      entityNameSnapshot: displayName,
      details: { field: 'aisle', aisle: aisle.name, aisleNumber: aisle.number },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Aisle assigned',
    });
  } catch (error) {
    console.error('Error updating item aisle:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update item aisle',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
