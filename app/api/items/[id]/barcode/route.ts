import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/barcode
 * Update only the barcode field for an item.
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
    const { barcode } = body as { barcode?: string | null };

    // Allow empty string to clear barcode
    const barcodeValue = barcode == null ? null : (typeof barcode === 'string' ? barcode.trim() || null : null);

    // Verify item exists and is not a parent (parents don't have barcodes)
    const item = await queryOne<{ id: string; parent_item_id: string | null; name: string; variant_name: string | null }>(
      'SELECT id, parent_item_id, name, variant_name FROM items WHERE id = ? AND business_id = ? AND active = 1',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    // Check if this item has variants (is a parent) - parents shouldn't have barcodes
    const variantCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM items WHERE parent_item_id = ? AND active = 1',
      [itemId]
    );
    if ((variantCount?.count || 0) > 0) {
      return jsonResponse(
        { success: false, message: 'Parent items cannot have barcodes. Add barcodes to variants instead.' },
        400
      );
    }

    // Check for duplicate barcode if setting one
    if (barcodeValue) {
      const existing = await queryOne<{ id: string; name: string }>(
        'SELECT id, name FROM items WHERE business_id = ? AND barcode = ? AND id != ? AND active = 1',
        [auth.businessId, barcodeValue, itemId]
      );
      if (existing) {
        return jsonResponse(
          {
            success: false,
            message: `Barcode "${barcodeValue}" already exists on "${existing.name}". Use a different barcode.`,
          },
          409
        );
      }
    }

    await execute(
      'UPDATE items SET barcode = ? WHERE id = ? AND business_id = ?',
      [barcodeValue, itemId, auth.businessId]
    );

    const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: itemId,
      entityNameSnapshot: displayName,
      details: { field: 'barcode', barcode: barcodeValue },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Barcode updated',
      data: { itemId, barcode: barcodeValue },
    });
  } catch (error) {
    console.error('Error updating barcode:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update barcode',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
