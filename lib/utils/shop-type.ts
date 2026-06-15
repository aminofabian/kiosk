/** Shop type = product type key (e.g. grocery, retail, cereals). Dynamic from settings. */
export type ShopType = string;

const SHOP_TYPE_STORAGE_KEY = 'pos-shop-type';

/** Show every department (no item_type / category-type filtering). */
export const SHOP_TYPE_ALL = 'all';

/** Get item type from item record. */
export function getItemShopType(item: { item_type?: string | null }): string {
  return item?.item_type && typeof item.item_type === 'string' ? item.item_type : 'retail';
}

/** True when the item belongs to the active shop type filter. */
export function itemMatchesShopType(item: { item_type?: string | null }, shopType: string): boolean {
  if (shopType === SHOP_TYPE_ALL) return true;
  return getItemShopType(item) === shopType;
}

/** Get current shop type from storage. `all` is always allowed; otherwise stored must be in validKeys when provided. */
export function getShopType(validKeys?: string[]): string {
  if (typeof window === 'undefined') return SHOP_TYPE_ALL;
  const stored = localStorage.getItem(SHOP_TYPE_STORAGE_KEY);
  if (stored === SHOP_TYPE_ALL) return SHOP_TYPE_ALL;
  if (validKeys?.length) {
    if (stored && validKeys.includes(stored)) return stored;
    return SHOP_TYPE_ALL;
  }
  return stored || SHOP_TYPE_ALL;
}

export function setShopType(shopType: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHOP_TYPE_STORAGE_KEY, shopType);
}

export const RETAIL_CATEGORIES = [
  'Food Essentials',
  'Beverages',
  'Snacks & Confectionery',
  'Cleaning Products',
  'Personal Care',
  'Household Items',
  'Paper Products',
  'General Merchandise',
];

export const GROCERY_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains & Cereals',
  'Spices',
  'Beverages',
  'Snacks',
  'Green Grocery',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen Foods',
  'Canned Goods',
];

const OLD_RETAIL_CATEGORIES = [
  'Sugar', 'Detergents', 'Flour', 'Tissue Paper', 'Soap', 'Cooking Oil', 'Salt', 'Tea', 'Coffee',
  'Biscuits', 'Candies', 'Soft Drinks', 'Water', 'Juice', 'Cleaning Supplies', 'Personal Care',
  'Household Items', 'Stationery', 'Batteries', 'Light Bulbs', 'Matches', 'Candles', 'Plastic Bags',
  'Toilet Paper', 'Paper Towels'
];

export function getCategoryShopType(categoryName: string): string | null {
  const normalized = categoryName.trim().toLowerCase();
  
  if (RETAIL_CATEGORIES.some(cat => cat.toLowerCase() === normalized)) {
    return 'retail';
  }
  
  if (OLD_RETAIL_CATEGORIES.some(cat => cat.toLowerCase() === normalized)) {
    return 'retail';
  }
  
  if (GROCERY_CATEGORIES.some(cat => cat.toLowerCase() === normalized)) {
    return 'grocery';
  }
  
  return null;
}

export function shouldShowCategory(categoryName: string, shopType: string): boolean {
  if (shopType === SHOP_TYPE_ALL) return true;

  const categoryShopType = getCategoryShopType(categoryName);

  if (categoryShopType === null) {
    return true;
  }

  // Hardcoded lists only distinguish retail vs grocery. Custom product types (e.g. cereals)
  // filter by item_type on items; legacy category→mode mapping would wrongly hide e.g.
  // "Grains & Cereals" (mapped to grocery) when the active type is cereals.
  if (shopType !== 'retail' && shopType !== 'grocery') {
    return true;
  }

  return categoryShopType === shopType;
}

/** Resolve active shop type for department staff scoped to assigned product types. */
export function resolveDepartmentShopType(assignedTypes: string[]): string {
  if (assignedTypes.length === 0) return SHOP_TYPE_ALL;
  if (assignedTypes.length === 1) return assignedTypes[0];
  const resolved = getShopType(assignedTypes);
  if (resolved === SHOP_TYPE_ALL || assignedTypes.includes(resolved)) return resolved;
  return SHOP_TYPE_ALL;
}

/** Category visibility for department staff — never wider than assignedTypes. */
export function categoryMatchesAssignedTypes(
  categoryName: string,
  shopType: string,
  assignedTypes: string[],
): boolean {
  if (assignedTypes.length === 0) {
    return shouldShowCategory(categoryName, shopType);
  }
  if (shopType === SHOP_TYPE_ALL) {
    return assignedTypes.some((t) => shouldShowCategory(categoryName, t));
  }
  if (!assignedTypes.includes(shopType)) return false;
  return shouldShowCategory(categoryName, shopType);
}

