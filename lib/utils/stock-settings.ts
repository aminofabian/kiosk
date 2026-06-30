/** Stock-related flags stored in businesses.settings JSON under `stock`. */
export interface StockSettings {
  /** When true, cashiers may sell items with zero or insufficient stock without manager PIN. */
  allowSellOutOfStock?: boolean;
  /**
   * When false (default true), department_staff cannot directly edit stock qty
   * on /department/stock. Loss write-offs (Records → Losses) are always allowed.
   */
  allowDepartmentStaffStockEdit?: boolean;
}

const DEFAULT_ALLOW_DEPARTMENT_STAFF_STOCK_EDIT = true;

function parseStockNamespace(
  settingsJson: string | null | undefined,
): StockSettings {
  if (!settingsJson) return {};
  try {
    const parsed = JSON.parse(settingsJson) as Record<string, unknown>;
    const stock = parsed.stock;
    if (stock && typeof stock === "object") {
      return stock as StockSettings;
    }
    return {};
  } catch {
    return {};
  }
}

export function parseAllowSellOutOfStock(settingsJson: string | null | undefined): boolean {
  return parseStockNamespace(settingsJson).allowSellOutOfStock === true;
}

export function parseAllowDepartmentStaffStockEdit(
  settingsJson: string | null | undefined,
): boolean {
  const value = parseStockNamespace(settingsJson).allowDepartmentStaffStockEdit;
  return value === undefined
    ? DEFAULT_ALLOW_DEPARTMENT_STAFF_STOCK_EDIT
    : value === true;
}

function mergeStockSettings(
  settingsJson: string | null,
  patch: Partial<StockSettings>,
): string {
  let obj: Record<string, unknown> = {};
  if (settingsJson) {
    try {
      obj = JSON.parse(settingsJson) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  const stock =
    obj.stock && typeof obj.stock === "object"
      ? { ...(obj.stock as Record<string, unknown>) }
      : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      stock[key] = value;
    }
  }
  obj.stock = stock;
  return JSON.stringify(obj);
}

export function mergeSettingsAllowSellOutOfStock(
  settingsJson: string | null,
  allowSellOutOfStock: boolean
): string {
  return mergeStockSettings(settingsJson, { allowSellOutOfStock });
}

export function mergeSettingsAllowDepartmentStaffStockEdit(
  settingsJson: string | null,
  allowDepartmentStaffStockEdit: boolean,
): string {
  return mergeStockSettings(settingsJson, { allowDepartmentStaffStockEdit });
}
