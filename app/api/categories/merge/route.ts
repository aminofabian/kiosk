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

function normalizeFromCategoryIds(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.fromCategoryIds)) {
    const ids = body.fromCategoryIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean);
    return [...new Set(ids)];
  }
  const single = typeof body.fromCategoryId === 'string' ? body.fromCategoryId.trim() : '';
  return single ? [single] : [];
}

/**
 * Move all items from one or more categories into `intoCategoryId`, then deactivate those sources.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const body = (await request.json()) as Record<string, unknown>;
    const fromCategoryIds = normalizeFromCategoryIds(body);
    const intoCategoryId = typeof body.intoCategoryId === 'string' ? body.intoCategoryId.trim() : '';

    if (fromCategoryIds.length === 0) {
      return jsonResponse(
        { success: false, message: 'Provide at least one source category (fromCategoryIds array or fromCategoryId).' },
        400
      );
    }
    if (!intoCategoryId) {
      return jsonResponse({ success: false, message: 'intoCategoryId is required' }, 400);
    }
    if (fromCategoryIds.includes(intoCategoryId)) {
      return jsonResponse(
        { success: false, message: 'Target category cannot be one of the categories you are merging away.' },
        400
      );
    }

    const placeholders = fromCategoryIds.map(() => '?').join(', ');
    const fromCats = await query<{ id: string; name: string; active: number }>(
      `SELECT id, name, active FROM categories WHERE business_id = ? AND id IN (${placeholders})`,
      [auth.businessId, ...fromCategoryIds]
    );

    if (fromCats.length !== fromCategoryIds.length) {
      return jsonResponse(
        { success: false, message: 'One or more source categories were not found for this business.' },
        404
      );
    }

    const intoRows = await query<{ id: string; name: string; active: number }>(
      'SELECT id, name, active FROM categories WHERE id = ? AND business_id = ?',
      [intoCategoryId, auth.businessId]
    );
    const intoCat = intoRows[0];
    if (!intoCat) {
      return jsonResponse({ success: false, message: 'Target category not found' }, 404);
    }
    if (intoCat.active !== 1) {
      return jsonResponse(
        { success: false, message: 'Target category must be active. Activate it or choose another category.' },
        400
      );
    }

    const itemResult = await execute(
      `UPDATE items SET category_id = ? WHERE business_id = ? AND category_id IN (${placeholders})`,
      [intoCategoryId, auth.businessId, ...fromCategoryIds]
    );
    const itemsMoved = Number(itemResult.rowsAffected ?? 0);

    await execute(
      `UPDATE categories SET active = 0 WHERE business_id = ? AND id IN (${placeholders})`,
      [auth.businessId, ...fromCategoryIds]
    );

    const fromNames = fromCats.map((c) => c.name);
    const namesPreview =
      fromNames.length <= 3
        ? fromNames.map((n) => `“${n}”`).join(', ')
        : `“${fromNames[0]}”, “${fromNames[1]}”, and ${fromNames.length - 2} more`;

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'category',
      entityId: intoCategoryId,
      entityNameSnapshot: `${fromNames.join(' + ')} → ${intoCat.name}`,
      performedBy: auth.userId,
      details: {
        merge: true,
        fromCategoryIds,
        fromCategoryNames: fromNames,
        intoCategoryId,
        intoCategoryName: intoCat.name,
        itemsMoved,
        categoriesClosed: fromCategoryIds.length,
      },
    }).catch(() => {});

    const n = fromCategoryIds.length;
    const message =
      itemsMoved === 0
        ? n === 1
          ? `Category “${fromNames[0]}” was deactivated; no products were assigned to it.`
          : `${n} categories were deactivated (${namesPreview}); no products were in those categories.`
        : `Moved ${itemsMoved} product${itemsMoved === 1 ? '' : 's'} from ${n} categor${n === 1 ? 'y' : 'ies'} (${namesPreview}) into “${intoCat.name}”. Those categories were deactivated.`;

    return jsonResponse({
      success: true,
      message,
      data: {
        itemsMoved,
        categoriesClosed: n,
        mergedFromNames: fromNames,
        intoCategoryName: intoCat.name,
      },
    });
  } catch (error) {
    console.error('Error merging categories:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to merge categories',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
