import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { migrateLoadedByColumns } from "@/lib/db/migrate-loaded-by";
import { jsonResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { eventBus } from "@/lib/sse/event-bus";

/**
 * POST /api/department/loaded
 *
 * Called when a cashier loads a pending sale into their POS cart.
 * Stores loaded_by metadata and emits an SSE event to notify department staff.
 */
export async function POST(request: NextRequest) {
  try {
    await migrateLoadedByColumns();

    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { pendingSaleId } = body;

    if (!pendingSaleId) {
      return jsonResponse(
        { success: false, message: "pendingSaleId required" },
        400,
      );
    }

    // Look up the originating user
    const sale = await queryOne<{
      originated_by_user_id: string | null;
      status: string;
    }>(
      `SELECT originated_by_user_id, status FROM sales WHERE id = ? AND business_id = ?`,
      [pendingSaleId, auth.businessId],
    );

    if (!sale) {
      return jsonResponse({ success: false, message: "Sale not found" }, 404);
    }

    if (sale.status !== "pending") {
      return jsonResponse({ success: true, message: "Sale is not pending" });
    }

    // Record who loaded and when
    const now = Math.floor(Date.now() / 1000);
    await execute(
      `UPDATE sales SET loaded_by_user_id = ?, loaded_at = ?, updated_at = ?
       WHERE id = ? AND business_id = ? AND status = 'pending'`,
      [auth.userId, now, now, pendingSaleId, auth.businessId],
    );

    if (sale.originated_by_user_id) {
      try {
        eventBus.publish(`staff:${sale.originated_by_user_id}`, {
          type: "order:loaded",
          data: {
            pendingSaleId,
            cashierName: auth.name,
            cashierId: auth.userId,
          },
          timestamp: Date.now(),
        });
      } catch {
        /* non-critical */
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error tracking load:", error);
    return jsonResponse(
      { success: false, message: "Failed to track load", error: String(error) },
      500,
    );
  }
}
