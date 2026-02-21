/**
 * Product type as stored in business settings (admin-configured).
 * key is used in DB (items.item_type, sale_items.item_type_snapshot) and APIs.
 */
export interface ProductTypeConfig {
  key: string;
  label: string;
  emoji: string;
  color: string;
}

export const DEFAULT_PRODUCT_TYPES: ProductTypeConfig[] = [
  { key: 'grocery', label: 'Grocery', emoji: '🥬', color: '#22c55e' },
  { key: 'retail', label: 'Retail', emoji: '🏪', color: '#3b82f6' },
];

export function parseProductTypes(settingsJson: string | null): ProductTypeConfig[] {
  if (!settingsJson) return [...DEFAULT_PRODUCT_TYPES];
  try {
    const settings = JSON.parse(settingsJson);
    const types = settings.productTypes;
    if (Array.isArray(types) && types.length > 0) {
      return types.filter(
        (t: unknown) =>
          t &&
          typeof t === 'object' &&
          typeof (t as ProductTypeConfig).key === 'string' &&
          typeof (t as ProductTypeConfig).label === 'string'
      ) as ProductTypeConfig[];
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_PRODUCT_TYPES];
}

/** Merge productTypes into existing settings JSON; preserves other keys (e.g. banners). */
export function mergeSettingsProductTypes(
  settingsJson: string | null,
  productTypes: ProductTypeConfig[]
): string {
  let obj: Record<string, unknown> = {};
  if (settingsJson) {
    try {
      obj = JSON.parse(settingsJson) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  obj.productTypes = productTypes;
  return JSON.stringify(obj);
}
