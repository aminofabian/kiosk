/**
 * Build CSVs that match Palmart (kiosk.ke) Data Import templates:
 *   items → sku,name,item_type_key,barcode,unit_type,is_stocked,is_sellable,selling_price,reorder_level
 *   suppliers → name,code,supplier_type,vat_pin,status,notes
 *   opening-stock → branch_name,sku,quantity,unit_cost,notes
 */

import { getItemDisplayName } from "../utils";

export const PALMART_ITEM_HEADERS = [
  "sku",
  "name",
  "item_type_key",
  "barcode",
  "unit_type",
  "is_stocked",
  "is_sellable",
  "selling_price",
  "reorder_level",
] as const;

export const PALMART_SUPPLIER_HEADERS = [
  "name",
  "code",
  "supplier_type",
  "vat_pin",
  "status",
  "notes",
] as const;

export const PALMART_OPENING_STOCK_HEADERS = [
  "branch_name",
  "sku",
  "quantity",
  "unit_cost",
  "notes",
] as const;

/** Kiosk item_type values that Palmart maps to goods (also safe to emit as goods). */
const ITEM_TYPE_TO_GOODS = new Set([
  "retail",
  "cereals",
  "cereal",
  "grocery",
  "groceries",
  "spices",
  "spice",
  "food",
  "beverage",
  "beverages",
  "drink",
  "drinks",
  "product",
  "products",
  "merchandise",
]);

export type KioskItemRow = {
  id: string;
  name: string;
  variant_name: string | null;
  parent_item_id: string | null;
  product_code: string | null;
  barcode: string | null;
  unit_type: string;
  item_type: string;
  current_stock: number;
  min_stock_level: number | null;
  current_sell_price: number;
  active: number;
};

export type KioskSupplierRow = {
  id: string;
  name: string;
  notes: string | null;
  supplier_type: string | null;
  active: number;
};

export function mapItemTypeKey(itemType: string | null | undefined): string {
  const raw = (itemType ?? "").trim().toLowerCase();
  if (!raw) return "goods";
  if (ITEM_TYPE_TO_GOODS.has(raw)) return "goods";
  if (raw === "goods" || raw === "service" || raw === "services") return raw === "services" ? "service" : raw;
  // Unknown custom types → blank so Palmart defaults to goods
  return "";
}

/**
 * Stable unique SKU for Palmart.
 * Always use IMP-{id} so:
 * - sku is never blank
 * - we never put a barcode in the sku column (barcode stays in barcode)
 * - Palmart legacy buying-price matching understands IMP-<uuid>
 * Prefer a non-empty product_code only when it is longer than 5 chars (short codes collide).
 */
export function resolveSku(
  item: Pick<KioskItemRow, "id" | "product_code" | "barcode">,
  used: Set<string>,
): string {
  const productCode = (item.product_code ?? "").trim();
  const candidates = [
    productCode.length > 5 ? productCode : "",
    `IMP-${item.id}`,
  ].filter(Boolean);

  for (const base of candidates) {
    if (!used.has(base.toLowerCase())) {
      used.add(base.toLowerCase());
      return base;
    }
  }

  let n = 2;
  const fallback = `IMP-${item.id}`;
  while (used.has(`${fallback}-${n}`.toLowerCase())) n += 1;
  const sku = `${fallback}-${n}`;
  used.add(sku.toLowerCase());
  return sku;
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: readonly string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  // No UTF-8 BOM: Palmart's CSV reader does not strip U+FEFF, so a BOM turns the
  // first header into "\uFEFFsku" and every row fails with "sku is required".
  return `${lines.join("\n")}\n`;
}

function plainNumber(n: number, maxDecimals = 4): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Number(n.toFixed(maxDecimals));
  return String(rounded);
}

/** Sellable catalog rows only (variants + standalones; skip parent group shells). */
export function buildItemsCsv(
  items: KioskItemRow[],
  parentIdsWithChildren: Set<string>,
  opts?: { includeBarcodes?: boolean },
): { csv: string; skuByItemId: Map<string, string>; rowCount: number } {
  const includeBarcodes = opts?.includeBarcodes === true;
  const usedSkus = new Set<string>();
  const skuByItemId = new Map<string, string>();
  const rows: Array<Array<string | number | boolean | null | undefined>> = [];

  const exportable = items.filter((item) => {
    if (item.active !== 1) return false;
    // Parent group containers that only exist to hold variants
    if (!item.parent_item_id && parentIdsWithChildren.has(item.id)) return false;
    return true;
  });

  for (const item of exportable) {
    const sku = resolveSku(item, usedSkus);
    skuByItemId.set(item.id, sku);
    const name = getItemDisplayName(item.name, item.variant_name);
    const sell = item.current_sell_price > 0 ? plainNumber(item.current_sell_price, 2) : "";
    const reorder =
      item.min_stock_level != null && item.min_stock_level >= 0
        ? plainNumber(item.min_stock_level, 4)
        : "";

    rows.push([
      sku,
      name,
      mapItemTypeKey(item.item_type),
      includeBarcodes ? (item.barcode ?? "").trim() : "",
      (item.unit_type || "piece").trim(),
      "true",
      "true",
      sell,
      reorder,
    ]);
  }

  return {
    csv: rowsToCsv(PALMART_ITEM_HEADERS, rows),
    skuByItemId,
    rowCount: rows.length,
  };
}

export function buildSuppliersCsv(suppliers: KioskSupplierRow[]): { csv: string; rowCount: number } {
  const usedCodes = new Set<string>();
  const rows: Array<Array<string | number | boolean | null | undefined>> = [];

  for (const s of suppliers) {
    if (s.active !== 1) continue;
    const name = (s.name ?? "").trim();
    if (!name) continue;

    // Optional unique code — use a short stable id-based code so re-imports stay unique
    let code = s.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    if (usedCodes.has(code)) {
      code = s.id.replace(/-/g, "").slice(0, 12).toUpperCase();
    }
    usedCodes.add(code);

    rows.push([
      name,
      code,
      (s.supplier_type ?? "").trim(),
      "",
      "active",
      (s.notes ?? "").trim(),
    ]);
  }

  return { csv: rowsToCsv(PALMART_SUPPLIER_HEADERS, rows), rowCount: rows.length };
}

export type OpeningStockSourceRow = {
  itemId: string;
  quantity: number;
  unitCost: number | null;
  sellPrice: number;
};

export function buildOpeningStockCsv(
  branchName: string,
  skuByItemId: Map<string, string>,
  stockRows: OpeningStockSourceRow[],
): { csv: string; rowCount: number } {
  const branch = branchName.trim() || "Main";
  const rows: Array<Array<string | number | boolean | null | undefined>> = [];
  const seen = new Set<string>();

  for (const row of stockRows) {
    if (!(row.quantity > 0)) continue;
    const sku = skuByItemId.get(row.itemId);
    if (!sku) continue;
    const key = `${branch.toLowerCase()}::${sku.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let unitCost = row.unitCost != null && row.unitCost > 0 ? row.unitCost : null;
    if (unitCost == null && row.sellPrice > 0) {
      unitCost = Math.max(0.01, Number((row.sellPrice * 0.01).toFixed(2)));
    }
    if (unitCost == null || !(unitCost > 0)) continue;

    rows.push([
      branch,
      sku,
      plainNumber(row.quantity, 4),
      plainNumber(unitCost, 2),
      "",
    ]);
  }

  return { csv: rowsToCsv(PALMART_OPENING_STOCK_HEADERS, rows), rowCount: rows.length };
}
