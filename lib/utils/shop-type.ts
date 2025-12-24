export type ShopType = 'grocery' | 'retail';

const SHOP_TYPE_STORAGE_KEY = 'pos-shop-type';

export function getShopType(): ShopType {
  if (typeof window === 'undefined') return 'grocery';
  
  const stored = localStorage.getItem(SHOP_TYPE_STORAGE_KEY);
  return (stored === 'grocery' || stored === 'retail') ? stored : 'grocery';
}

export function setShopType(shopType: ShopType): void {
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

export function getCategoryShopType(categoryName: string): ShopType | null {
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

export function shouldShowCategory(categoryName: string, shopType: ShopType): boolean {
  const categoryShopType = getCategoryShopType(categoryName);
  
  if (categoryShopType === null) {
    return true;
  }
  
  return categoryShopType === shopType;
}

