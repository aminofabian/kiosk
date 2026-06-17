import { NextRequest } from "next/server";
import { execute, query, queryOne, transaction } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import {
  getStaffDepartmentKeys,
  staffCanMutatePO,
  staffCanViewPO,
} from "@/lib/department/purchase-order-access";
import { validatePOLines, type NormalizedPOLine } from "@/lib/department/po-validation";

const EDITABLE_STATUSES = new Set(["draft", "rejected"]);

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/department/purchase-orders/[id]
 * Staff: fetch a single PO with its lines (scoped to assigned departments).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;

    const po = await queryOne<any>(
      `SELECT p.*, s.name AS supplier_name,
              u.name AS recorded_by_name
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       JOIN users u ON u.id = p.recorded_by
       WHERE p.id = ? AND p.business_id = ?`,
      [purchaseId, auth.businessId],
    );

    if (!po) {
      return jsonResponse(
        { success: false, message: "Purchase order not found" },
        404,
      );
    }

    if (auth.role === "department_staff") {
      const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
      if (!staffCanViewPO(po, deptKeys)) {
        return jsonResponse({ success: false, message: "Access denied" }, 403);
      }
    }

    const lines = await query<any>(
      `SELECT pi.*, i.name AS item_name, i.unit_type
       FROM purchase_items pi
       LEFT JOIN items i ON i.id = pi.item_id
       WHERE pi.purchase_id = ?
       ORDER BY pi.created_at ASC`,
      [purchaseId],
    );

    return jsonResponse({
      success: true,
      data: { ...po, lines },
    });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch purchase order" },
      500,
    );
  }
}

/**
 * PATCH /api/department/purchase-orders/[id]
 * Staff: edit a draft/rejected PO or withdraw from pending_approval → draft.
 * Body: { lines?: [...], notes?, department?, action?: 'withdraw' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;
    const body = await request.json();

    const po = await queryOne<{
      id: string;
      recorded_by: string;
      approval_status: string;
      department: string | null;
      supplier_id: string | null;
    }>(
      `SELECT id, recorded_by, approval_status, department, supplier_id FROM purchases
       WHERE id = ? AND business_id = ?`,
      [purchaseId, auth.businessId],
    );

    if (!po) {
      return jsonResponse(
        { success: false, message: "Purchase order not found" },
        404,
      );
    }

    const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
    const isAdmin = auth.role === "admin" || auth.role === "owner";

    if (!isAdmin && !staffCanMutatePO(po, auth.userId, deptKeys)) {
      return jsonResponse(
        { success: false, message: "Not your purchase order" },
        403,
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Withdraw: pending_approval → draft
    if (body.action === "withdraw") {
      if (po.approval_status !== "pending_approval") {
        return jsonResponse(
          {
            success: false,
            message: "Only pending-approval orders can be withdrawn",
          },
          400,
        );
      }
      await execute(
        `UPDATE purchases SET approval_status = 'draft', updated_at = ? WHERE id = ?`,
        [now, purchaseId],
      );
      return jsonResponse({ success: true, data: { approvalStatus: "draft" } });
    }

    if (!EDITABLE_STATUSES.has(po.approval_status)) {
      return jsonResponse(
        { success: false, message: "Only draft or rejected orders can be edited" },
        400,
      );
    }

    if (body.department !== undefined) {
      if (!deptKeys.includes(body.department)) {
        return jsonResponse(
          { success: false, message: "Invalid department key" },
          400,
        );
      }
      if (po.supplier_id) {
        const assigned = await queryOne<{ id: string }>(
          `SELECT id FROM department_suppliers
           WHERE business_id = ? AND supplier_id = ? AND department_key = ?`,
          [auth.businessId, po.supplier_id, body.department],
        );
        if (!assigned) {
          return jsonResponse(
            {
              success: false,
              message: "Supplier is not assigned to the selected department",
            },
            400,
          );
        }
      }
    }

    let normalizedLines: NormalizedPOLine[] | null = null;
    if (body.lines && Array.isArray(body.lines)) {
      const deptKey = body.department ?? po.department;
      if (!deptKey) {
        return jsonResponse(
          { success: false, message: "Department is required for line updates" },
          400,
        );
      }

      const lineValidation = await validatePOLines(
        auth.businessId,
        deptKey,
        body.lines,
      );
      if (!lineValidation.ok) {
        return jsonResponse(
          { success: false, message: lineValidation.message },
          400,
        );
      }
      normalizedLines = lineValidation.lines;
    }

    await transaction(async (tx) => {
      if (
        body.notes !== undefined ||
        body.department !== undefined ||
        po.approval_status === "rejected"
      ) {
        const updates: string[] = [];
        const values: (string | number | null)[] = [];
        if (body.notes !== undefined) {
          updates.push("notes = ?");
          values.push(body.notes);
        }
        if (body.department !== undefined) {
          updates.push("department = ?");
          values.push(body.department);
        }
        if (po.approval_status === "rejected") {
          updates.push("rejection_reason = NULL");
        }
        updates.push("updated_at = ?");
        values.push(now, purchaseId);
        await tx.execute(
          `UPDATE purchases SET ${updates.join(", ")} WHERE id = ?`,
          values,
        );
      }

      if (normalizedLines) {
        const totalAmount = normalizedLines.reduce(
          (sum, l) => sum + l.qtyOrdered * l.unitCostEstimated,
          0,
        );

        await tx.execute(
          `UPDATE purchases SET total_amount = ?, updated_at = ? WHERE id = ?`,
          [totalAmount, now, purchaseId],
        );
        await tx.execute(`DELETE FROM purchase_items WHERE purchase_id = ?`, [
          purchaseId,
        ]);

        for (const line of normalizedLines) {
          await tx.execute(
            `INSERT INTO purchase_items (
              id, purchase_id, item_id, item_name_snapshot,
              quantity_note, amount, qty_ordered, unit_cost_estimated, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              generateUUID(),
              purchaseId,
              line.itemId,
              line.itemName,
              String(line.qtyOrdered),
              line.qtyOrdered * line.unitCostEstimated,
              line.qtyOrdered,
              line.unitCostEstimated,
              "pending",
              now,
            ],
          );
        }
      }
    });

    return jsonResponse({ success: true, data: { purchaseId } });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to update purchase order" },
      500,
    );
  }
}
