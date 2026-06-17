import { NextRequest } from "next/server";
import { execute, query, queryOne, transaction } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { validateDepartmentKey } from "@/lib/department/po-validation";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/admin/department-suppliers
 * List all department ↔ supplier assignments for the business.
 */
export async function GET(request: NextRequest) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requirePermission("view_all_sales");
    if (isAuthResponse(auth)) return auth;

    const rows = await query<{
      id: string;
      department_key: string;
      supplier_id: string;
      supplier_name: string;
      assigned_by_name: string;
      created_at: number;
    }>(
      `SELECT ds.id, ds.department_key, ds.supplier_id,
              s.name AS supplier_name,
              u.name AS assigned_by_name,
              ds.created_at
       FROM department_suppliers ds
       JOIN suppliers s ON s.id = ds.supplier_id
       JOIN users u ON u.id = ds.assigned_by
       WHERE ds.business_id = ?
       ORDER BY ds.department_key, s.name`,
      [auth.businessId],
    );

    return jsonResponse({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching department suppliers:", error);
    return jsonResponse(
      { success: false, message: "Failed to fetch assignments" },
      500,
    );
  }
}

/**
 * POST /api/admin/department-suppliers
 * Assign a supplier to a department key.
 * Body: { departmentKey: string, supplierId: string }
 */
export async function POST(request: NextRequest) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requirePermission("view_all_sales");
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const departmentKey = (body.departmentKey || "").trim();
    const supplierId = (body.supplierId || "").trim();

    if (!departmentKey || !supplierId) {
      return jsonResponse(
        { success: false, message: "departmentKey and supplierId are required" },
        400,
      );
    }

    // Verify supplier belongs to business
    const supplier = await queryOne<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = ? AND business_id = ?`,
      [supplierId, auth.businessId],
    );
    if (!supplier) {
      return jsonResponse(
        { success: false, message: "Supplier not found" },
        404,
      );
    }

    const validDept = await validateDepartmentKey(auth.businessId, departmentKey);
    if (!validDept) {
      return jsonResponse(
        { success: false, message: "Invalid department key" },
        400,
      );
    }

    const id = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await execute(
      `INSERT INTO department_suppliers (id, business_id, department_key, supplier_id, assigned_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, auth.businessId, departmentKey, supplierId, auth.userId, now],
    );

    return jsonResponse({
      success: true,
      data: { id, departmentKey, supplierId },
    });
  } catch (error) {
    // UNIQUE constraint violation
    if (
      error instanceof Error &&
      (error.message.includes("UNIQUE") || error.message.includes("unique"))
    ) {
      return jsonResponse(
        {
          success: false,
          message: "This supplier is already assigned to that department",
        },
        409,
      );
    }
    console.error("Error assigning department supplier:", error);
    return jsonResponse(
      { success: false, message: "Failed to assign supplier" },
      500,
    );
  }
}

/**
 * DELETE /api/admin/department-suppliers?id=xxx
 * Remove a department ↔ supplier assignment.
 */
export async function DELETE(request: NextRequest) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requirePermission("view_all_sales");
    if (isAuthResponse(auth)) return auth;

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return jsonResponse(
        { success: false, message: "Assignment id is required" },
        400,
      );
    }

    const result = await execute(
      `DELETE FROM department_suppliers WHERE id = ? AND business_id = ?`,
      [id, auth.businessId],
    );

    if (result.rowsAffected === 0) {
      return jsonResponse(
        { success: false, message: "Assignment not found" },
        404,
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error removing department supplier:", error);
    return jsonResponse(
      { success: false, message: "Failed to remove assignment" },
      500,
    );
  }
}
