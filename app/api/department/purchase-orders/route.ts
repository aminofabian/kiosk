import { NextRequest } from "next/server";
import { query, execute, queryOne, transaction } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import {
  getStaffDepartmentKeys,
} from "@/lib/department/purchase-order-access";
import {
  validatePOLines,
} from "@/lib/department/po-validation";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/department/purchase-orders
 * Staff: list POs for their assigned department keys.
 */
export async function GET(request: NextRequest) {
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

    const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
    if (deptKeys.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }

    const statusFilter = request.nextUrl.searchParams.get("status");
    const deptPlaceholders = deptKeys.map(() => "?").join(",");

    let sql = `SELECT p.*,
                      s.name AS supplier_name,
                      (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count
               FROM purchases p
               LEFT JOIN suppliers s ON s.id = p.supplier_id
               WHERE p.business_id = ?
                 AND p.department IN (${deptPlaceholders})
                 AND p.approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')`;
    const params: (string | number)[] = [auth.businessId, ...deptKeys];

    if (statusFilter) {
      sql += ` AND p.approval_status = ?`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY p.created_at DESC LIMIT 100`;

    const rows = await query<any>(sql, params);

    return jsonResponse({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch purchase orders" },
      500,
    );
  }
}

/**
 * POST /api/department/purchase-orders
 * Staff: create a draft PO against an assigned supplier.
 * Body: { supplierId, department, lines: [{ itemId, qtyOrdered, unitCostEstimated }], notes }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { supplierId, department, lines, notes } = body;

    if (!supplierId || !lines || !Array.isArray(lines) || lines.length === 0) {
      return jsonResponse(
        {
          success: false,
          message: "supplierId and at least one line are required",
        },
        400,
      );
    }

    const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
    if (deptKeys.length === 0) {
      return jsonResponse(
        { success: false, message: "No departments assigned" },
        403,
      );
    }

    const deptKey = department || deptKeys[0];
    if (!deptKeys.includes(deptKey)) {
      return jsonResponse(
        { success: false, message: "Invalid department key" },
        400,
      );
    }

    const assigned = await queryOne<{ id: string }>(
      `SELECT ds.id FROM department_suppliers ds
       WHERE ds.business_id = ? AND ds.supplier_id = ? AND ds.department_key = ?
       LIMIT 1`,
      [auth.businessId, supplierId, deptKey],
    );
    if (!assigned) {
      return jsonResponse(
        {
          success: false,
          message: "Supplier is not assigned to this department",
        },
        403,
      );
    }

    const lineValidation = await validatePOLines(
      auth.businessId,
      deptKey,
      lines,
    );
    if (!lineValidation.ok) {
      return jsonResponse(
        { success: false, message: lineValidation.message },
        400,
      );
    }

    const totalAmount = lineValidation.lines.reduce(
      (sum, l) => sum + l.qtyOrdered * l.unitCostEstimated,
      0,
    );

    const now = Math.floor(Date.now() / 1000);
    const purchaseId = generateUUID();

    await transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO purchases (
          id, business_id, recorded_by, supplier_id, purchase_date,
          total_amount, notes, status, approval_status, department, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          auth.businessId,
          auth.userId,
          supplierId,
          now,
          totalAmount,
          notes || null,
          "pending",
          "draft",
          deptKey,
          now,
          now,
        ],
      );

      for (const line of lineValidation.lines) {
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
    });

    return jsonResponse({
      success: true,
      data: { purchaseId, approvalStatus: "draft" },
    });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to create purchase order" },
      500,
    );
  }
}
