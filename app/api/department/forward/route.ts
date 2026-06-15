import { NextRequest } from "next/server";
import { query, transaction } from "@/lib/db";
import { migratePendingSales } from "@/lib/db/migrate-pending-sales";
import { migrateDepartmentStaffRole } from "@/lib/db/migrate-department-staff-role";
import { migrateOriginatedBy } from "@/lib/db/migrate-originated-by";
import { migrateUserDepartment } from "@/lib/db/migrate-user-department";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";

interface ForwardItemInput {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  inventoryBatchId?: string;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * POST /api/department/forward
 *
 * Department staff forwards items to a cashier.
 * Creates a pending sale with originated_by_user_id set to the staff member.
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
    const items: ForwardItemInput[] = Array.isArray(body.items)
      ? body.items
      : [];

    if (items.length === 0) {
      return jsonResponse(
        { success: false, message: "Order must contain at least one item" },
        400,
      );
    }

    // Validate items
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
      const saleId = generateUUID();
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
          auth.userId,
          now,
          now,
          now,
        ],
      );

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

    // Log department request for audit
    logActivity({
      businessId: auth.businessId,
      action: "create",
      entityType: "department_request",
      entityId: pendingSaleId,
      entityNameSnapshot:
        body.customerName || `Order ${pendingSaleId.slice(0, 8)}`,
      details: {
        itemCount: items.length,
        totalAmount,
        forwarded: true,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: "Order forwarded to cashier",
      data: {
        pendingSaleId,
        totalAmount,
        itemCount: items.length,
      },
    });
  } catch (error) {
    console.error("Error forwarding order:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to forward order",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
