import { NextRequest } from 'next/server';
import { queryOne, execute, query } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { Item } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;

    const item = await queryOne<Item>(
      `SELECT * FROM items WHERE id = ? AND business_id = ?`,
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    // Get the latest buy price from inventory batches
    const latestBatch = await queryOne<{ buy_price_per_unit: number }>(
      `SELECT buy_price_per_unit FROM inventory_batches 
       WHERE item_id = ? AND business_id = ?
       ORDER BY received_at DESC LIMIT 1`,
      [itemId, auth.businessId]
    );

    // Check if this is a parent item and get variant count
    const isParentItem = item.parent_item_id === null;
    let variantCount = 0;
    let variants: Item[] = [];

    if (isParentItem) {
      const countResult = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM items 
         WHERE parent_item_id = ? AND business_id = ? AND active = 1`,
        [itemId, auth.businessId]
      );
      variantCount = countResult?.count || 0;

      // Also fetch the variants
      if (variantCount > 0) {
        variants = await query<Item>(
          `SELECT * FROM items 
           WHERE parent_item_id = ? AND business_id = ? AND active = 1 
           ORDER BY variant_name ASC, unit_type ASC`,
          [itemId, auth.businessId]
        );
      }
    }

    // Get parent info if this is a variant
    let parentItem = null;
    if (item.parent_item_id) {
      parentItem = await queryOne<{ id: string; name: string }>(
        `SELECT id, name FROM items WHERE id = ? AND business_id = ?`,
        [item.parent_item_id, auth.businessId]
      );
    }

    return jsonResponse({
      success: true,
      data: {
        ...item,
        buy_price: latestBatch?.buy_price_per_unit || null,
        isParent: isParentItem && variantCount > 0,
        variantCount,
        variants,
        parentItem,
      },
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch item',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;
    const body = await request.json();
    const { name, categoryId, unitType, buyPrice, sellPrice, minStockLevel, variantName } = body;

    // Verify item exists and check if it's a parent
    const existingItem = await queryOne<{ 
      id: string; 
      current_stock: number; 
      parent_item_id: string | null;
    }>(
      'SELECT id, current_stock, parent_item_id FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!existingItem) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    // Check if this item has variants (is a parent)
    const variantCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM items WHERE parent_item_id = ? AND active = 1',
      [itemId]
    );
    const isParentItem = (variantCount?.count || 0) > 0;

    // Parent items only need name and category
    if (isParentItem) {
      if (!name || !categoryId) {
        return jsonResponse(
          { success: false, message: 'Name and category are required' },
          400
        );
      }
    } else {
      // Regular items and variants need all fields
      if (!name || !categoryId || !unitType || sellPrice === undefined) {
        return jsonResponse(
          { success: false, message: 'Missing required fields' },
          400
        );
      }

      if (sellPrice <= 0) {
        return jsonResponse(
          { success: false, message: 'Sell price must be greater than 0' },
          400
        );
      }
    }

    // Verify category exists
    const category = await queryOne<{ id: string }>(
      'SELECT id FROM categories WHERE id = ? AND business_id = ?',
      [categoryId, auth.businessId]
    );

    if (!category) {
      return jsonResponse(
        { success: false, message: 'Category not found' },
        404
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (isParentItem) {
      // Update parent item (only name and category)
      await execute(
        `UPDATE items 
         SET name = ?,
             category_id = ?
         WHERE id = ? AND business_id = ?`,
        [name.trim(), categoryId, itemId, auth.businessId]
      );
    } else {
      // Update regular item or variant
      await execute(
        `UPDATE items 
         SET name = ?,
             category_id = ?,
             unit_type = ?,
             variant_name = ?,
             min_stock_level = ?
         WHERE id = ? AND business_id = ?`,
        [
          name.trim(),
          categoryId,
          unitType,
          variantName?.trim() || null,
          minStockLevel || null,
          itemId,
          auth.businessId,
        ]
      );

      const price = sellPrice;

      // If price changed, create new selling price record
      const currentItem = await queryOne<{ current_sell_price: number }>(
        'SELECT current_sell_price FROM items WHERE id = ?',
        [itemId]
      );

      if (currentItem && currentItem.current_sell_price !== price) {
        const priceId = generateUUID();
        await execute(
          `INSERT INTO selling_prices (
            id, item_id, price, effective_from, set_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [priceId, itemId, price, now, auth.userId, now]
        );

        await execute(
          `UPDATE items SET current_sell_price = ? WHERE id = ?`,
          [price, itemId]
        );
      }

      // If buyPrice provided and item has stock, create/update inventory batch
      if (buyPrice && buyPrice > 0 && existingItem.current_stock > 0) {
        const existingBatch = await queryOne<{ id: string; quantity_remaining: number }>(
          `SELECT id, quantity_remaining FROM inventory_batches 
           WHERE item_id = ? AND business_id = ? AND quantity_remaining > 0
           ORDER BY received_at DESC LIMIT 1`,
          [itemId, auth.businessId]
        );

        if (existingBatch) {
          await execute(
            `UPDATE inventory_batches SET buy_price_per_unit = ? WHERE id = ?`,
            [buyPrice, existingBatch.id]
          );
        } else {
          const batchId = generateUUID();
          await execute(
            `INSERT INTO inventory_batches (
              id, business_id, item_id, source_breakdown_id, initial_quantity,
              quantity_remaining, buy_price_per_unit, received_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [batchId, auth.businessId, itemId, null, existingItem.current_stock, 
             existingItem.current_stock, buyPrice, now, now]
          );
        }
      }
    }

    return jsonResponse({
      success: true,
      message: 'Item updated successfully',
      data: {
        itemId,
      },
    });
  } catch (error) {
    console.error('Error updating item:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update item',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

