import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireAuth, isAuthResponse } from "@/lib/auth/api-auth";
import { hasPermission } from "@/lib/auth/permissions";

interface SaleWithUser {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  sale_date: number;
  created_at: number;
  user_name: string | null;
}

interface SaleItemWithName {
  sale_id: string;
  item_name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const canViewAll = hasPermission(auth.role, "view_all_sales");

    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    const includePending = searchParams.get("includePending") === "1";

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return jsonResponse(
        { success: false, message: "Valid date (YYYY-MM-DD) is required" },
        400,
      );
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const startTs = Math.floor(
      new Date(y, m - 1, d, 0, 0, 0, 0).getTime() / 1000,
    );
    const endTs = Math.floor(
      new Date(y, m - 1, d, 23, 59, 59, 999).getTime() / 1000,
    );

    const userFilter = !canViewAll ? "AND s.user_id = ?" : "";

    let sales: SaleWithUser[];

    if (includePending) {
      const params: (string | number)[] = [
        auth.businessId,
        startTs,
        endTs,
        startTs,
        endTs,
      ];
      if (!canViewAll) params.push(auth.userId);

      sales = await query<SaleWithUser>(
        `SELECT
          s.id,
          s.total_amount,
          s.payment_method,
          s.status,
          s.sale_date,
          s.created_at,
          u.name as user_name
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.business_id = ?
           AND (
             (s.status IN ('completed', 'voided') AND s.sale_date >= ? AND s.sale_date <= ?)
             OR
             (s.status IN ('pending', 'discarded') AND s.created_at >= ? AND s.created_at <= ?)
           )
           ${userFilter}
         ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.created_at DESC`,
        params,
      );
    } else {
      const params: (string | number)[] = [
        auth.businessId,
        startTs,
        endTs,
      ];
      if (!canViewAll) params.push(auth.userId);

      sales = await query<SaleWithUser>(
        `SELECT
          s.id,
          s.total_amount,
          s.payment_method,
          s.status,
          s.sale_date,
          s.created_at,
          u.name as user_name
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.business_id = ?
           AND s.status IN ('completed', 'voided')
           AND s.sale_date >= ?
           AND s.sale_date <= ?
           ${userFilter}
         ORDER BY s.sale_date DESC, s.created_at DESC`,
        params,
      );
    }

    if (sales.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          date: dateStr,
          sales: [],
          totalAmount: 0,
          totalCount: 0,
        },
      });
    }

    const saleIds = sales.map((s) => s.id);
    const placeholders = saleIds.map(() => "?").join(",");

    const items = await query<SaleItemWithName>(
      `SELECT
        si.sale_id,
        i.name as item_name,
        si.quantity_sold,
        si.sell_price_per_unit
       FROM sale_items si
       JOIN items i ON si.item_id = i.id
       WHERE si.sale_id IN (${placeholders})
       ORDER BY si.created_at ASC`,
      saleIds,
    );

    const itemsBySaleId: Record<string, SaleItemWithName[]> = {};
    for (const item of items) {
      if (!itemsBySaleId[item.sale_id]) itemsBySaleId[item.sale_id] = [];
      itemsBySaleId[item.sale_id].push(item);
    }

    const totalCount = sales.length;
    const completedCount = sales.filter((s) => s.status === "completed").length;
    const totalAmount = sales
      .filter((s) => s.status === "completed")
      .reduce((sum, s) => sum + s.total_amount, 0);

    const salesWithItems = sales.map((s) => ({
      ...s,
      items: itemsBySaleId[s.id] || [],
    }));

    return jsonResponse({
      success: true,
      data: {
        date: dateStr,
        sales: salesWithItems,
        totalAmount,
        totalCount,
        completedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching sales by date:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to fetch transactions",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
