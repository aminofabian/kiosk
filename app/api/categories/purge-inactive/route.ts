import { NextRequest } from 'next/server';
import { execute, query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Hard-delete inactive categories that have no items referencing them.
 * Inactive categories that still have products are left in place (merge or reassign first).
 */
export async function POST(_request: NextRequest) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const candidates = await query<{ id: string; name: string; item_count: number }>(
      `SELECT c.id, c.name,
        (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id AND i.business_id = c.business_id) AS item_count
       FROM categories c
       WHERE c.business_id = ? AND c.active = 0`,
      [auth.businessId]
    );

    const deletable = candidates.filter((c) => Number(c.item_count) === 0);
    const skipped = candidates.filter((c) => Number(c.item_count) > 0);

    if (deletable.length === 0) {
      return jsonResponse({
        success: true,
        message:
          skipped.length === 0
            ? 'There are no inactive categories to remove.'
            : `No inactive categories are empty. ${skipped.length} still have products — merge or move stock first.`,
        data: { deleted: [] as { id: string; name: string }[], skipped },
      });
    }

    const placeholders = deletable.map(() => '?').join(', ');
    const ids = deletable.map((c) => c.id);
    await execute(
      `DELETE FROM categories WHERE business_id = ? AND id IN (${placeholders})`,
      [auth.businessId, ...ids]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'delete',
      entityType: 'category',
      entityId: ids[0],
      entityNameSnapshot: `${deletable.length} inactive categories purged`,
      performedBy: auth.userId,
      details: {
        purgeInactive: true,
        deletedIds: ids,
        deletedNames: deletable.map((c) => c.name),
        skippedCount: skipped.length,
      },
    }).catch(() => {});

    const msg =
      skipped.length === 0
        ? `Removed ${deletable.length} inactive empty categor${deletable.length === 1 ? 'y' : 'ies'}.`
        : `Removed ${deletable.length} inactive empty categor${deletable.length === 1 ? 'y' : 'ies'}. ${skipped.length} inactive categor${skipped.length === 1 ? 'y' : 'ies'} still have products and were left in place.`;

    return jsonResponse({
      success: true,
      message: msg,
      data: {
        deleted: deletable.map((c) => ({ id: c.id, name: c.name })),
        skipped: skipped.map((c) => ({ id: c.id, name: c.name, itemCount: c.item_count })),
      },
    });
  } catch (error) {
    console.error('Error purging inactive categories:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to remove inactive categories',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
