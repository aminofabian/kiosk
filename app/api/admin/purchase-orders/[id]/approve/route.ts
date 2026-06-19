import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import { publishPurchaseApprovedEvent } from "@/lib/department/purchase-order-events";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/admin/purchase-orders/[id]/approve
 * Admin: approve a pending purchase order.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migrateDepartmentSuppliers();

    const auth = await requirePermission("view_all_sales");
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;

    const po = await queryOne<{
      id: string;
      recorded_by: string;
      approval_status: string;
      total_amount: number;
      business_id: string;
    }>(
      `SELECT id, recorded_by, approval_status, total_amount, business_id FROM purchases
       WHERE id = ? AND business_id = ?`,
      [purchaseId, auth.businessId],
    );

    if (!po) {
      return jsonResponse(
        { success: false, message: "Purchase order not found" },
        404,
      );
    }

    if (po.approval_status !== "pending_approval") {
      return jsonResponse(
        { success: false, message: "Only pending-approval orders can be approved" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    await execute(
      `UPDATE purchases SET approval_status = 'approved', updated_at = ? WHERE id = ?`,
      [now, purchaseId],
    );

    logActivity({
      businessId: auth.businessId,
      action: "approve",
      entityType: "purchase_order",
      entityId: purchaseId,
      entityNameSnapshot: `PO ${purchaseId.slice(0, 8)}`,
      details: { totalAmount: po.total_amount, approvedBy: auth.userId },
      performedBy: auth.userId,
    }).catch(() => {});

    // Notify staff (personal + business channels for live UI refresh)
    publishPurchaseApprovedEvent({
      purchaseId,
      businessId: auth.businessId,
      recordedBy: po.recorded_by,
      adminName: auth.name,
      adminId: auth.userId,
      totalAmount: po.total_amount,
    });

    return jsonResponse({
      success: true,
      data: { purchaseId, approvalStatus: "approved" },
    });
  } catch (error) {
    console.error("Error approving purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to approve purchase order" },
      500,
    );
  }
}
