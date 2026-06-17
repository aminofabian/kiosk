import { NextRequest } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { migrateCountShifts } from "@/lib/db/migrate-count-shifts";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import type { CountItemPool } from "@/lib/db/types";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/count-pool
 * Returns all items in the count item pool with item details.
 * Query params:
 *   - department: filter by department (optional)
 *   - pinned: filter pinned items only (optional, '1' or '0')
 *   - excluded: filter excluded items only (optional, '1' or '0')
 */
export async function GET(request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Only admin/owner can manage the pool
    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const department = searchParams.get("department");
    const pinned = searchParams.get("pinned");
    const excluded = searchParams.get("excluded");

    if (search) {
      const like = `%${search}%`;
      const searchResults = await query<
        CountItemPool & {
          item_name: string;
          barcode: string | null;
          current_stock: number;
          current_sell_price: number;
        }
      >(
        `SELECT i.id AS id,
                i.business_id,
                i.id AS item_id,
                NULL AS department,
                0 AS pinned,
                0 AS excluded,
                NULL AS last_selected_at,
                i.created_at,
                i.name AS item_name,
                i.barcode,
                i.current_stock,
                i.current_sell_price
         FROM items i
         WHERE i.business_id = ? AND i.active = 1
           AND (i.name LIKE ? OR i.barcode LIKE ?)
           AND (i.parent_item_id IS NOT NULL OR NOT EXISTS (
             SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1
           ))
         ORDER BY i.name
         LIMIT 25`,
        [auth.businessId, like, like],
      );
      return jsonResponse({ success: true, data: searchResults });
    }

    let sql = `
      SELECT cip.*, i.name as item_name, i.barcode, i.current_stock, i.current_sell_price
      FROM count_item_pool cip
      JOIN items i ON cip.item_id = i.id
      WHERE cip.business_id = ?
    `;
    const params: (string | number)[] = [auth.businessId];

    if (department) {
      sql += " AND cip.department = ?";
      params.push(department);
    }

    if (pinned === "1") {
      sql += " AND cip.pinned = 1";
    } else if (pinned === "0") {
      sql += " AND cip.pinned = 0";
    }

    if (excluded === "1") {
      sql += " AND cip.excluded = 1";
    } else if (excluded === "0") {
      sql += " AND cip.excluded = 0";
    }

    sql += " ORDER BY cip.pinned DESC, cip.last_selected_at DESC NULLS LAST";

    const items = await query<
      CountItemPool & {
        item_name: string;
        barcode: string | null;
        current_stock: number;
        current_sell_price: number;
      }
    >(sql, params);

    return jsonResponse({ success: true, data: items });
  } catch (error) {
    console.error("Error fetching count pool:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch count pool",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

/**
 * POST /api/count-pool
 * Add or update items in the count item pool.
 * Body: { items: Array<{ itemId: string, department?: string, pinned?: boolean, excluded?: boolean }> }
 */
export async function POST(request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: "Items array is required" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let added = 0;
    let updated = 0;

    for (const item of items) {
      if (!item.itemId) continue;

      // Verify item exists
      const existing = await queryOne<{ id: string }>(
        "SELECT id FROM items WHERE id = ? AND business_id = ?",
        [item.itemId, auth.businessId],
      );
      if (!existing) continue;

      // Check if already in pool
      const poolItem = await queryOne<CountItemPool>(
        "SELECT * FROM count_item_pool WHERE business_id = ? AND item_id = ?",
        [auth.businessId, item.itemId],
      );

      if (poolItem) {
        // Update existing
        await execute(
          `UPDATE count_item_pool
           SET department = COALESCE(?, department),
               pinned = COALESCE(?, pinned),
               excluded = COALESCE(?, excluded)
           WHERE id = ?`,
          [
            item.department ?? null,
            item.pinned !== undefined ? (item.pinned ? 1 : 0) : null,
            item.excluded !== undefined ? (item.excluded ? 1 : 0) : null,
            poolItem.id,
          ],
        );
        updated++;
      } else {
        // Add new
        const id = generateUUID();
        await execute(
          `INSERT INTO count_item_pool (id, business_id, item_id, department, pinned, excluded, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            auth.businessId,
            item.itemId,
            item.department ?? null,
            item.pinned ? 1 : 0,
            item.excluded ? 1 : 0,
            now,
          ],
        );
        added++;
      }
    }

    return jsonResponse({
      success: true,
      message: `${added} items added, ${updated} items updated in pool`,
      data: { added, updated },
    });
  } catch (error) {
    console.error("Error updating count pool:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to update count pool",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

/**
 * DELETE /api/count-pool
 * Remove an item from the pool.
 * Query: ?itemId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    await migrateCountShifts();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!["admin", "owner"].includes(auth.role)) {
      return jsonResponse({ success: false, message: "Forbidden" }, 403);
    }

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get("id");
    const itemId = searchParams.get("itemId");

    if (!poolId && !itemId) {
      return jsonResponse(
        { success: false, message: "id or itemId query parameter is required" },
        400,
      );
    }

    if (poolId) {
      await execute(
        "DELETE FROM count_item_pool WHERE business_id = ? AND id = ?",
        [auth.businessId, poolId],
      );
    } else if (itemId) {
      await execute(
        "DELETE FROM count_item_pool WHERE business_id = ? AND item_id = ?",
        [auth.businessId, itemId],
      );
    }

    return jsonResponse({ success: true, message: "Item removed from pool" });
  } catch (error) {
    console.error("Error removing from count pool:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to remove item from pool",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
