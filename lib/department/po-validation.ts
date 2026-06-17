import { queryOne } from "@/lib/db";
import { parseProductTypes } from "@/lib/types/product-types";

export interface POLineInput {
  itemId?: string;
  itemName?: string;
  qtyOrdered?: number;
  unitCostEstimated?: number;
}

export interface NormalizedPOLine {
  itemId: string;
  itemName: string;
  qtyOrdered: number;
  unitCostEstimated: number;
}

export async function getBusinessItemTypeKeys(
  businessId: string,
): Promise<string[]> {
  const business = await queryOne<{ settings: string | null }>(
    `SELECT settings FROM businesses WHERE id = ?`,
    [businessId],
  );
  return parseProductTypes(business?.settings ?? null).map((t) => t.key);
}

export async function validateDepartmentKey(
  businessId: string,
  departmentKey: string,
): Promise<boolean> {
  const keys = await getBusinessItemTypeKeys(businessId);
  return keys.includes(departmentKey);
}

export async function validatePOLines(
  businessId: string,
  departmentKey: string,
  lines: POLineInput[],
): Promise<
  | { ok: true; lines: NormalizedPOLine[] }
  | { ok: false; message: string }
> {
  if (!lines.length) {
    return { ok: false, message: "At least one line is required" };
  }

  const normalized: NormalizedPOLine[] = [];

  for (const line of lines) {
    if (!line.itemId) {
      return { ok: false, message: "Each line requires a product" };
    }

    const qty = line.qtyOrdered ?? 0;
    const cost = line.unitCostEstimated ?? 0;
    if (qty <= 0 || cost <= 0) {
      return {
        ok: false,
        message: "Each line requires a positive quantity and unit cost",
      };
    }

    const item = await queryOne<{
      id: string;
      name: string;
      item_type: string;
      active: number;
    }>(
      `SELECT id, name, item_type, active FROM items
       WHERE id = ? AND business_id = ?`,
      [line.itemId, businessId],
    );

    if (!item) {
      return { ok: false, message: "One or more products were not found" };
    }
    if (item.active === 0) {
      return { ok: false, message: `${item.name} is inactive` };
    }
    if (item.item_type !== departmentKey) {
      return {
        ok: false,
        message: `${item.name} does not belong to this department`,
      };
    }

    normalized.push({
      itemId: item.id,
      itemName: item.name,
      qtyOrdered: qty,
      unitCostEstimated: cost,
    });
  }

  return { ok: true, lines: normalized };
}
