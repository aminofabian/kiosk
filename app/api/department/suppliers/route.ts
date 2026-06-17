import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/department/suppliers
 *
 * Returns only suppliers assigned to the department staff's assigned type keys.
 * Staff with multiple keys get the union of suppliers across all their departments.
 */
export async function GET(request: NextRequest) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Department staff only
    if (auth.role !== "department_staff") {
      return jsonResponse(
        { success: false, message: "Department staff only" },
        403,
      );
    }

    // Get assigned department keys from the user record
    const user = await queryOne<{ department: string | null }>(
      `SELECT department FROM users WHERE id = ? AND business_id = ?`,
      [auth.userId, auth.businessId],
    );

    let departmentKeys: string[] = [];
    try {
      const parsed = JSON.parse(user?.department || "[]");
      if (Array.isArray(parsed)) departmentKeys = parsed;
    } catch {
      // use empty
    }

    if (departmentKeys.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }

    const departmentKey = request.nextUrl.searchParams.get("departmentKey");
    const filterKeys =
      departmentKey && departmentKeys.includes(departmentKey)
        ? [departmentKey]
        : departmentKeys;

    const placeholders = filterKeys.map(() => "?").join(",");

    const suppliers = await query<{
      id: string;
      name: string;
      contact_phone: string | null;
      supplier_type: string | null;
    }>(
      `SELECT DISTINCT s.id, s.name, s.contact_phone, s.supplier_type
       FROM suppliers s
       JOIN department_suppliers ds ON ds.supplier_id = s.id
       WHERE ds.business_id = ?
         AND ds.department_key IN (${placeholders})
         AND s.active = 1
       ORDER BY s.name`,
      [auth.businessId, ...filterKeys],
    );

    return jsonResponse({ success: true, data: suppliers });
  } catch (error) {
    console.error("Error fetching department suppliers:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch suppliers" },
      500,
    );
  }
}
