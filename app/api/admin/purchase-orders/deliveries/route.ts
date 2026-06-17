import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/admin/purchase-orders/deliveries
 * Admin: review recent delivery records across all departments.
 */
export async function GET(request: NextRequest) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requirePermission("view_all_sales");
    if (isAuthResponse(auth)) return auth;

    const rows = await query<{
      breakdown_id: string;
      purchase_id: string;
      purchase_item_id: string;
      item_id: string;
      item_name: string;
      usable_quantity: number;
      wastage_quantity: number;
      buy_price_per_unit: number;
      confirmed_by: string;
      staff_name: string;
      department: string;
      supplier_name: string;
      confirmed_at: number;
    }>(
      `SELECT
         pb.id AS breakdown_id,
         p.id AS purchase_id,
         pb.purchase_item_id,
         pb.item_id,
         i.name AS item_name,
         pb.usable_quantity,
         pb.wastage_quantity,
         pb.buy_price_per_unit,
         pb.confirmed_by,
         u.name AS staff_name,
         p.department,
         s.name AS supplier_name,
         pb.confirmed_at
       FROM purchase_breakdowns pb
       JOIN purchase_items pi ON pi.id = pb.purchase_item_id
       JOIN purchases p ON p.id = pi.purchase_id
       JOIN items i ON i.id = pb.item_id
       JOIN users u ON u.id = pb.confirmed_by
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.business_id = ?
       ORDER BY pb.confirmed_at DESC
       LIMIT 200`,
      [auth.businessId],
    );

    return jsonResponse({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching delivery records:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch delivery records" },
      500,
    );
  }
}
