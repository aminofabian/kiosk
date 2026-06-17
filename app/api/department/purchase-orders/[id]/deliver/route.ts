import { NextRequest } from "next/server";
import { queryOne, transaction } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { generateUUID } from "@/lib/utils/uuid";
import { generateBatchNumber } from "@/lib/utils/batch-number";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import { recordBuyingPrice } from "@/lib/db/buying-prices";
import {
  getStaffDepartmentKeys,
  staffCanDeliverPO,
} from "@/lib/department/purchase-order-access";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/department/purchase-orders/[id]/deliver
 * Staff: record delivery against an approved PO.
 * Body: { lines: [{ purchaseItemId, itemId, usableQuantity, wastageQuantity?, buyPricePerUnit, notes? }] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== "department_staff") {
      return jsonResponse(
        { success: false, message: "Department staff only" },
        403,
      );
    }

    const { id: purchaseId } = await params;
    const body = await request.json();
    const lines = body.lines;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return jsonResponse(
        { success: false, message: "At least one delivery line is required" },
        400,
      );
    }

    const po = await queryOne<{
      id: string;
      recorded_by: string;
      approval_status: string;
      supplier_id: string | null;
      department: string | null;
    }>(
      `SELECT id, recorded_by, approval_status, supplier_id, department
       FROM purchases WHERE id = ? AND business_id = ?`,
      [purchaseId, auth.businessId],
    );

    if (!po) {
      return jsonResponse(
        { success: false, message: "Purchase order not found" },
        404,
      );
    }

    const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
    if (!staffCanDeliverPO(po, deptKeys)) {
      return jsonResponse({ success: false, message: "Access denied" }, 403);
    }

    if (po.approval_status !== "approved") {
      return jsonResponse(
        { success: false, message: "Only approved POs can receive deliveries" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);

    for (const line of lines) {
      const {
        purchaseItemId,
        itemId,
        usableQuantity,
        buyPricePerUnit,
      } = line;

      if (!purchaseItemId || !itemId || !usableQuantity || !buyPricePerUnit) {
        return jsonResponse(
          {
            success: false,
            message:
              "Each line requires purchaseItemId, itemId, usableQuantity, buyPricePerUnit",
          },
          400,
        );
      }

      const pi = await queryOne<{ id: string; status: string }>(
        `SELECT id, status FROM purchase_items
         WHERE id = ? AND purchase_id = ?`,
        [purchaseItemId, purchaseId],
      );
      if (!pi) {
        return jsonResponse(
          {
            success: false,
            message: `Purchase item ${purchaseItemId} not found on this PO`,
          },
          404,
        );
      }
      if (pi.status === "broken_down") {
        return jsonResponse(
          {
            success: false,
            message: `Purchase item ${purchaseItemId} already delivered`,
          },
          400,
        );
      }
    }

    const buyingPriceRecords: Array<{
      itemId: string;
      price: number;
      notes: string;
    }> = [];

    const newStatus = await transaction(async (tx) => {
      for (const line of lines) {
        const {
          purchaseItemId,
          itemId,
          usableQuantity,
          wastageQuantity,
          buyPricePerUnit,
          notes: lineNotes,
        } = line;

        const breakdownId = generateUUID();
        const batchId = generateUUID();
        const batchNumber = await generateBatchNumber(
          itemId,
          auth.businessId,
          now,
        );

        await tx.execute(
          `INSERT INTO purchase_breakdowns (
            id, purchase_item_id, item_id, usable_quantity, wastage_quantity,
            buy_price_per_unit, notes, confirmed_by, confirmed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            breakdownId,
            purchaseItemId,
            itemId,
            usableQuantity,
            wastageQuantity || 0,
            buyPricePerUnit,
            lineNotes || null,
            auth.userId,
            now,
          ],
        );

        await tx.execute(
          `INSERT INTO inventory_batches (
            id, business_id, item_id, source_breakdown_id, batch_number, status,
            supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
            received_at, created_at
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
          [
            batchId,
            auth.businessId,
            itemId,
            breakdownId,
            batchNumber,
            po.supplier_id,
            usableQuantity,
            usableQuantity,
            buyPricePerUnit,
            now,
            now,
          ],
        );

        await tx.execute(
          `UPDATE items SET current_stock = current_stock + ? WHERE id = ? AND business_id = ?`,
          [usableQuantity, itemId, auth.businessId],
        );

        buyingPriceRecords.push({
          itemId,
          price: buyPricePerUnit,
          notes: lineNotes
            ? `Department delivery: ${lineNotes}`
            : "Department delivery",
        });

        if (wastageQuantity && wastageQuantity > 0) {
          const currentItem = await tx.queryOne<{ current_stock: number }>(
            `SELECT current_stock FROM items WHERE id = ? AND business_id = ?`,
            [itemId, auth.businessId],
          );
          if (currentItem) {
            const systemStock = currentItem.current_stock;
            const actualStock = systemStock - wastageQuantity;
            await tx.execute(
              `INSERT INTO stock_adjustments (
                id, business_id, item_id, system_stock, actual_stock,
                difference, reason, notes, adjusted_by, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                generateUUID(),
                auth.businessId,
                itemId,
                systemStock,
                actualStock,
                -wastageQuantity,
                "spoilage",
                lineNotes
                  ? `Wastage from delivery: ${lineNotes}`
                  : "Wastage from delivery",
                auth.userId,
                now,
              ],
            );
            await tx.execute(
              `UPDATE items SET current_stock = ? WHERE id = ? AND business_id = ?`,
              [actualStock, itemId, auth.businessId],
            );
          }
        }

        await tx.execute(
          `UPDATE purchase_items
           SET status = 'broken_down', item_id = COALESCE(item_id, ?),
               qty_received = qty_received + ?
           WHERE id = ?`,
          [itemId, usableQuantity, purchaseItemId],
        );
      }

      const pendingCount = await tx.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM purchase_items
         WHERE purchase_id = ? AND status = 'pending'`,
        [purchaseId],
      );

      const currentStatus = await tx.queryOne<{ status: string }>(
        `SELECT status FROM purchases WHERE id = ?`,
        [purchaseId],
      );
      let status = currentStatus?.status || "pending";
      if (pendingCount && pendingCount.count === 0) {
        status = "complete";
      } else if (status === "pending") {
        status = "partial";
      }

      await tx.execute(
        `UPDATE purchases SET status = ?, updated_at = ? WHERE id = ?`,
        [status, now, purchaseId],
      );

      return status;
    });

    for (const record of buyingPriceRecords) {
      await recordBuyingPrice({
        itemId: record.itemId,
        supplierId: po.supplier_id,
        price: record.price,
        setBy: auth.userId,
        notes: record.notes,
      });
    }

    logActivity({
      businessId: auth.businessId,
      action: "update",
      entityType: "purchase",
      entityId: purchaseId,
      entityNameSnapshot: `PO ${purchaseId.slice(0, 8)}`,
      details: {
        lineCount: lines.length,
        purchaseStatus: newStatus,
        deliveredBy: auth.userId,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      data: { purchaseId, purchaseStatus: newStatus },
    });
  } catch (error) {
    console.error("Error recording delivery:", error);
    return jsonResponse(
      { success: false, message: "Failed to record delivery" },
      500,
    );
  }
}
