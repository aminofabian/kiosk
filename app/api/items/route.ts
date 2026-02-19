import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const all = searchParams.get('all') === 'true';
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const search = searchParams.get('search');
    const parentsOnly = searchParams.get('parentsOnly') === 'true';
    const parentId = searchParams.get('parentId'); // Get variants of a specific parent
    const sellableOnly = searchParams.get('sellableOnly') === 'true'; // Only items that can be sold (not parent containers)
    const itemType = searchParams.get('itemType'); // 'grocery' | 'retail' - filter by item type

    const itemTypeFilter = itemType === 'grocery' || itemType === 'retail' ? ` AND item_type = '${itemType}'` : '';
    // When includeInactive=true (admin "show deleted"), include soft-deleted items
    const activeFilter = includeInactive && all ? '' : ' AND active = 1';
    const iActiveFilter = includeInactive && all ? '' : ' AND i.active = 1';

    let items: Item[];

    if (parentId) {
      // Get variants of a specific parent item
      items = await query<Item>(
        `SELECT * FROM items 
         WHERE business_id = ? AND parent_item_id = ? AND active = 1 ${itemTypeFilter}
         ORDER BY variant_name ASC, unit_type ASC`,
        [auth.businessId, parentId]
      );
    } else if (search) {
      const searchLower = search.toLowerCase().trim();
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

      // Check if search looks like a barcode (numeric and 8+ digits)
      const isBarcodeLike = /^\d{8,}$/.test(search.trim());

      if (isBarcodeLike) {
        // First try exact barcode match
        const barcodeItems = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ? AND active = 1 AND barcode = ?
           LIMIT 1`,
          [auth.businessId, search.trim()]
        );

        if (barcodeItems.length > 0) {
          items = barcodeItems;
        } else {
          // Fall back to normal search if no barcode match
          const searchContains = `%${searchLower}%`;
          const searchStarts = `${searchLower}%`;
          items = await query<Item>(
            `SELECT * FROM items 
             WHERE business_id = ? AND active = 1 
             AND (
               LOWER(name) LIKE ? 
               OR LOWER(variant_name) LIKE ?
               OR barcode LIKE ?
             )
             ORDER BY 
               CASE 
                 WHEN barcode = ? THEN 0
                 WHEN LOWER(name) LIKE ? THEN 1 
                 WHEN LOWER(variant_name) LIKE ? THEN 2
                 WHEN LOWER(name) LIKE ? THEN 3
                 ELSE 4 
               END,
               name ASC
             LIMIT ?`,
            [
              auth.businessId,
              searchContains,
              searchContains,
              searchContains,
              search.trim(),
              searchStarts,
              searchStarts,
              searchContains,
              limit
            ]
          );
        }
      } else {
        // Split search into words for multi-word matching
        const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);

        if (searchWords.length === 1) {
          // Single word search - simple LIKE query
          const searchContains = `%${searchLower}%`;
          const searchStarts = `${searchLower}%`;
          items = await query<Item>(
            `SELECT * FROM items 
             WHERE business_id = ? AND active = 1 
             AND (
               LOWER(name) LIKE ? 
               OR LOWER(variant_name) LIKE ?
             )
             ORDER BY 
               CASE 
                 WHEN LOWER(name) LIKE ? THEN 1 
                 WHEN LOWER(variant_name) LIKE ? THEN 2
                 WHEN LOWER(name) LIKE ? THEN 3
                 ELSE 4 
               END,
               name ASC
             LIMIT ?`,
            [
              auth.businessId,
              searchContains,
              searchContains,
              searchStarts,
              searchStarts,
              searchContains,
              limit
            ]
          );
        } else {
          // Multi-word search - match items containing ALL words (in any order)
          // Build dynamic WHERE clause for each word
          const wordConditions = searchWords.map(() =>
            `(LOWER(name) LIKE ? OR LOWER(variant_name) LIKE ?)`
          ).join(' AND ');

          const wordParams: string[] = [];
          searchWords.forEach(word => {
            wordParams.push(`%${word}%`, `%${word}%`);
          });

          // For ordering, prioritize exact phrase match, then first word starts
          const exactPhrase = `%${searchLower}%`;
          const firstWordStarts = `${searchWords[0]}%`;

          items = await query<Item>(
            `SELECT * FROM items 
             WHERE business_id = ? AND active = 1 
             AND (${wordConditions})
             ORDER BY 
               CASE 
                 WHEN LOWER(name) LIKE ? THEN 1
                 WHEN LOWER(name) LIKE ? THEN 2
                 WHEN LOWER(variant_name) LIKE ? THEN 3
                 ELSE 4 
               END,
               name ASC
             LIMIT ?`,
            [
              auth.businessId,
              ...wordParams,
              exactPhrase,      // priority 1: exact phrase match
              firstWordStarts,  // priority 2: name starts with first word
              exactPhrase,      // priority 3: variant has exact phrase
              limit
            ]
          );
        }
      }
    } else if (all) {
      if (parentsOnly) {
        // Only parent items (no parent_item_id) - for admin management
        items = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ?${activeFilter} AND parent_item_id IS NULL${itemTypeFilter}
           ORDER BY name ASC`,
          [auth.businessId]
        );
      } else if (sellableOnly) {
        // Only sellable items (variants OR standalone items without variants)
        const variantActiveFilter = includeInactive ? '' : ' AND v.active = 1';
        items = await query<Item>(
          `SELECT i.* FROM items i
           WHERE i.business_id = ?${iActiveFilter}${itemTypeFilter.replace(' AND ', ' AND i.')}
           AND (
             i.parent_item_id IS NOT NULL  -- variants are sellable
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id${variantActiveFilter})  -- standalone items without variants
           )
           ORDER BY i.name ASC`,
          [auth.businessId]
        );
      } else {
        items = await query<Item>(
          `SELECT * FROM items 
           WHERE business_id = ?${activeFilter}${itemTypeFilter}
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
           AND parent_item_id IS NULL${itemTypeFilter}
           ORDER BY name ASC`,
          [auth.businessId, categoryId]
        );
      } else if (sellableOnly) {
        // Sellable items in category
        items = await query<Item>(
          `SELECT i.* FROM items i
           WHERE i.business_id = ? AND i.category_id = ? AND i.active = 1${itemTypeFilter.replace(' AND ', ' AND i.')}
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
           WHERE business_id = ? AND category_id = ? AND active = 1${itemTypeFilter}
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
      barcode,       // optional barcode
      expiryDate,    // optional expiry date (Unix timestamp)
      itemType,      // 'grocery' or 'retail' (defaults to 'retail')
      // Bundle pricing fields
      bundleQuantity, // number of units in a bundle (e.g., 3)
      bundlePrice,    // price for the bundle (e.g., 20)
      bundleName,     // optional friendly name (e.g., "3 for 20")
      // Packaging unit fields (bulk ordering)
      packagingUnitName, // e.g., "Carton", "Sack", "Crate"
      packagingUnitQty,  // items per packaging unit (e.g., 18)
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

    // Check for duplicate barcode if provided
    if (barcode && barcode.trim()) {
      const existingBarcodeItem = await queryOne<{ id: string; name: string; barcode: string }>(
        `SELECT id, name, barcode FROM items 
         WHERE business_id = ? AND barcode = ? AND active = 1`,
        [auth.businessId, barcode.trim()]
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

    // If creating a variant, verify parent exists and check for duplicate variant
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

      // Check for duplicate variant name under same parent
      if (variantName) {
        const existingVariant = await queryOne<{ id: string; variant_name: string }>(
          `SELECT id, variant_name FROM items 
           WHERE business_id = ? AND parent_item_id = ? 
           AND LOWER(variant_name) = LOWER(?) AND active = 1`,
          [auth.businessId, parentItemId, variantName.trim()]
        );

        if (existingVariant) {
          return jsonResponse(
            {
              success: false,
              message: `"${parentItem.name}" already has a variant called "${existingVariant.variant_name}". Please use a different variant name.`
            },
            409
          );
        }
      }
    } else {
      // Check for duplicate standalone/parent item name
      const existingItem = await queryOne<{ id: string; name: string }>(
        `SELECT id, name FROM items 
         WHERE business_id = ? AND LOWER(name) = LOWER(?) 
         AND parent_item_id IS NULL AND active = 1`,
        [auth.businessId, name.trim()]
      );

      if (existingItem) {
        return jsonResponse(
          {
            success: false,
            message: `A product named "${existingItem.name}" already exists. Please use a different name.`
          },
          409
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
        item_type, current_stock, current_sell_price, min_stock_level, barcode, expiry_date,
        bundle_quantity, bundle_price, bundle_name,
        packaging_unit_name, packaging_unit_qty,
        active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        auth.businessId,
        categoryId,
        parentItemId || null,
        name.trim(),
        variantName?.trim() || null,
        isParent ? 'piece' : unitType, // Parent items need a default unit_type
        itemType || 'retail', // Default to 'retail' if not specified
        isParent ? 0 : stock,
        price,
        isParent ? null : (minStockLevel || null),
        barcode?.trim() || null,
        expiryDate || null,
        // Bundle pricing (null if not set or if parent item)
        isParent ? null : (bundleQuantity || null),
        isParent ? null : (bundlePrice || null),
        isParent ? null : (bundleName?.trim() || null),
        // Packaging units (for bulk ordering)
        packagingUnitName?.trim() || null,
        packagingUnitQty || null,
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

