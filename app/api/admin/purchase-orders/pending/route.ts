import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/admin/purchase-orders/pending
 * Admin: list all POs awaiting approval across all departments.
 */
export async function GET(request: NextRequest) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requirePermission("view_all_sales");
    if (isAuthResponse(auth)) return auth;

    const rows = await query<{
      id: string;
      recorded_by: string;
      staff_name: string;
      supplier_id: string;
      supplier_name: string;
      department: string;
      total_amount: number;
      notes: string;
      item_count: number;
      created_at: number;
    }>(
      `SELECT p.id, p.recorded_by, u.name AS staff_name,
              p.supplier_id, s.name AS supplier_name,
              p.department, p.total_amount, p.notes,
              (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count,
              p.created_at
       FROM purchases p
       JOIN users u ON u.id = p.recorded_by
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.business_id = ?
         AND p.approval_status = 'pending_approval'
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [auth.businessId],
    );

    return jsonResponse({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching pending purchase orders:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch pending orders" },
      500,
    );
  }
}
