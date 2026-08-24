import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import {
  requirePermission,
  isAuthResponse,
} from "@/lib/auth/api-auth";
import {
  buildItemsCsv,
  buildOpeningStockCsv,
  buildSuppliersCsv,
  type KioskItemRow,
  type KioskSupplierRow,
} from "@/lib/export/palmart-csv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

type Kind = "items" | "suppliers" | "opening-stock";

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/export/palmart?kind=items|suppliers|opening-stock&branchName=Main
 *
 * Downloads CSVs shaped for Palmart (kiosk.ke) Business → Data Import.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission("manage_items");
    if (isAuthResponse(auth)) return auth;

    const kind = (request.nextUrl.searchParams.get("kind") || "items").trim() as Kind;
    const branchName =
      request.nextUrl.searchParams.get("branchName")?.trim() || "Main";
    // Default false: Palmart businesses that adopted the global catalog already own many barcodes.
    const includeBarcodes =
      request.nextUrl.searchParams.get("includeBarcodes") === "true";

    if (kind !== "items" && kind !== "suppliers" && kind !== "opening-stock") {
      return jsonResponse(
        { success: false, message: "kind must be items, suppliers, or opening-stock" },
        400,
      );
    }

    if (kind === "suppliers") {
      const suppliers = await query<KioskSupplierRow>(
        `SELECT id, name, notes, supplier_type, active
         FROM suppliers
         WHERE business_id = ? AND active = 1
         ORDER BY name ASC`,
        [auth.businessId],
      );
      const { csv } = buildSuppliersCsv(suppliers);
      return csvResponse("palmart-suppliers.csv", csv);
    }

    const items = await query<KioskItemRow>(
      `SELECT id, name, variant_name, parent_item_id, product_code, barcode,
              unit_type, item_type, current_stock, min_stock_level,
              current_sell_price, active
       FROM items
       WHERE business_id = ? AND active = 1
       ORDER BY name ASC, variant_name ASC`,
      [auth.businessId],
    );

    const parentIdsWithChildren = new Set(
      (
        await query<{ parent_item_id: string }>(
          `SELECT DISTINCT parent_item_id
           FROM items
           WHERE business_id = ? AND active = 1 AND parent_item_id IS NOT NULL`,
          [auth.businessId],
        )
      ).map((r) => r.parent_item_id),
    );

    const { csv: itemsCsv, skuByItemId } = buildItemsCsv(items, parentIdsWithChildren, {
      includeBarcodes,
    });

    if (kind === "items") {
      return csvResponse("palmart-items.csv", itemsCsv);
    }

    // opening-stock: latest buy price per item from inventory batches
    const costRows = await query<{ item_id: string; buy_price_per_unit: number }>(
      `SELECT ib.item_id, ib.buy_price_per_unit
       FROM inventory_batches ib
       INNER JOIN (
         SELECT item_id, MAX(received_at) AS max_received
         FROM inventory_batches
         WHERE business_id = ?
         GROUP BY item_id
       ) latest ON latest.item_id = ib.item_id AND latest.max_received = ib.received_at
       WHERE ib.business_id = ?`,
      [auth.businessId, auth.businessId],
    );
    const costByItem = new Map(
      costRows.map((r) => [r.item_id, r.buy_price_per_unit] as const),
    );

    const stockSource = items
      .filter((i) => i.active === 1 && i.current_stock > 0)
      .filter((i) => i.parent_item_id != null || !parentIdsWithChildren.has(i.id))
      .map((i) => ({
        itemId: i.id,
        quantity: i.current_stock,
        unitCost: costByItem.get(i.id) ?? null,
        sellPrice: i.current_sell_price,
      }));

    const { csv } = buildOpeningStockCsv(branchName, skuByItemId, stockSource);
    const safeBranch = branchName.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "Main";
    return csvResponse(`palmart-opening-stock-${safeBranch}.csv`, csv);
  } catch (error) {
    console.error("Palmart export error:", error);
    return jsonResponse(
      { success: false, message: "Failed to build Palmart export" },
      500,
    );
  }
}
