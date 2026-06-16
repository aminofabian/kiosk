import { NextRequest } from "next/server";
import { query, execute, queryOne } from "@/lib/db";
import { buildFtsFuzzyProbeMatch, buildFtsMatchQuery, itemsFtsAvailable } from "@/lib/db/item-fts";
import {
  charSequencePattern,
  scoreItemTextMatch,
} from "@/lib/search/fuzzy-text";
import { generateUUID } from "@/lib/utils/uuid";
import { generateBatchNumber } from "@/lib/utils/batch-number";
import type { Item } from "@/lib/db/types";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import {
  requireAuth,
  requirePermission,
  isAuthResponse,
} from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import { recordBuyingPrice } from "@/lib/db/buying-prices";

// Disable caching for this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get("categoryId");
    const all = searchParams.get("all") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const search = searchParams.get("search");
    const parentsOnly = searchParams.get("parentsOnly") === "true";
    const parentId = searchParams.get("parentId"); // Get variants of a specific parent
    const sellableOnly = searchParams.get("sellableOnly") === "true"; // Only items that can be sold (not parent containers)
    const itemType = searchParams.get("itemType")?.trim() || null;
    const itemTypes = searchParams.get("itemTypes")?.trim() || null; // Comma-separated list of type keys
    const noBarcode = searchParams.get("noBarcode") === "true";

    const itemTypeFilter = itemType ? ` AND item_type = ?` : "";
    const itemTypeParam = itemType ? [itemType] : [];
    // itemTypes: comma-separated list, generates "item_type IN (?,?,...)"
    const itemTypeList = itemTypes
      ? itemTypes
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : null;
    const itemTypeInFilter =
      itemTypeList && itemTypeList.length > 0
        ? ` AND item_type IN (${itemTypeList.map(() => "?").join(",")})`
        : "";
    const itemTypeInFilterAlias =
      itemTypeList && itemTypeList.length > 0
        ? ` AND i.item_type IN (${itemTypeList.map(() => "?").join(",")})`
        : "";
    const noBarcodeFilter = noBarcode
      ? ` AND (COALESCE(TRIM(barcode), '') = '')`
      : "";
    const noBarcodeFilterAlias = noBarcode
      ? ` AND (COALESCE(TRIM(i.barcode), '') = '')`
      : "";
    // When noBarcode: exclude parents (they don't have barcodes; only variants/standalone do)
    const noBarcodeExcludeParents = noBarcode
      ? ` AND (parent_item_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = items.id AND v.active = 1))`
      : "";
    const noBarcodeExcludeParentsAlias = noBarcode
      ? ` AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1))`
      : "";
    // When includeInactive=true (admin "show deleted"), include soft-deleted items
    const activeFilter = includeInactive && all ? "" : " AND active = 1";
    const iActiveFilter = includeInactive && all ? "" : " AND i.active = 1";

    let items: Item[];

    if (parentId) {
      // Get variants of a specific parent item
      items = await query<Item>(
        `SELECT * FROM items
         WHERE business_id = ? AND parent_item_id = ? AND active = 1 ${itemTypeFilter}${noBarcodeFilter}
         ORDER BY variant_name ASC, unit_type ASC`,
        [auth.businessId, parentId, ...itemTypeParam],
      );
    } else if (search) {
      const rawSearch = search;
      const searchLower = search.toLowerCase().trim();
      const limit = searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : 50;
      const useItemFts = await itemsFtsAvailable();
      const ftsMatch = useItemFts ? buildFtsMatchQuery(rawSearch) : null;

      // Check if search looks like a barcode (numeric and 8+ digits)
      const isBarcodeLike = /^\d{8,}$/.test(search.trim());

      if (isBarcodeLike) {
        // First try exact barcode match
        const barcodeItems = await query<Item>(
          `SELECT * FROM items
           WHERE business_id = ? AND active = 1 AND barcode = ?
           LIMIT 1`,
          [auth.businessId, search.trim()],
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
              limit,
            ],
          );
        }
      } else {
        // Split search into words for multi-word matching
        const searchWords = searchLower
          .split(/\s+/)
          .filter((w) => w.length > 0);

        const sellableFilter = sellableOnly
          ? ` AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1))`
          : "";

        if (ftsMatch) {
          items = await query<Item>(
            `SELECT i.* FROM items_fts
             INNER JOIN items i ON i.id = items_fts.item_id
             WHERE items_fts.business_id = ?
               AND items_fts MATCH ?
               AND i.active = 1${sellableFilter}
             ORDER BY bm25(items_fts), i.name ASC
             LIMIT ?`,
            [auth.businessId, ftsMatch, limit],
          );
        } else if (searchWords.length === 1) {
          // Single word search - match name, variant_name, and parent name (for variants)
          const searchContains = `%${searchLower}%`;
          const searchStarts = `${searchLower}%`;
          items = await query<Item>(
            `SELECT i.* FROM items i
             LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
             WHERE i.business_id = ? AND i.active = 1
             AND (
               LOWER(i.name) LIKE ?
               OR LOWER(COALESCE(i.variant_name, '')) LIKE ?
               OR LOWER(COALESCE(p.name, '')) LIKE ?
             )${sellableFilter}
             ORDER BY
               CASE
                 WHEN LOWER(i.name) LIKE ? THEN 1
                 WHEN LOWER(COALESCE(i.variant_name, '')) LIKE ? THEN 2
                 WHEN LOWER(COALESCE(p.name, '')) LIKE ? THEN 3
                 WHEN LOWER(i.name) LIKE ? THEN 4
                 ELSE 5
               END,
               i.name ASC
             LIMIT ?`,
            [
              auth.businessId,
              searchContains,
              searchContains,
              searchContains,
              searchStarts,
              searchStarts,
              searchStarts,
              searchContains,
              limit,
            ],
          );
        } else {
          // Multi-word search - match items containing ALL words (in any order)
          // Match name, variant_name, and parent name
          const wordConditions = searchWords
            .map(
              () =>
                `(LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.variant_name, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ?)`,
            )
            .join(" AND ");

          const wordParams: string[] = [];
          searchWords.forEach((word) => {
            wordParams.push(`%${word}%`, `%${word}%`, `%${word}%`);
          });

          // For ordering, prioritize exact phrase match, then first word starts
          const exactPhrase = `%${searchLower}%`;
          const firstWordStarts = `${searchWords[0]}%`;

          items = await query<Item>(
            `SELECT i.* FROM items i
             LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
             WHERE i.business_id = ? AND i.active = 1
             AND (${wordConditions})${sellableFilter}
             ORDER BY
               CASE
                 WHEN LOWER(i.name) LIKE ? THEN 1
                 WHEN LOWER(i.name) LIKE ? THEN 2
                 WHEN LOWER(COALESCE(i.variant_name, '')) LIKE ? THEN 3
                 ELSE 4
               END,
               i.name ASC
             LIMIT ?`,
            [
              auth.businessId,
              ...wordParams,
              exactPhrase, // priority 1: exact phrase match
              firstWordStarts, // priority 2: name starts with first word
              exactPhrase, // priority 3: variant has exact phrase
              limit,
            ],
          );
        }
      }

      // ── Fuzzy fallback: split a single unspaced word into two for typo/spacing tolerance ──
      if (
        items.length === 0 &&
        !searchLower.includes(" ") &&
        searchLower.length >= 6 &&
        searchLower.length <= 20
      ) {
        const fuzzyMatches: string[] = [];
        for (let i = 3; i < searchLower.length - 2; i++) {
          fuzzyMatches.push(
            `${searchLower.slice(0, i)}* AND ${searchLower.slice(i)}*`,
          );
        }
        // Try FTS with all word splits using OR
        const sellableFuzzyFilter = sellableOnly
          ? ` AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1))`
          : "";
        if (useItemFts && fuzzyMatches.length > 0) {
          const fuzzyQuery = `(${fuzzyMatches.join(" OR ")})`;
          const fuzzyItems = await query<Item>(
            `SELECT i.* FROM items_fts
             INNER JOIN items i ON i.id = items_fts.item_id
             WHERE items_fts.business_id = ?
               AND items_fts MATCH ?
               AND i.active = 1${sellableFuzzyFilter}
             ORDER BY bm25(items_fts), i.name ASC
             LIMIT ?`,
            [auth.businessId, fuzzyQuery, limit],
          );
          if (fuzzyItems.length > 0) items = fuzzyItems;
        }
        // Also try LIKE with spaces between each possible split
        if (items.length === 0) {
          for (let i = 3; i < searchLower.length - 2; i++) {
            const w1 = searchLower.slice(0, i);
            const w2 = searchLower.slice(i);
            const fuzzyLikeItems = await query<Item>(
              `SELECT i.* FROM items i
               LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
               WHERE i.business_id = ? AND i.active = 1
               AND (
                 (LOWER(i.name) LIKE ? AND LOWER(i.name) LIKE ?)
                 OR (LOWER(COALESCE(i.variant_name, '')) LIKE ? AND LOWER(COALESCE(i.variant_name, '')) LIKE ?)
               )${sellableFuzzyFilter}
               ORDER BY i.name ASC
               LIMIT ?`,
              [
                auth.businessId,
                `%${w1}%`,
                `%${w2}%`,
                `%${w1}%`,
                `%${w2}%`,
                limit,
              ],
            );
            if (fuzzyLikeItems.length > 0) {
              items = fuzzyLikeItems;
              break;
            }
          }
        }
      }

      // Fuzzy fallback (same scoring as /api/items/suggest) when primary search finds too few
      if (items.length < 3 && searchLower.length >= 2 && !isBarcodeLike) {
        const existingIds = new Set(items.map((i) => i.id));
        const fuzzyLimit = limit - items.length;
        const fuzzyCap = fuzzyLimit + 10;
        const sellableFuzzyFilter = sellableOnly
          ? ` AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1))`
          : "";
        const ftsFuzzyProbe = useItemFts
          ? buildFtsFuzzyProbeMatch(rawSearch)
          : null;

        type FuzzyRow = Item & { parent_name?: string | null };
        let fuzzyItems: FuzzyRow[];

        if (ftsFuzzyProbe) {
          fuzzyItems = await query<FuzzyRow>(
            `SELECT i.*, p.name as parent_name FROM items_fts
             INNER JOIN items i ON i.id = items_fts.item_id
             LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
             WHERE items_fts.business_id = ?
               AND items_fts MATCH ?
               AND i.active = 1${sellableFuzzyFilter}
             ORDER BY bm25(items_fts), i.name ASC
             LIMIT ?`,
            [
              auth.businessId,
              ftsFuzzyProbe,
              Math.min(200, fuzzyCap * 8),
            ],
          );
        } else {
          const fuzzyPattern = charSequencePattern(searchLower);
          fuzzyItems = await query<FuzzyRow>(
            `SELECT i.*, p.name as parent_name FROM items i
             LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
             WHERE i.business_id = ? AND i.active = 1
             AND (
               LOWER(i.name) LIKE ?
               OR LOWER(COALESCE(i.variant_name, '')) LIKE ?
               OR LOWER(COALESCE(p.name, '')) LIKE ?
             )${sellableFuzzyFilter}
             LIMIT ?`,
            [
              auth.businessId,
              fuzzyPattern,
              fuzzyPattern,
              fuzzyPattern,
              fuzzyCap,
            ],
          );
        }

        const scored = fuzzyItems
          .filter((fi) => !existingIds.has(fi.id))
          .map((fi) => ({
            item: fi,
            score: scoreItemTextMatch(searchLower, {
              name: fi.name,
              variantName: fi.variant_name,
              parentName: fi.parent_name,
            }),
          }))
          .filter((s) => s.score > 0.25)
          .sort((a, b) => b.score - a.score)
          .slice(0, fuzzyLimit);

        for (const { item } of scored) {
          const { parent_name: _pn, ...rest } = item;
          items.push(rest);
          existingIds.add(item.id);
        }
      }

      // When search returns variants, include their parents so the grid can display them
      const variantParentIds = [
        ...new Set(
          items
            .filter(
              (i): i is Item & { parent_item_id: string } => !!i.parent_item_id,
            )
            .map((i) => i.parent_item_id),
        ),
      ];
      if (variantParentIds.length > 0) {
        const existingIds = new Set(items.map((i) => i.id));
        const parents = await query<Item>(
          `SELECT * FROM items WHERE id IN (${variantParentIds.map(() => "?").join(",")}) AND business_id = ? AND active = 1`,
          [...variantParentIds, auth.businessId],
        );
        for (const p of parents) {
          if (!existingIds.has(p.id)) {
            items.push(p);
            existingIds.add(p.id);
          }
        }
      }
    } else if (all) {
      if (parentsOnly) {
        // Only parent items (no parent_item_id) - for admin management
        items = await query<Item>(
          `SELECT * FROM items
           WHERE business_id = ?${activeFilter} AND parent_item_id IS NULL${itemTypeFilter}${noBarcodeFilter}
           ORDER BY name ASC`,
          [auth.businessId, ...itemTypeParam],
        );
      } else if (sellableOnly) {
        // Only sellable items (variants OR standalone items without variants)
        const variantActiveFilter = includeInactive ? "" : " AND v.active = 1";
        items = await query<Item>(
          `SELECT i.* FROM items i
           WHERE i.business_id = ?${iActiveFilter}${itemTypeFilter.replace(" AND ", " AND i.")}${itemTypeInFilterAlias}${noBarcodeFilterAlias}${noBarcodeExcludeParentsAlias}
           AND (
             i.parent_item_id IS NOT NULL  -- variants are sellable
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id${variantActiveFilter})  -- standalone items without variants
           )
           ORDER BY i.name ASC`,
          itemTypeList
            ? [auth.businessId, ...itemTypeList, ...itemTypeParam]
            : [auth.businessId, ...itemTypeParam],
        );
      } else {
        if (noBarcode) {
          // noBarcode: only variants + standalone; include parent name for labels
          items = await query<Item & { parent_name?: string }>(
            `SELECT i.*, p.name as parent_name
             FROM items i
             LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
             WHERE i.business_id = ? AND i.active = 1${itemTypeFilter.replace(" AND ", " AND i.")}
             AND (COALESCE(TRIM(i.barcode), '') = '')
             AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1))
             ORDER BY COALESCE(p.name, i.name), i.variant_name ASC`,
            [auth.businessId, ...itemTypeParam],
          );
        } else {
          items = await query<Item>(
            `SELECT * FROM items
             WHERE business_id = ?${activeFilter}${itemTypeFilter}${noBarcodeFilter}
             ORDER BY name ASC`,
            [auth.businessId, ...itemTypeParam],
          );
        }
      }
    } else {
      if (!categoryId) {
        return jsonResponse(
          {
            success: false,
            message: "categoryId is required",
          },
          400,
        );
      }

      if (parentsOnly) {
        // Parent items in a category (for POS - show these, then expand to variants)
        items = await query<Item>(
          `SELECT * FROM items
           WHERE business_id = ? AND category_id = ? AND active = 1
           AND parent_item_id IS NULL${itemTypeFilter}${noBarcodeFilter}${itemTypeInFilter}
           ORDER BY name ASC`,
          itemTypeList
            ? [auth.businessId, categoryId, ...itemTypeList, ...itemTypeParam]
            : [auth.businessId, categoryId, ...itemTypeParam],
        );
      } else if (sellableOnly) {
        // Sellable items in category
        items = await query<Item>(
          `SELECT i.* FROM items i
           LEFT JOIN items p ON i.parent_item_id = p.id AND p.business_id = i.business_id
           WHERE i.business_id = ? AND (
             i.category_id = ?
             OR (i.parent_item_id IS NOT NULL AND p.category_id = ?)
           ) AND i.active = 1${itemTypeFilter.replace(" AND ", " AND i.")}${noBarcodeFilterAlias}${itemTypeInFilterAlias}
           AND (
             i.parent_item_id IS NOT NULL
             OR NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)
           )
           ORDER BY i.name ASC`,
          itemTypeList
            ? [
                auth.businessId,
                categoryId,
                categoryId,
                ...itemTypeList,
                ...itemTypeParam,
              ]
            : [auth.businessId, categoryId, categoryId, ...itemTypeParam],
        );
      } else {
        items = await query<Item>(
          `SELECT * FROM items
           WHERE business_id = ? AND category_id = ? AND active = 1${itemTypeFilter}${noBarcodeFilter}${itemTypeInFilter}
           ORDER BY name ASC`,
          itemTypeList
            ? [auth.businessId, categoryId, ...itemTypeList, ...itemTypeParam]
            : [auth.businessId, categoryId, ...itemTypeParam],
        );
      }
    }

    // Enrich with FIFO batch_number for POS display (search/category sellable) and price stickers (all sellable)
    const needsBatchNumber =
      (search || (categoryId && sellableOnly) || (all && sellableOnly)) &&
      items.length > 0;
    if (needsBatchNumber) {
      const itemIds = items.map((i) => i.id);
      const batchRows = await query<{ item_id: string; batch_number: string }>(
        `SELECT item_id, batch_number FROM inventory_batches
         WHERE item_id IN (${itemIds.map(() => "?").join(",")})
           AND quantity_remaining > 0 AND status = 'active'
         ORDER BY received_at ASC`,
        itemIds,
      );
      const batchByItem = new Map<string, string>();
      for (const row of batchRows) {
        if (!batchByItem.has(row.item_id))
          batchByItem.set(row.item_id, row.batch_number);
      }
      items = items.map((i) => ({
        ...i,
        batch_number: batchByItem.get(i.id) ?? null,
      }));
    }

    return jsonResponse({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch items",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("manage_items");
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
      isParent, // true if creating a parent item (container)
      parentItemId, // set if creating a variant
      variantName, // e.g., "Big", "Small", "Red Kidney"
      barcode, // optional barcode
      productCode, // optional 3-5 char code for batch numbering
      expiryDate, // optional expiry date (Unix timestamp)
      itemType,
      // Bundle pricing fields
      bundleQuantity, // number of units in a bundle (e.g., 3)
      bundlePrice, // price for the bundle (e.g., 20)
      bundleName, // optional friendly name (e.g., "3 for 20")
      // Packaging unit fields (bulk ordering)
      packagingUnitName, // e.g., "Carton", "Sack", "Crate"
      packagingUnitQty, // items per packaging unit (e.g., 18)
      aisleNumber, // optional store location (e.g., "A3", "12")
    } = body;

    // Parent items don't need price/stock/unit - they're just containers
    if (isParent) {
      if (!name || !categoryId) {
        return jsonResponse(
          {
            success: false,
            message: "Name and category are required for parent items",
          },
          400,
        );
      }
    } else {
      // Regular items and variants need all fields
      if (!name || !categoryId || !unitType || sellPrice === undefined) {
        return jsonResponse(
          { success: false, message: "Missing required fields" },
          400,
        );
      }

      if (sellPrice <= 0) {
        return jsonResponse(
          { success: false, message: "Sell price must be greater than 0" },
          400,
        );
      }
    }

    const stock = initialStock || 0;

    // Verify category exists
    const category = await queryOne<{ id: string }>(
      "SELECT id FROM categories WHERE id = ? AND business_id = ?",
      [categoryId, auth.businessId],
    );

    if (!category) {
      return jsonResponse(
        { success: false, message: "Category not found" },
        404,
      );
    }

    // Check for duplicate barcode if provided
    if (barcode && barcode.trim()) {
      const existingBarcodeItem = await queryOne<{
        id: string;
        name: string;
        barcode: string;
      }>(
        `SELECT id, name, barcode FROM items
         WHERE business_id = ? AND barcode = ? AND active = 1`,
        [auth.businessId, barcode.trim()],
      );

      if (existingBarcodeItem) {
        return jsonResponse(
          {
            success: false,
            message: `A product with barcode "${barcode.trim()}" already exists (${existingBarcodeItem.name}). Please use a different barcode or remove it.`,
          },
          409,
        );
      }
    }

    // If creating a variant, verify parent exists and check for duplicate variant
    if (parentItemId) {
      const parentItem = await queryOne<{ id: string; name: string }>(
        "SELECT id, name FROM items WHERE id = ? AND business_id = ? AND parent_item_id IS NULL",
        [parentItemId, auth.businessId],
      );

      if (!parentItem) {
        return jsonResponse(
          { success: false, message: "Parent item not found" },
          404,
        );
      }

      // Check for duplicate variant name under same parent
      if (variantName) {
        const existingVariant = await queryOne<{
          id: string;
          variant_name: string;
        }>(
          `SELECT id, variant_name FROM items
           WHERE business_id = ? AND parent_item_id = ?
           AND LOWER(variant_name) = LOWER(?) AND active = 1`,
          [auth.businessId, parentItemId, variantName.trim()],
        );

        if (existingVariant) {
          return jsonResponse(
            {
              success: false,
              message: `"${parentItem.name}" already has a variant called "${existingVariant.variant_name}". Please use a different variant name.`,
            },
            409,
          );
        }
      }
    } else {
      // Check for duplicate standalone/parent item name
      const existingItem = await queryOne<{ id: string; name: string }>(
        `SELECT id, name FROM items
         WHERE business_id = ? AND LOWER(name) = LOWER(?)
         AND parent_item_id IS NULL AND active = 1`,
        [auth.businessId, name.trim()],
      );

      if (existingItem) {
        return jsonResponse(
          {
            success: false,
            message: `A product named "${existingItem.name}" already exists. Please use a different name.`,
          },
          409,
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
        item_type, current_stock, current_sell_price, min_stock_level, barcode, product_code, expiry_date,
        bundle_quantity, bundle_price, bundle_name,
        packaging_unit_name, packaging_unit_qty,
        aisle_number,
        active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        auth.businessId,
        categoryId,
        parentItemId || null,
        name.trim(),
        variantName?.trim() || null,
        isParent ? "piece" : unitType, // Parent items need a default unit_type
        itemType || "retail", // Default to 'retail' if not specified
        isParent ? 0 : stock,
        price,
        isParent ? null : minStockLevel || null,
        barcode?.trim() || null,
        productCode?.trim() || null,
        expiryDate || null,
        // Bundle pricing (null if not set or if parent item)
        isParent ? null : bundleQuantity || null,
        isParent ? null : bundlePrice || null,
        isParent ? null : bundleName?.trim() || null,
        // Packaging units (for bulk ordering)
        packagingUnitName?.trim() || null,
        packagingUnitQty || null,
        aisleNumber?.trim() || null,
        1,
        now,
      ],
    );

    // Create initial selling price record (only for sellable items)
    if (!isParent && price > 0) {
      const priceId = generateUUID();
      await execute(
        `INSERT INTO selling_prices (
          id, item_id, price, effective_from, set_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [priceId, itemId, price, now, auth.userId, now],
      );
    }

    // If initial stock and buy price provided, create inventory batch
    if (!isParent && stock > 0 && buyPrice) {
      const batchId = generateUUID();
      const batchNumber = await generateBatchNumber(
        itemId,
        auth.businessId,
        now,
      );
      await execute(
        `INSERT INTO inventory_batches (
          id, business_id, item_id, source_breakdown_id, batch_number, status,
          supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
          received_at, created_at
        ) VALUES (?, ?, ?, NULL, ?, 'active', NULL, ?, ?, ?, ?, ?)`,
        [
          batchId,
          auth.businessId,
          itemId,
          batchNumber,
          stock,
          stock,
          buyPrice,
          now,
          now,
        ],
      );
      await recordBuyingPrice({
        itemId,
        supplierId: null,
        price: buyPrice,
        setBy: auth.userId,
      });
    }

    const displayName = variantName
      ? `${name.trim()} (${variantName.trim()})`
      : name.trim();
    logActivity({
      businessId: auth.businessId,
      action: "create",
      entityType: "item",
      entityId: itemId,
      entityNameSnapshot: displayName,
      details: { isParent: !!isParent, initialStock: stock },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: isParent
        ? "Parent item created successfully"
        : "Item created successfully",
      data: {
        itemId,
        isParent: !!isParent,
      },
    });
  } catch (error) {
    console.error("Error creating item:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to create item",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
