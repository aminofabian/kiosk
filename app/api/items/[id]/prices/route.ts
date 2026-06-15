import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { generateBatchNumber } from '@/lib/utils/batch-number';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import { logActivity } from '@/lib/db/activity-log';
import { recordBuyingPrice } from '@/lib/db/buying-prices';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * PATCH /api/items/[id]/prices
 * Update an item's sell price and/or buy price (cost) without full item update.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const canManageItems = hasPermission(auth.role, 'manage_items');
    const canAdjustStock = hasPermission(auth.role, 'adjust_stock');

    if (!canManageItems && !canAdjustStock) {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const { id: itemId } = await params;
    const body = await request.json();
    const { sellPrice, buyPrice } = body;

    const sellPriceNum = sellPrice !== undefined && sellPrice !== null ? Number(sellPrice) : undefined;
    const buyPriceNum = buyPrice !== undefined && buyPrice !== null ? Number(buyPrice) : undefined;

    if (sellPriceNum === undefined && buyPriceNum === undefined) {
      return jsonResponse(
        { success: false, message: 'At least one of sellPrice or buyPrice is required' },
        400
      );
    }

    if (buyPriceNum !== undefined && !canManageItems) {
      return jsonResponse(
        { success: false, message: 'Not allowed to update buy price' },
        403
      );
    }

    const item = await queryOne<{ id: string; current_stock: number; parent_item_id: string | null; name: string; variant_name: string | null }>(
      'SELECT id, current_stock, parent_item_id, name, variant_name FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (sellPriceNum !== undefined) {
      if (sellPriceNum <= 0) {
        return jsonResponse(
          { success: false, message: 'Sell price must be greater than 0' },
          400
        );
      }

      const currentItem = await queryOne<{ current_sell_price: number }>(
        'SELECT current_sell_price FROM items WHERE id = ? AND business_id = ?',
        [itemId, auth.businessId]
      );

      const priceChanged = currentItem && Math.abs(currentItem.current_sell_price - sellPriceNum) > 0.01;

      await execute(
        'UPDATE items SET current_sell_price = ? WHERE id = ? AND business_id = ?',
        [sellPriceNum, itemId, auth.businessId]
      );

      if (priceChanged) {
        const priceId = generateUUID();
        await execute(
          `INSERT INTO selling_prices (id, item_id, price, effective_from, set_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [priceId, itemId, sellPriceNum, now, auth.userId, now]
        );
      }
    }

    if (buyPriceNum !== undefined) {
      if (buyPriceNum < 0) {
        return jsonResponse(
          { success: false, message: 'Buy price must be >= 0' },
          400
        );
      }

      const existingBatch = await queryOne<{ id: string }>(
        `SELECT id FROM inventory_batches 
         WHERE item_id = ? AND business_id = ?
         ORDER BY received_at DESC LIMIT 1`,
        [itemId, auth.businessId]
      );

      if (existingBatch) {
        await execute(
          'UPDATE inventory_batches SET buy_price_per_unit = ?, received_at = ? WHERE id = ?',
          [buyPriceNum, now, existingBatch.id]
        );
      } else {
        const batchId = generateUUID();
        const stockToUse = item.current_stock > 0 ? item.current_stock : 0;
        const batchNumber = await generateBatchNumber(itemId, auth.businessId, now);
        await execute(
          `INSERT INTO inventory_batches (
            id, business_id, item_id, source_breakdown_id, batch_number, status,
            supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
            received_at, created_at
          ) VALUES (?, ?, ?, NULL, ?, 'active', NULL, ?, ?, ?, ?, ?)`,
          [batchId, auth.businessId, itemId, batchNumber, stockToUse, stockToUse, buyPriceNum, now, now]
        );
      }
      await recordBuyingPrice({
        itemId,
        supplierId: null,
        price: buyPriceNum,
        setBy: auth.userId,
      });
    }

    const updatedItem = await queryOne<{ current_sell_price: number }>(
      'SELECT current_sell_price FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    const latestBatch = await queryOne<{ buy_price_per_unit: number }>(
      `SELECT buy_price_per_unit FROM inventory_batches 
       WHERE item_id = ? AND business_id = ?
       ORDER BY received_at DESC LIMIT 1`,
      [itemId, auth.businessId]
    );

    const displayName = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'item',
      entityId: itemId,
      entityNameSnapshot: displayName,
      details: { sellPrice: updatedItem?.current_sell_price, buyPrice: latestBatch?.buy_price_per_unit },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Prices updated successfully',
      data: {
        itemId,
        sellPrice: updatedItem?.current_sell_price ?? sellPriceNum,
        buyPrice: latestBatch?.buy_price_per_unit ?? buyPriceNum,
      },
    });
  } catch (error) {
    console.error('Error updating item prices:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update prices',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
