/** Shop type = product type key (e.g. grocery, retail, cereals). Dynamic from settings. */
export type ShopType = string;

const SHOP_TYPE_STORAGE_KEY = 'pos-shop-type';

/** Get item type from item record. */
export function getItemShopType(item: { item_type?: string | null }): string {
  return item?.item_type && typeof item.item_type === 'string' ? item.item_type : 'retail';
}

/** Get current shop type from storage. If validKeys provided, return stored only when in list else first key. */
export function getShopType(validKeys?: string[]): string {
  if (typeof window === 'undefined') return validKeys?.[0] ?? 'grocery';
  const stored = localStorage.getItem(SHOP_TYPE_STORAGE_KEY);
  if (validKeys?.length) {
    return validKeys.includes(stored ?? '') ? (stored as string) : validKeys[0];
  }
  return stored || 'grocery';
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
  const categoryShopType = getCategoryShopType(categoryName);
  
  if (categoryShopType === null) {
    return true;
  }
  
  return categoryShopType === shopType;
}

