import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';
import { BARCODE_EXEMPT_REASONS } from '@/lib/constants/barcode-exempt';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/barcode-exempt
 * Mark an item as intentionally barcode-free (or revoke exemption).
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
    const { exempt, reason } = body as { exempt?: boolean; reason?: string | null };

    if (typeof exempt !== 'boolean') {
      return jsonResponse({ success: false, message: 'exempt (boolean) is required' }, 400);
    }

    const validReasonIds = new Set(BARCODE_EXEMPT_REASONS.map((r) => r.id));
    const reasonValue =
      exempt && reason && validReasonIds.has(reason as (typeof BARCODE_EXEMPT_REASONS)[number]['id'])
        ? reason
        : exempt
          ? 'other'
          : null;

    const item = await queryOne<{
      id: string;
      parent_item_id: string | null;
      name: string;
      variant_name: string | null;
    }>(
      'SELECT id, parent_item_id, name, variant_name FROM items WHERE id = ? AND business_id = ? AND active = 1',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    const variantCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM items WHERE parent_item_id = ? AND active = 1',
      [itemId]
    );
    if ((variantCount?.count || 0) > 0) {
      return jsonResponse(
        {
          success: false,
          message: 'Parent items cannot be marked scan-free. Mark each variant instead.',
        },
        400
      );
    }

    await execute(
      'UPDATE items SET barcode_exempt = ?, barcode_exempt_reason = ? WHERE id = ? AND business_id = ?',
      [exempt ? 1 : 0, reasonValue, itemId, auth.businessId]
    );

    const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
    logActivity({
      businessId: auth.businessId,
      action: exempt ? 'update' : 'update',
      entityType: 'item',
      entityId: itemId,
      entityNameSnapshot: displayName,
      details: { field: 'barcode_exempt', exempt, reason: reasonValue },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: exempt ? 'Item marked as scan-free' : 'Scan exemption removed',
      data: { itemId, barcode_exempt: exempt ? 1 : 0, barcode_exempt_reason: reasonValue },
    });
  } catch (error) {
    console.error('Error updating barcode exemption:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update scan exemption',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
