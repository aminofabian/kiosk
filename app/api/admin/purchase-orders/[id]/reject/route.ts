import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { migrateDepartmentSuppliers } from "@/lib/db/migrate-department-suppliers";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requirePermission, isAuthResponse } from "@/lib/auth/api-auth";
import { eventBus } from "@/lib/sse/event-bus";
import { logActivity } from "@/lib/db/activity-log";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/admin/purchase-orders/[id]/reject
 * Admin: reject a pending purchase order with an optional reason.
 * Body: { reason?: string }
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
    const body = await request.json();
    const reason = body.reason || "Rejected by admin";

    const po = await queryOne<{
      id: string;
      recorded_by: string;
      approval_status: string;
      total_amount: number;
    }>(
      `SELECT id, recorded_by, approval_status, total_amount FROM purchases
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
        { success: false, message: "Only pending-approval orders can be rejected" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    await execute(
      `UPDATE purchases SET approval_status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`,
      [reason, now, purchaseId],
    );

    logActivity({
      businessId: auth.businessId,
      action: "reject",
      entityType: "purchase_order",
      entityId: purchaseId,
      entityNameSnapshot: `PO ${purchaseId.slice(0, 8)}`,
      details: { reason, totalAmount: po.total_amount, rejectedBy: auth.userId },
      performedBy: auth.userId,
    }).catch(() => {});

    // Notify staff
    try {
      eventBus.publish(`staff:${po.recorded_by}`, {
        type: "purchase:rejected",
        data: {
          purchaseId,
          adminName: auth.name,
          adminId: auth.userId,
          reason,
          totalAmount: po.total_amount,
        },
        timestamp: Date.now(),
      });
    } catch {
      /* non-critical */
    }

    return jsonResponse({
      success: true,
      data: { purchaseId, approvalStatus: "rejected" },
    });
  } catch (error) {
    console.error("Error rejecting purchase order:", error);
    return jsonResponse(
      { success: false, message: "Failed to reject purchase order" },
      500,
    );
  }
}
