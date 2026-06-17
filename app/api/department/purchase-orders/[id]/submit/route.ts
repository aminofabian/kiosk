import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { eventBus } from "@/lib/sse/event-bus";
import {
  getStaffDepartmentKeys,
  staffCanMutatePO,
} from "@/lib/department/purchase-order-access";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/department/purchase-orders/[id]/submit
 * Staff: submit a draft PO for admin approval.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;

    const po = await queryOne<{
      id: string;
      recorded_by: string;
      approval_status: string;
      business_id: string;
      department: string | null;
    }>(
      `SELECT id, recorded_by, approval_status, business_id, department FROM purchases
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
    if (!staffCanMutatePO(po, auth.userId, deptKeys)) {
      return jsonResponse(
        { success: false, message: "Not your purchase order" },
        403,
      );
    }

    if (po.approval_status !== "draft" && po.approval_status !== "rejected") {
      return jsonResponse(
        { success: false, message: "Only draft or rejected orders can be submitted" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    await execute(
      `UPDATE purchases SET approval_status = 'pending_approval', rejection_reason = NULL, updated_at = ? WHERE id = ?`,
      [now, purchaseId],
    );

    // Notify admins
    try {
      eventBus.publish(`business:${po.business_id}`, {
        type: "purchase:submitted",
        data: {
          purchaseId,
          staffName: auth.name,
          staffId: auth.userId,
        },
        timestamp: Date.now(),
      });
    } catch {
      /* non-critical */
    }

    return jsonResponse({
      success: true,
      data: { purchaseId, approvalStatus: "pending_approval" },
    });
  } catch (error) {
    console.error("Error submitting purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to submit purchase order" },
      500,
    );
  }
}
