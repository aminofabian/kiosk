import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { getStaffDepartmentKeys } from "@/lib/department/purchase-order-access";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/department/purchase-orders/last?supplierId=&department=
 * Staff: most recent PO lines for a supplier + department (for reorder).
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

    const supplierId = request.nextUrl.searchParams.get("supplierId");
    const department = request.nextUrl.searchParams.get("department");

    if (!supplierId || !department) {
      return jsonResponse(
        { success: false, message: "supplierId and department are required" },
        400,
      );
    }

    const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
    if (!deptKeys.includes(department)) {
      return jsonResponse({ success: false, message: "Access denied" }, 403);
    }

    const assigned = await queryOne<{ id: string }>(
      `SELECT ds.id FROM department_suppliers ds
       WHERE ds.business_id = ? AND ds.supplier_id = ? AND ds.department_key = ?
       LIMIT 1`,
      [auth.businessId, supplierId, department],
    );
    if (!assigned) {
      return jsonResponse(
        { success: false, message: "Supplier is not assigned to this department" },
        403,
      );
    }

    const po = await queryOne<{
      id: string;
      created_at: number;
      total_amount: number;
    }>(
      `SELECT p.id, p.created_at, p.total_amount
       FROM purchases p
       WHERE p.business_id = ?
         AND p.supplier_id = ?
         AND p.department = ?
         AND p.approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [auth.businessId, supplierId, department],
    );

    if (!po) {
      return jsonResponse({ success: true, data: null });
    }

    const lines = await query<{
      item_id: string;
      qty_ordered: number | null;
      unit_cost_estimated: number | null;
    }>(
      `SELECT pi.item_id, pi.qty_ordered, pi.unit_cost_estimated
       FROM purchase_items pi
       WHERE pi.purchase_id = ?
         AND pi.item_id IS NOT NULL
         AND pi.qty_ordered IS NOT NULL
         AND pi.qty_ordered > 0
       ORDER BY pi.created_at ASC`,
      [po.id],
    );

    return jsonResponse({
      success: true,
      data: {
        purchaseId: po.id,
        createdAt: po.created_at,
        totalAmount: po.total_amount,
        lines: lines.map((line) => ({
          itemId: line.item_id,
          qtyOrdered: line.qty_ordered!,
          unitCostEstimated: line.unit_cost_estimated ?? 0,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching last purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch last purchase order" },
      500,
    );
  }
}
