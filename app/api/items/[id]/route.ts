import { NextRequest } from 'next/server';
import { queryOne, execute, query } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { Item } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
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
    const { 
      name, categoryId, unitType, buyPrice, sellPrice, minStockLevel, variantName, barcode, expiryDate,
      // Bundle pricing fields
      bundleQuantity, bundlePrice, bundleName,
      // Packaging unit fields (bulk ordering)
      packagingUnitName, packagingUnitQty,
      itemType,
    } = body;

    // Ensure buyPrice is a number if provided
    const buyPriceNum = buyPrice !== undefined && buyPrice !== null ? Number(buyPrice) : undefined;
    
    console.log('PUT /api/items/[id] - Received body:', { 
      itemId, 
      buyPrice, 
      buyPriceNum,
      buyPriceType: typeof buyPrice,
      buyPriceNumType: typeof buyPriceNum,
      buyPriceIsUndefined: buyPrice === undefined,
      buyPriceIsNull: buyPrice === null 
    });

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

    // Check for duplicate barcode if provided (exclude current item)
    if (barcode && barcode.trim()) {
      const existingBarcodeItem = await queryOne<{ id: string; name: string; barcode: string }>(
        `SELECT id, name, barcode FROM items 
         WHERE business_id = ? AND barcode = ? AND id != ? AND active = 1`,
        [auth.businessId, barcode.trim(), itemId]
      );

      if (existingBarcodeItem) {
        return jsonResponse(
          {
            success: false,
            message: `A product with barcode "${barcode.trim()}" already exists (${existingBarcodeItem.name}). Please use a different barcode or remove it.`
          },
          409
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);

    console.log('Item type check:', { isParentItem, itemId, buyPriceNum });

    if (isParentItem) {
      // Update parent item (name, category, packaging units, barcode=null - barcode belongs on variants)
      const itemTypeVal = itemType && ['grocery', 'retail'].includes(itemType) ? itemType : null;
      const updateResult = itemTypeVal
        ? await execute(
            `UPDATE items 
             SET name = ?,
                 category_id = ?,
                 item_type = ?,
                 packaging_unit_name = ?,
                 packaging_unit_qty = ?,
                 barcode = NULL
             WHERE id = ? AND business_id = ?`,
            [name.trim(), categoryId, itemTypeVal, packagingUnitName?.trim() || null, packagingUnitQty || null, itemId, auth.businessId]
          )
        : await execute(
            `UPDATE items 
             SET name = ?,
                 category_id = ?,
                 packaging_unit_name = ?,
                 packaging_unit_qty = ?,
                 barcode = NULL
             WHERE id = ? AND business_id = ?`,
            [name.trim(), categoryId, packagingUnitName?.trim() || null, packagingUnitQty || null, itemId, auth.businessId]
          );

      if (updateResult.rowsAffected === 0) {
        return jsonResponse(
          { success: false, message: 'No rows were updated. Item may not exist or data is unchanged.' },
          400
        );
      }
      
      // Note: Parent items don't have buy prices directly, but we can still update batches if provided
      // This allows setting buy prices for parent items that might have stock
    } else {
      // Update regular item or variant
      const itemTypeVal = itemType && ['grocery', 'retail'].includes(itemType) ? itemType : 'retail';
      const updateResult = await execute(
        `UPDATE items 
         SET name = ?,
             category_id = ?,
             unit_type = ?,
             variant_name = ?,
             min_stock_level = ?,
             barcode = ?,
             expiry_date = ?,
             bundle_quantity = ?,
             bundle_price = ?,
             bundle_name = ?,
             packaging_unit_name = ?,
             packaging_unit_qty = ?,
             item_type = ?
         WHERE id = ? AND business_id = ?`,
        [
          name.trim(),
          categoryId,
          unitType,
          variantName?.trim() || null,
          minStockLevel || null,
          barcode?.trim() || null,
          expiryDate || null,
          bundleQuantity || null,
          bundlePrice || null,
          bundleName?.trim() || null,
          packagingUnitName?.trim() || null,
          packagingUnitQty || null,
          itemTypeVal,
          itemId,
          auth.businessId,
        ]
      );

      if (updateResult.rowsAffected === 0) {
        return jsonResponse(
          { success: false, message: 'No rows were updated. Item may not exist or data is unchanged.' },
          400
        );
      }

      const price = sellPrice;

      // Always update the price (even if same, to ensure consistency)
      // Check if price changed to decide whether to create price history
      const currentItem = await queryOne<{ current_sell_price: number }>(
        'SELECT current_sell_price FROM items WHERE id = ? AND business_id = ?',
        [itemId, auth.businessId]
      );

      if (!currentItem) {
        return jsonResponse(
          { success: false, message: 'Item not found after update' },
          404
        );
      }

      // Use a small epsilon for floating point comparison
      const priceChanged = Math.abs(currentItem.current_sell_price - price) > 0.01;

      // Always update the current_sell_price field
      const priceUpdateResult = await execute(
        `UPDATE items SET current_sell_price = ? WHERE id = ? AND business_id = ?`,
        [price, itemId, auth.businessId]
      );

      if (priceUpdateResult.rowsAffected === 0) {
        console.error('Price update failed for item:', itemId);
      }

      // Only create price history if price actually changed
      if (priceChanged) {
        const priceId = generateUUID();
        await execute(
          `INSERT INTO selling_prices (
            id, item_id, price, effective_from, set_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [priceId, itemId, price, now, auth.userId, now]
        );
      }

      console.log('About to check buy price - inside else block for non-parent items');
      
      // If buyPrice provided, create/update inventory batch
      console.log('Checking buy price condition:', { 
        buyPriceNum, 
        isUndefined: buyPriceNum === undefined, 
        isNull: buyPriceNum === null, 
        isNaN: buyPriceNum !== undefined ? isNaN(buyPriceNum) : true,
        condition: buyPriceNum !== undefined && buyPriceNum !== null && !isNaN(buyPriceNum)
      });
      
      if (buyPriceNum !== undefined && buyPriceNum !== null && !isNaN(buyPriceNum)) {
        console.log('Updating buy price:', { itemId, buyPrice: buyPriceNum, currentStock: existingItem.current_stock });
        
        // First, try to find the most recent batch (even if quantity_remaining = 0)
        const existingBatch = await queryOne<{ id: string; quantity_remaining: number }>(
          `SELECT id, quantity_remaining FROM inventory_batches 
           WHERE item_id = ? AND business_id = ?
           ORDER BY received_at DESC LIMIT 1`,
          [itemId, auth.businessId]
        );

        console.log('Existing batch:', existingBatch);

        if (existingBatch) {
          // Update the most recent batch with the new buy price and update received_at to make it the most recent
          console.log('Updating existing batch:', existingBatch.id, 'with buy price:', buyPriceNum);
          const updateResult = await execute(
            `UPDATE inventory_batches 
             SET buy_price_per_unit = ?, received_at = ? 
             WHERE id = ?`,
            [buyPriceNum, now, existingBatch.id]
          );
          console.log('Batch update result:', updateResult, 'rowsAffected:', updateResult.rowsAffected);
          
          // Verify the update
          const verifyBatch = await queryOne<{ buy_price_per_unit: number }>(
            `SELECT buy_price_per_unit FROM inventory_batches WHERE id = ?`,
            [existingBatch.id]
          );
          console.log('Verified batch buy price after update:', verifyBatch);
        } else {
          // No batch exists, create a new one
          // Use current stock if available, otherwise use 0
          const stockToUse = existingItem.current_stock > 0 ? existingItem.current_stock : 0;
          const batchId = generateUUID();
          console.log('Creating new batch:', batchId, 'with buy price:', buyPriceNum, 'stock:', stockToUse);
          const insertResult = await execute(
            `INSERT INTO inventory_batches (
              id, business_id, item_id, source_breakdown_id, initial_quantity,
              quantity_remaining, buy_price_per_unit, received_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [batchId, auth.businessId, itemId, null, stockToUse,
              stockToUse, buyPriceNum, now, now]
          );
          console.log('Batch insert result:', insertResult, 'rowsAffected:', insertResult.rowsAffected);
        }
      } else {
        console.log('Buy price not provided or is invalid:', { buyPrice, buyPriceNum, undefined: buyPrice === undefined, null: buyPrice === null, isNaN: buyPriceNum !== undefined ? isNaN(buyPriceNum) : true });
      }
    }

    // Handle buy price update for ALL items (parent or not) - buy prices are stored in inventory_batches
    // This runs after the item update, regardless of whether it's a parent item or not
    if (buyPriceNum !== undefined && buyPriceNum !== null && !isNaN(buyPriceNum)) {
      console.log('Updating buy price for item (parent or child):', { itemId, buyPrice: buyPriceNum, currentStock: existingItem.current_stock });
      
      // First, try to find the most recent batch (even if quantity_remaining = 0)
      const existingBatch = await queryOne<{ id: string; quantity_remaining: number }>(
        `SELECT id, quantity_remaining FROM inventory_batches 
         WHERE item_id = ? AND business_id = ?
         ORDER BY received_at DESC LIMIT 1`,
        [itemId, auth.businessId]
      );

      console.log('Existing batch:', existingBatch);

      if (existingBatch) {
        // Update the most recent batch with the new buy price and update received_at to make it the most recent
        console.log('Updating existing batch:', existingBatch.id, 'with buy price:', buyPriceNum);
        const updateResult = await execute(
          `UPDATE inventory_batches 
           SET buy_price_per_unit = ?, received_at = ? 
           WHERE id = ?`,
          [buyPriceNum, now, existingBatch.id]
        );
        console.log('Batch update result:', updateResult, 'rowsAffected:', updateResult.rowsAffected);
        
        // Verify the update
        const verifyBatch = await queryOne<{ buy_price_per_unit: number }>(
          `SELECT buy_price_per_unit FROM inventory_batches WHERE id = ?`,
          [existingBatch.id]
        );
        console.log('Verified batch buy price after update:', verifyBatch);
      } else {
        // No batch exists, create a new one
        // Use current stock if available, otherwise use 0
        const stockToUse = existingItem.current_stock > 0 ? existingItem.current_stock : 0;
        const batchId = generateUUID();
        console.log('Creating new batch:', batchId, 'with buy price:', buyPriceNum, 'stock:', stockToUse);
        const insertResult = await execute(
          `INSERT INTO inventory_batches (
            id, business_id, item_id, source_breakdown_id, initial_quantity,
            quantity_remaining, buy_price_per_unit, received_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [batchId, auth.businessId, itemId, null, stockToUse,
            stockToUse, buyPriceNum, now, now]
        );
        console.log('Batch insert result:', insertResult, 'rowsAffected:', insertResult.rowsAffected);
      }
    } else {
      console.log('Buy price not provided or is invalid (outside parent/child check):', { buyPrice, buyPriceNum, undefined: buyPrice === undefined, null: buyPrice === null, isNaN: buyPriceNum !== undefined ? isNaN(buyPriceNum) : true });
    }

    // Fetch and return the updated item
    const updatedItem = await queryOne<Item>(
      `SELECT * FROM items WHERE id = ? AND business_id = ?`,
      [itemId, auth.businessId]
    );

    if (!updatedItem) {
      return jsonResponse(
        { success: false, message: 'Item not found after update' },
        404
      );
    }

    // Get the latest buy price from inventory batches
    // Order by received_at DESC, then by created_at DESC to ensure we get the most recent
    // Also check if buyPriceNum was just set
    const latestBatch = await queryOne<{ buy_price_per_unit: number; received_at: number }>(
      `SELECT buy_price_per_unit, received_at FROM inventory_batches 
       WHERE item_id = ? AND business_id = ?
       ORDER BY received_at DESC, created_at DESC LIMIT 1`,
      [itemId, auth.businessId]
    );

    console.log('Latest batch buy price:', latestBatch, 'Expected:', buyPriceNum);
    
    // If we just set a buy price but the query doesn't return it, there might be a timing issue
    // In that case, if buyPriceNum was provided, use it directly
    const finalBuyPrice = latestBatch?.buy_price_per_unit ?? (buyPriceNum !== undefined ? buyPriceNum : null);

    return jsonResponse({
      success: true,
      message: 'Item updated successfully',
      data: {
        ...updatedItem,
        buy_price: finalBuyPrice,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;

    // Verify item exists and belongs to business
    const item = await queryOne<{
      id: string;
      name: string;
      parent_item_id: string | null;
    }>(
      'SELECT id, name, parent_item_id FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    // Check if this is a parent item with variants
    const variantCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM items WHERE parent_item_id = ? AND business_id = ? AND active = 1',
      [itemId, auth.businessId]
    );

    const hasVariants = (variantCount?.count || 0) > 0;

    // If it's a parent item with variants, also soft delete all variants
    if (hasVariants) {
      await execute(
        'UPDATE items SET active = 0 WHERE parent_item_id = ? AND business_id = ?',
        [itemId, auth.businessId]
      );
    }

    // Soft delete the item (set active = 0)
    await execute(
      'UPDATE items SET active = 0 WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: hasVariants
        ? 'Item and its variants deleted successfully'
        : 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to delete item',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

