import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { reconcileItemBatchesFromStock } from '@/lib/db/batch-stock-sync';
import { deactivateZeroOrNegativeBatches } from '@/lib/db/batch-lifecycle';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/stock/reconcile-batches
 * Align batch quantity_remaining totals with items.current_stock.
 * Body: { itemId?: string } — omit itemId to reconcile all items with active batches.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json().catch(() => ({}));
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : undefined;
    const now = Math.floor(Date.now() / 1000);

    const itemIds = itemId
      ? [itemId]
      : (
          await query<{ id: string }>(
            `SELECT DISTINCT i.id
             FROM items i
             JOIN inventory_batches ib ON ib.item_id = i.id AND ib.business_id = i.business_id
             WHERE i.business_id = ? AND ib.status = 'active'`,
            [auth.businessId]
          )
        ).map((r) => r.id);

    const results: Array<{
      itemId: string;
      batchSumBefore: number;
      itemStock: number;
      difference: number;
    }> = [];

    for (const id of itemIds) {
      const row = await transaction(async (tx) =>
        reconcileItemBatchesFromStock(tx, id, auth.businessId, now)
      );
      if (Math.abs(row.difference) >= 0.0001) {
        results.push({ itemId: id, ...row });
      }
    }

    const deactivatedBatches = await transaction(async (tx) =>
      deactivateZeroOrNegativeBatches(tx, auth.businessId, itemId)
    );

    return jsonResponse({
      success: true,
      message:
        results.length > 0 || deactivatedBatches > 0
          ? `Reconciled ${results.length} item(s); deactivated ${deactivatedBatches} empty batch(es)`
          : 'All batch totals already match item stock',
      data: { reconciled: results.length, deactivatedBatches, items: results },
    });
  } catch (error) {
    console.error('Error reconciling batches:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to reconcile batches',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
