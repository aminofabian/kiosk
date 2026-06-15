import { NextRequest } from "next/server";
import { execute, query, queryOne, transaction } from "@/lib/db";
import { migratePendingSales } from "@/lib/db/migrate-pending-sales";
import { migrateDepartmentStaffRole } from "@/lib/db/migrate-department-staff-role";
import { migrateOriginatedBy } from "@/lib/db/migrate-originated-by";
import { migrateUserDepartment } from "@/lib/db/migrate-user-department";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { hasPermission } from "@/lib/auth/permissions";

export async function OPTIONS() {
  return optionsResponse();
}

interface PendingItemInput {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  inventoryBatchId?: string;
  batchNumber?: string;
  isBundle?: boolean;
  bundleQuantity?: number;
}

interface PendingSaleRow {
  id: string;
  user_id: string;
  user_name?: string;
  status: "pending" | "discarded";
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: number;
  updated_at: number;
  discarded_by_name?: string | null;
  originated_by_user_id?: string | null;
  originated_by_name?: string | null;
  user_role?: string | null;
}

interface PendingItemRow {
  id: string;
  sale_id: string;
  item_id: string;
  name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
  inventory_batch_id: string | null;
  batch_number: string | null;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * POST /api/sales/pending
 * Create or update a pending sale from the current cart.
 * Does not reserve stock or process payment.
 */
export async function POST(request: NextRequest) {
  try {
    await migratePendingSales();
    await migrateDepartmentStaffRole();
    await migrateOriginatedBy();
    await migrateUserDepartment();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const items: PendingItemInput[] = Array.isArray(body.items)
      ? body.items
      : [];

    if (items.length === 0) {
      return jsonResponse(
        { success: false, message: "Cart must contain at least one item" },
        400,
      );
    }

    // Validate all items belong to the business and are active.
    const itemIds = [...new Set(items.map((i) => i.itemId))];
    const placeholders = itemIds.map(() => "?").join(",");
    const activeItems = await query<{
      id: string;
      name: string;
      active: number;
    }>(
      `SELECT id, name, active FROM items
       WHERE id IN (${placeholders}) AND business_id = ?`,
      [...itemIds, auth.businessId],
    );

    const activeItemMap = new Map(activeItems.map((i) => [i.id, i]));
    for (const item of items) {
      const dbItem = activeItemMap.get(item.itemId);
      if (!dbItem) {
        return jsonResponse(
          { success: false, message: `Item ${item.itemId} not found` },
          404,
        );
      }
      if (!dbItem.active) {
        return jsonResponse(
          { success: false, message: `Item "${dbItem.name}" is inactive` },
          400,
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const totalAmount = roundMoney(
      items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );

    const pendingSaleId = await transaction(async (tx) => {
      let saleId: string;

      if (typeof body.pendingSaleId === "string" && body.pendingSaleId) {
        // Verify the pending sale exists and belongs to this user/business.
        const existing = await tx.queryOne<{ id: string; status: string }>(
          `SELECT id, status FROM sales
           WHERE id = ? AND business_id = ? AND user_id = ?`,
          [body.pendingSaleId, auth.businessId, auth.userId],
        );
        if (!existing || existing.status !== "pending") {
          throw new Error("Pending sale not found");
        }
        saleId = existing.id;

        await tx.execute(
          `UPDATE sales
           SET total_amount = ?, updated_at = ?,
               customer_name = ?, customer_phone = ?
           WHERE id = ?`,
          [
            totalAmount,
            now,
            body.customerName || null,
            body.customerPhone || null,
            saleId,
          ],
        );
      } else {
        saleId = generateUUID();
        await tx.execute(
          `INSERT INTO sales (
            id, business_id, user_id, shift_id, total_amount, payment_method,
            status, customer_name, customer_phone, originated_by_user_id,
            sale_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            auth.businessId,
            auth.userId,
            null,
            totalAmount,
            "cash",
            "pending",
            body.customerName || null,
            body.customerPhone || null,
            body.originatedByUserId || null,
            now,
            now,
            now,
          ],
        );
      }

      // Replace sale_items with current cart contents.
      await tx.execute(`DELETE FROM sale_items WHERE sale_id = ?`, [saleId]);

      for (const item of items) {
        const itemId = generateUUID();
        await tx.execute(
          `INSERT INTO sale_items (
            id, sale_id, item_id, inventory_batch_id, quantity_sold,
            sell_price_per_unit, buy_price_per_unit, profit, item_type_snapshot,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            saleId,
            item.itemId,
            item.inventoryBatchId || null,
            item.quantity,
            item.price,
            0,
            0,
            "retail",
            now,
          ],
        );
      }

      return saleId;
    });

    return jsonResponse({
      success: true,
      data: {
        pendingSaleId,
        totalAmount,
        itemCount: items.length,
      },
    });
  } catch (error) {
    console.error("Error saving pending sale:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to save pending sale",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

/**
 * GET /api/sales/pending
 * List pending sales for the cashier (or all for admin/owner).
 * ?includeDiscarded=1 also returns soft-discarded carts (admin audit view).
 */
export async function GET(request: NextRequest) {
  try {
    await migratePendingSales();
    await migrateDepartmentStaffRole();
    await migrateOriginatedBy();
    await migrateUserDepartment();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const canViewAll = hasPermission(auth.role, "view_all_sales");
    const includeDiscarded =
      request.nextUrl.searchParams.get("includeDiscarded") === "1";
    const includeCompleted =
      request.nextUrl.searchParams.get("includeCompleted") === "1";

    const statuses: string[] = ["pending"];
    if (includeDiscarded) statuses.push("discarded");
    if (includeCompleted) statuses.push("completed");
    const placeholders = statuses.map(() => "?").join(",");

    // Scoping rules:
    // - Admin/owner: see ALL sales (canViewAll = true)
    // - Cashier: see ALL pending/discarded sales (need to process forwarded orders)
    // - Department staff: see only their own + originated sales
    const isCashier = auth.role === "cashier";
    const deptStaffFilter =
      !canViewAll && !isCashier
        ? "AND (s.user_id = ? OR s.originated_by_user_id = ?)"
        : "";

    const sales = await query<PendingSaleRow>(
      `SELECT s.id, s.user_id, u.name AS user_name, s.status, s.total_amount,
              s.customer_name, s.customer_phone, s.created_at, s.updated_at,
              du.name AS discarded_by_name,
              s.originated_by_user_id, ou.name AS originated_by_name
       FROM sales s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users ou ON ou.id = s.originated_by_user_id
       LEFT JOIN users du ON du.id = s.voided_by
       WHERE s.business_id = ? AND s.status IN (${placeholders})
       ${deptStaffFilter}
       ORDER BY s.updated_at DESC`,
      !canViewAll && !isCashier
        ? [auth.businessId, ...statuses, auth.userId, auth.userId]
        : [auth.businessId, ...statuses],
    );

    const saleIds = sales.map((s) => s.id);
    let items: PendingItemRow[] = [];

    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => "?").join(",");
      items = await query<PendingItemRow>(
        `SELECT si.id, si.sale_id, si.item_id, i.name, si.quantity_sold,
                si.sell_price_per_unit, si.inventory_batch_id, ib.batch_number
         FROM sale_items si
         JOIN items i ON i.id = si.item_id
         LEFT JOIN inventory_batches ib ON ib.id = si.inventory_batch_id
         WHERE si.sale_id IN (${placeholders})`,
        saleIds,
      );
    }

    const itemsBySale = new Map<string, PendingItemRow[]>();
    for (const item of items) {
      const list = itemsBySale.get(item.sale_id) || [];
      list.push(item);
      itemsBySale.set(item.sale_id, list);
    }

    const data = sales.map((s) => ({
      ...s,
      items: itemsBySale.get(s.id) || [],
    }));

    return jsonResponse({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching pending sales:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch pending sales",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
