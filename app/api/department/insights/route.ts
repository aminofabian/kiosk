import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Exclude parent rows that only exist to group variants. */
const SELLABLE_ITEM_SQL = `i.business_id = ?
         AND i.active = 1
         AND NOT (
           i.parent_item_id IS NULL
           AND EXISTS (
             SELECT 1 FROM items v
             WHERE v.parent_item_id = i.id AND v.business_id = i.business_id AND v.active = 1
           )
         )`;

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/department/insights
 *
 * Returns items most frequently forwarded by department staff.
 * Used for the "Quick Forward" section on the department home screen.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const daysParam = parseInt(
      request.nextUrl.searchParams.get("days") || "30",
      10,
    );
    const days = Number.isNaN(daysParam)
      ? 30
      : Math.min(Math.max(daysParam, 1), 90);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const sinceSeconds = nowSeconds - days * 24 * 60 * 60;

    // Most forwarded items by department staff
    const rawTopForwarded = await query<any>(
      `SELECT
        i.*,
        COALESCE(fwd.times_forwarded, 0) as times_forwarded
       FROM items i
       INNER JOIN (
         SELECT si.item_id, COUNT(DISTINCT s.id) as times_forwarded
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.business_id = ?
           AND s.source = 'department_forward'
           AND s.created_at >= ?
         GROUP BY si.item_id
       ) fwd ON fwd.item_id = i.id
       WHERE ${SELLABLE_ITEM_SQL.replace(/\n/g, "\n       ")}
       ORDER BY fwd.times_forwarded DESC
       LIMIT 40`,
      [auth.businessId, sinceSeconds, auth.businessId],
    );

    // Defensive: re-verify each item exists and is active
    const validIds = await query<{ id: string }>(
      "SELECT id FROM items WHERE business_id = ? AND active = 1",
      [auth.businessId],
    );
    const validSet = new Set(validIds.map((r) => r.id));
    const topForwardedItems = rawTopForwarded
      .filter((item: { id: string }) => validSet.has(item.id))
      .map((item: { times_forwarded?: number }) => ({
        ...item,
        // ItemGrid ranks/sorts by quantity_sold (same field POS insights uses)
        quantity_sold: item.times_forwarded ?? 0,
      }));

    return jsonResponse({
      success: true,
      data: {
        topForwardedItems,
      },
    });
  } catch (error) {
    console.error("Error fetching department insights:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch department insights",
      },
      500,
    );
  }
}
