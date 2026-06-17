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
 * GET /api/department/suppliers/[supplierId]/products?departmentKey=grocery
 *
 * Returns catalogue products linked to a supplier, scoped to department staff
 * and filtered to the selected department's item type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> },
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

    const { supplierId } = await params;
    const departmentKey = request.nextUrl.searchParams.get("departmentKey");

    const deptKeys = await getStaffDepartmentKeys(auth.userId, auth.businessId);
    if (deptKeys.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }

    const filterDept =
      departmentKey && deptKeys.includes(departmentKey)
        ? departmentKey
        : deptKeys[0];

    const assigned = await queryOne<{ id: string }>(
      `SELECT ds.id FROM department_suppliers ds
       WHERE ds.business_id = ? AND ds.supplier_id = ? AND ds.department_key = ?
       LIMIT 1`,
      [auth.businessId, supplierId, filterDept],
    );
    if (!assigned) {
      return jsonResponse(
        { success: false, message: "Supplier is not assigned to this department" },
        403,
      );
    }

    const products = await query<{
      item_id: string;
      item_name: string;
      variant_name: string | null;
      unit_type: string;
      default_cost_price: number | null;
      last_buy_price: number | null;
      last_updated_at: number;
    }>(
      `SELECT
        i.id AS item_id,
        i.name AS item_name,
        i.variant_name,
        i.unit_type,
        sp.default_cost_price,
        (SELECT ib.buy_price_per_unit
         FROM inventory_batches ib
         WHERE ib.item_id = i.id
         ORDER BY ib.created_at DESC
         LIMIT 1) AS last_buy_price,
        COALESCE(
          (
            SELECT MAX(ts) FROM (
              SELECT sp.created_at AS ts
              UNION ALL
              SELECT bp.effective_from AS ts
              FROM buying_prices bp
              WHERE bp.item_id = i.id AND bp.supplier_id = sp.supplier_id
              UNION ALL
              SELECT ib.received_at AS ts
              FROM inventory_batches ib
              WHERE ib.item_id = i.id AND ib.supplier_id = sp.supplier_id
            )
          ),
          sp.created_at
        ) AS last_updated_at
      FROM supplier_products sp
      JOIN items i ON sp.item_id = i.id
      WHERE sp.supplier_id = ?
        AND i.business_id = ?
        AND i.active = 1
        AND i.item_type = ?
      ORDER BY last_updated_at DESC, i.name ASC, i.variant_name ASC`,
      [supplierId, auth.businessId, filterDept],
    );

    return jsonResponse({ success: true, data: products });
  } catch (error) {
    console.error("Error fetching department supplier products:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch supplier products" },
      500,
    );
  }
}
