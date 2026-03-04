import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

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
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

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

    const item = await queryOne<{ id: string; current_stock: number; parent_item_id: string | null }>(
      'SELECT id, current_stock, parent_item_id FROM items WHERE id = ? AND business_id = ?',
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
      if (sellPriceNum < 0) {
        return jsonResponse(
          { success: false, message: 'Sell price must be >= 0' },
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
        await execute(
          `INSERT INTO inventory_batches (
            id, business_id, item_id, source_breakdown_id, initial_quantity,
            quantity_remaining, buy_price_per_unit, received_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [batchId, auth.businessId, itemId, null, stockToUse, stockToUse, buyPriceNum, now, now]
        );
      }
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
