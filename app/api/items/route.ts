import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { Item } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const all = searchParams.get('all') === 'true';
    const search = searchParams.get('search');
    const parentsOnly = searchParams.get('parentsOnly') === 'true';
    const parentId = searchParams.get('parentId'); // Get variants of a specific parent
    const sellableOnly = searchParams.get('sellableOnly') === 'true'; // Only items that can be sold (not parent containers)

    let items: Item[];

    if (parentId) {
      // Get variants of a specific parent item
      items = await query<Item>(
        `SELECT * FROM items 
         WHERE business_id = ? AND parent_item_id = ? AND active = 1 
         ORDER BY variant_name ASC, unit_type ASC`,
        [auth.businessId, parentId]
      );
    } else if (search) {
      const searchTerm = `%${search}%`;
      // Search includes both parent names and variant names
      items = await query<Item>(
        `SELECT * FROM items 
         WHERE business_id = ? AND active = 1 
         AND (name LIKE ? OR name LIKE ? OR variant_name LIKE ?)
         ORDER BY 
           CASE WHEN name LIKE ? THEN 1 ELSE 2 END,
           name ASC`,
        [auth.businessId, searchTerm, searchTerm.toLowerCase(), searchTerm, `${search}%`]
      );
    } else if (all) {
      if (parentsOnly) {
        // Only parent items (no parent_item_id) - for admin management
        items = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ? AND active = 1 AND parent_item_id IS NULL
           ORDER BY name ASC`,
          [auth.businessId]
        );
      } else if (sellableOnly) {
        // Only sellable items (variants OR standalone items without variants)
        items = await query<Item>(
          `SELECT i.* FROM items i
           WHERE i.business_id = ? AND i.active = 1 
           AND (
             i.parent_item_id IS NOT NULL  -- variants are sellable
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)  -- standalone items without variants
           )
           ORDER BY i.name ASC`,
          [auth.businessId]
        );
      } else {
        items = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ? AND active = 1 
           ORDER BY name ASC`,
          [auth.businessId]
        );
      }
    } else {
      if (!categoryId) {
        return jsonResponse(
          {
            success: false,
            message: 'categoryId is required',
          },
          400
        );
      }

      if (parentsOnly) {
        // Parent items in a category (for POS - show these, then expand to variants)
        items = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ? AND category_id = ? AND active = 1 
           AND parent_item_id IS NULL
           ORDER BY name ASC`,
          [auth.businessId, categoryId]
        );
      } else if (sellableOnly) {
        // Sellable items in category
        items = await query<Item>(
          `SELECT i.* FROM items i
           WHERE i.business_id = ? AND i.category_id = ? AND i.active = 1 
           AND (
             i.parent_item_id IS NOT NULL  
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)
           )
           ORDER BY i.name ASC`,
          [auth.businessId, categoryId]
        );
      } else {
        items = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ? AND category_id = ? AND active = 1 
           ORDER BY name ASC`,
          [auth.businessId, categoryId]
        );
      }
    }

    return jsonResponse({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch items',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { 
      name, 
      categoryId, 
      unitType, 
      initialStock, 
      buyPrice, 
      sellPrice, 
      minStockLevel,
      isParent,      // true if creating a parent item (container)
      parentItemId,  // set if creating a variant
      variantName,   // e.g., "Big", "Small", "Red Kidney"
    } = body;

    // Parent items don't need price/stock/unit - they're just containers
    if (isParent) {
      if (!name || !categoryId) {
        return jsonResponse(
          { success: false, message: 'Name and category are required for parent items' },
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

    const stock = initialStock || 0;
    if (stock > 0 && (!buyPrice || buyPrice <= 0)) {
      return jsonResponse(
        { success: false, message: 'Buy price is required when setting initial stock' },
        400
      );
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

    // If creating a variant, verify parent exists
    if (parentItemId) {
      const parentItem = await queryOne<{ id: string; name: string }>(
        'SELECT id, name FROM items WHERE id = ? AND business_id = ? AND parent_item_id IS NULL',
        [parentItemId, auth.businessId]
      );

      if (!parentItem) {
        return jsonResponse(
          { success: false, message: 'Parent item not found' },
          404
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const itemId = generateUUID();
    const price = isParent ? 0 : sellPrice;

    // Create item (parent or variant or standalone)
    await execute(
      `INSERT INTO items (
        id, business_id, category_id, parent_item_id, name, variant_name, unit_type,
        current_stock, current_sell_price, min_stock_level, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        auth.businessId,
        categoryId,
        parentItemId || null,
        name.trim(),
        variantName?.trim() || null,
        isParent ? 'piece' : unitType, // Parent items need a default unit_type
        isParent ? 0 : stock,
        price,
        isParent ? null : (minStockLevel || null),
        1,
        now,
      ]
    );

    // Create initial selling price record (only for sellable items)
    if (!isParent && price > 0) {
      const priceId = generateUUID();
      await execute(
        `INSERT INTO selling_prices (
          id, item_id, price, effective_from, set_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [priceId, itemId, price, now, auth.userId, now]
      );
    }

    // If initial stock and buy price provided, create inventory batch
    if (!isParent && stock > 0 && buyPrice) {
      const batchId = generateUUID();
      await execute(
        `INSERT INTO inventory_batches (
          id, business_id, item_id, source_breakdown_id, initial_quantity,
          quantity_remaining, buy_price_per_unit, received_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchId, auth.businessId, itemId, null, stock, stock, buyPrice, now, now]
      );
    }

    return jsonResponse({
      success: true,
      message: isParent ? 'Parent item created successfully' : 'Item created successfully',
      data: {
        itemId,
        isParent: !!isParent,
      },
    });
  } catch (error) {
    console.error('Error creating item:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create item',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

