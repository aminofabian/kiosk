import { NextRequest } from 'next/server';
import { execute, queryOne, transaction } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { applyStockAdjustmentToBatches } from '@/lib/db/batch-stock-sync';
import { logActivity } from '@/lib/db/activity-log';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'superadmin') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const { id } = await params;

    const original = await queryOne<{
      id: string;
      item_id: string;
      business_id: string;
      difference: number;
      reason: string;
    }>(
      `SELECT id, item_id, business_id, difference, reason
       FROM stock_adjustments
       WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!original) {
      return jsonResponse({ success: false, message: 'Adjustment not found' }, 404);
    }

    const item = await queryOne<{
      id: string;
      current_stock: number;
      name: string;
    }>(
      'SELECT id, current_stock, name FROM items WHERE id = ? AND business_id = ?',
      [original.item_id, auth.businessId]
    );

    if (!item) {
      return jsonResponse({ success: false, message: 'Item not found' }, 404);
    }

    const now = Math.floor(Date.now() / 1000);
    const counterDifference = -original.difference;
    const systemStock = item.current_stock;
    const actualStock = Math.max(0, systemStock + counterDifference);

    const newAdjustmentId = generateUUID();

    const stockConflict = await transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO stock_adjustments (
          id, business_id, item_id, system_stock, actual_stock,
          difference, reason, notes, adjusted_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newAdjustmentId,
          auth.businessId,
          original.item_id,
          systemStock,
          actualStock,
          counterDifference,
          'other',
          `Reversal of adjustment ${original.id}${original.reason ? ` (${original.reason})` : ''}`,
          auth.userId,
          now,
        ]
      );

      const updateResult = await tx.execute(
        `UPDATE items
         SET current_stock = ?
         WHERE id = ? AND business_id = ? AND ABS(current_stock - ?) < 0.0001`,
        [actualStock, original.item_id, auth.businessId, systemStock]
      );

      if (updateResult.rowsAffected === 0) {
        return true;
      }

      await applyStockAdjustmentToBatches(
        tx,
        original.item_id,
        auth.businessId,
        counterDifference,
        now
      );

      return false;
    });

    if (stockConflict) {
      return jsonResponse(
        {
          success: false,
          message: 'Stock changed while reversing. Please refresh and try again.',
          code: 'stock_conflict',
        },
        409
      );
    }

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'stock',
      entityId: original.item_id,
      entityNameSnapshot: item.name,
      details: {
        originalAdjustmentId: original.id,
        counterDifference,
        systemStock,
        actualStock,
        reason: 'reversal',
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Adjustment reversed successfully',
      data: {
        adjustmentId: newAdjustmentId,
        counterDifference,
        systemStock,
        actualStock,
      },
    });
  } catch (error) {
    console.error('Error reversing stock adjustment:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to reverse adjustment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
