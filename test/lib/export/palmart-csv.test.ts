import { describe, expect, it } from "vitest";
import {
  PALMART_ITEM_HEADERS,
  buildItemsCsv,
  buildOpeningStockCsv,
  buildSuppliersCsv,
  mapItemTypeKey,
} from "../../../lib/export/palmart-csv";

describe("palmart-csv", () => {
  it("items CSV header matches Palmart template (no BOM)", () => {
    const { csv, rowCount } = buildItemsCsv(
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Sunlight Powder",
          variant_name: "500gm",
          parent_item_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          product_code: null,
          barcode: "161109724090",
          unit_type: "piece",
          item_type: "retail",
          current_stock: 1,
          min_stock_level: 5,
          current_sell_price: 200,
          active: 1,
        },
      ],
      new Set(),
    );

    expect(csv.startsWith("\uFEFF")).toBe(false);
    const header = csv.split("\n")[0];
    expect(header).toBe(PALMART_ITEM_HEADERS.join(","));
    expect(header).toBe(
      "sku,name,item_type_key,barcode,unit_type,is_stocked,is_sellable,selling_price,reorder_level",
    );
    expect(rowCount).toBe(1);
    expect(csv).toContain("IMP-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(csv).not.toContain("161109724090"); // barcodes omitted by default
    expect(csv).toContain("goods");
    expect(csv).toContain("true,true,200,5");
  });

  it("includes barcodes when opted in", () => {
    const { csv } = buildItemsCsv(
      [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Soap",
          variant_name: null,
          parent_item_id: null,
          product_code: null,
          barcode: "6201100033736",
          unit_type: "piece",
          item_type: "retail",
          current_stock: 1,
          min_stock_level: null,
          current_sell_price: 50,
          active: 1,
        },
      ],
      new Set(),
      { includeBarcodes: true },
    );
    expect(csv).toContain("6201100033736");
  });

  it("skips parent group shells", () => {
    const parentId = "parent-1";
    const { rowCount, csv } = buildItemsCsv(
      [
        {
          id: parentId,
          name: "Parent Only",
          variant_name: null,
          parent_item_id: null,
          product_code: "PAR",
          barcode: null,
          unit_type: "piece",
          item_type: "grocery",
          current_stock: 0,
          min_stock_level: null,
          current_sell_price: 0,
          active: 1,
        },
        {
          id: "child-1",
          name: "Parent Only",
          variant_name: "Small",
          parent_item_id: parentId,
          product_code: null,
          barcode: null,
          unit_type: "piece",
          item_type: "grocery",
          current_stock: 3,
          min_stock_level: 1,
          current_sell_price: 50,
          active: 1,
        },
      ],
      new Set([parentId]),
    );
    expect(rowCount).toBe(1);
    expect(csv).toContain("IMP-child-1");
    expect(csv).not.toContain("Parent Only,goods,,,piece");
  });

  it("maps retail-like types to goods", () => {
    expect(mapItemTypeKey("retail")).toBe("goods");
    expect(mapItemTypeKey("grocery")).toBe("goods");
    expect(mapItemTypeKey("")).toBe("goods");
  });

  it("suppliers and opening stock headers match templates", () => {
    const suppliers = buildSuppliersCsv([
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Acme Distributors",
        notes: "Weekly",
        supplier_type: "distributor",
        active: 1,
      },
    ]);
    expect(suppliers.csv.split("\n")[0]).toBe(
      "name,code,supplier_type,vat_pin,status,notes",
    );

    const itemId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const items = buildItemsCsv(
      [
        {
          id: itemId,
          name: "Milk",
          variant_name: null,
          parent_item_id: null,
          product_code: "MLK",
          barcode: null,
          unit_type: "litre",
          item_type: "grocery",
          current_stock: 10,
          min_stock_level: null,
          current_sell_price: 80,
          active: 1,
        },
      ],
      new Set(),
    );
    // Short product codes are not used as SKU (collide easily) → IMP-{id}
    expect(items.skuByItemId.get(itemId)).toBe(`IMP-${itemId}`);
    const opening = buildOpeningStockCsv("Main", items.skuByItemId, [
      { itemId, quantity: 10, unitCost: 60, sellPrice: 80 },
    ]);
    expect(opening.csv.split("\n")[0]).toBe(
      "branch_name,sku,quantity,unit_cost,notes",
    );
    expect(opening.csv).toContain(`Main,IMP-${itemId},10,60,`);
  });
});
