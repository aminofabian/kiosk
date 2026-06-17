import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { migratePendingSales } from "@/lib/db/migrate-pending-sales";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { hasPermission } from "@/lib/auth/permissions";
import { canAccessOthersPendingSale } from "@/lib/pos/pending-sale-access";
import { PENDING_SALE_PAYMENT_METHOD } from "@/lib/constants";

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * DELETE /api/sales/[id]/pending
 * Abandon a pending sale. Cashiers can only abandon their own pending sales;
 * admin/owner can abandon any pending sale in the business.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await migratePendingSales();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: saleId } = await params;
    const canViewAll = hasPermission(auth.role, "view_all_sales");

    const existing = await queryOne<{
      id: string;
      user_id: string;
      status: string;
    }>(
      `SELECT id, user_id, status FROM sales
       WHERE id = ? AND business_id = ?`,
      [saleId, auth.businessId],
    );

    if (!existing) {
      return jsonResponse(
        { success: false, message: "Pending sale not found" },
        404,
      );
    }

    if (existing.status !== "pending") {
      return jsonResponse(
        { success: false, message: "Sale is not pending" },
        400,
      );
    }

    if (!canViewAll && existing.user_id !== auth.userId) {
      const canDiscard = await canAccessOthersPendingSale(
        auth.role,
        auth.userId,
        existing.user_id,
      );
      if (!canDiscard) {
        return jsonResponse(
          {
            success: false,
            message: "Cannot abandon another cashier pending sale",
          },
          403,
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);
    await execute(
      `UPDATE sales
       SET status = 'discarded', payment_method = ?, voided_reason = ?, voided_by = ?, updated_at = ?
       WHERE id = ?`,
      [
        PENDING_SALE_PAYMENT_METHOD,
        "Cart discarded",
        auth.userId,
        now,
        saleId,
      ],
    );

    return jsonResponse({
      success: true,
      message: "Pending sale discarded",
    });
  } catch (error) {
    console.error("Error abandoning pending sale:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to abandon pending sale",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
