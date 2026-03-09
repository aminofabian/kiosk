import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';
import type { Item } from '@/lib/db/types';

export async function OPTIONS() {
    return optionsResponse();
}

/**
 * PATCH /api/items/[id]/type
 * Quick endpoint to update an item's product type
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
        const { itemType } = body as { itemType: string };

        if (!itemType || typeof itemType !== 'string' || !itemType.trim()) {
            return jsonResponse(
                { success: false, message: 'Invalid item type.' },
                400
            );
        }

        // Verify item exists and belongs to business
        const item = await queryOne<Item>(
            'SELECT * FROM items WHERE id = ? AND business_id = ?',
            [id, auth.businessId]
        );

        if (!item) {
            return jsonResponse(
                { success: false, message: 'Item not found' },
                404
            );
        }

        // Update item type
        await execute(
            'UPDATE items SET item_type = ? WHERE id = ? AND business_id = ?',
            [itemType, id, auth.businessId]
        );

        const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
        logActivity({
            businessId: auth.businessId,
            action: 'update',
            entityType: 'item',
            entityId: id,
            entityNameSnapshot: displayName,
            details: { field: 'item_type', itemType },
            performedBy: auth.userId,
        }).catch(() => {});

        return jsonResponse({
            success: true,
            message: `Item type updated to ${itemType}`,
            data: { itemId: id, itemType },
        });
    } catch (error) {
        console.error('Error updating item type:', error);
        return jsonResponse(
            {
                success: false,
                message: 'Failed to update item type',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
}
