'use client';

import { useState, useEffect, useRef } from 'react';
import { POSLayout } from '@/components/layouts/pos-layout';
import { CategoryList } from '@/components/pos/CategoryList';
import { ItemGrid } from '@/components/pos/ItemGrid';
import { AddToCartDialog } from '@/components/pos/AddToCartDialog';
import { VariantSelector } from '@/components/pos/VariantSelector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCartStore } from '@/lib/stores/cart-store';
import {
  Menu,
  Search,
  X,
  ShoppingCart,
  DollarSign,
  QrCode,
  Leaf,
  Apple,
  Wheat,
  Flame,
  Droplets,
  Package,
  ArrowLeft,
  Layers,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import { getItemImage } from '@/lib/utils/item-images';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { Settings } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { apiGet } from '@/lib/utils/api-client';
import { ShopTypeSelector } from '@/components/pos/ShopTypeSelector';
import { getShopType, shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';
import { storeUserRole, clearUserRole } from '@/lib/utils/user-role-storage';

const GROCERY_CATEGORY_IMAGE_MAP: Record<string, string> = {
  Vegetables: '/category/vegetables.jpeg',
  Fruits: '/category/fruits.jpeg',
  'Grains & Cereals': '/category/grains&cereals.jpg',
  Spices: '/category/spices.webp',
  Beverages: '/category/beverages.jpeg',
  Snacks: '/category/snacks.jpg',
  'Green Grocery': '/category/green-grocery.jpeg',
  Dairy: '/category/Dairy.jpeg',
  Meat: '/category/meat.jpg',
  Bakery: '/category/bakery.webp',
  'Frozen Foods': '/category/frozen-foods.jpg',
  'Canned Goods': '/category/canned-goods.jpeg',
};

const RETAIL_CATEGORY_IMAGE_MAP: Record<string, string> = {
  'Food Essentials': '/retail/food%20essentials.jpeg',
  'Beverages': '/retail/beverages.jpg',
  'Snacks & Confectionery': '/retail/Snacks-Confectionary.jpg',
  'Cleaning Products': '/retail/cleaning%20products.webp',
  'Personal Care': '/retail/beverages.jpg', // Using beverages as placeholder, can be updated later
  'Household Items': '/retail/beverages.jpg', // Using beverages as placeholder, can be updated later
  'Paper Products': '/retail/paper%20products.jpeg',
  'General Merchandise': '/retail/general%20merchandize.jpeg',
};

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  ...GROCERY_CATEGORY_IMAGE_MAP,
  ...RETAIL_CATEGORY_IMAGE_MAP,
};

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  Vegetables: <Leaf className="w-7 h-7" />,
  Fruits: <Apple className="w-7 h-7" />,
  'Grains & Cereals': <Wheat className="w-7 h-7" />,
  Spices: <Flame className="w-6 h-6" />,
  Beverages: <Droplets className="w-6 h-6" />,
  Snacks: <Package className="w-6 h-6" />,
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  Vegetables: 'text-green-700 dark:text-green-400',
  Fruits: 'text-red-600 dark:text-red-400',
  'Grains & Cereals': 'text-amber-700 dark:text-amber-400',
  Spices: 'text-orange-600 dark:text-orange-400',
  Beverages: 'text-blue-600 dark:text-blue-400',
  Snacks: 'text-purple-600 dark:text-purple-400',
};

export default function POSPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shopType, setShopType] = useState<ShopType>(() => getShopType());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { items: cartItems } = useCartStore();
  const { user } = useCurrentUser();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  
  useEffect(() => {
    if (user?.role) {
      storeUserRole(user.role);
    } else {
      clearUserRole();
    }
  }, [user?.role]);
  
  // Variant selector state
  const [selectedParentItem, setSelectedParentItem] = useState<{
    id: string;
    name: string;
    variants?: Item[];
  } | null>(null);
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const result = await apiGet<Category[]>('/api/categories');
        if (result.success) {
          setCategories(result.data ?? []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showSearch]);

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleSelectParent = (parentItem: { id: string; name: string; variants?: Item[] }) => {
    setSelectedParentItem(parentItem);
    setVariantSelectorOpen(true);
  };

  const handleVariantSelected = (variant: Item) => {
    setVariantSelectorOpen(false);
    setSelectedParentItem(null);
    setSelectedItem(variant);
    setDialogOpen(true);
  };

  const handleQuickAdd = (item: Item, quantity: number) => {
    if (item.current_stock <= 0 || quantity <= 0) return;
    if (quantity > item.current_stock) quantity = item.current_stock;

    const { addItem } = useCartStore.getState();
    addItem(
      {
        itemId: item.id,
        name: item.name,
        price: item.current_sell_price,
        unitType: item.unit_type,
      },
      quantity
    );
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value) {
      setSelectedCategoryId(null);
    }
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const getCategoryImage = (categoryName: string) => {
    if (!categoryName) return null;
    
    const normalizedName = categoryName.trim();
    
    // Direct match first
    if (CATEGORY_IMAGE_MAP[normalizedName]) {
      return CATEGORY_IMAGE_MAP[normalizedName];
    }
    
    // Try case-insensitive match
    for (const [key, value] of Object.entries(CATEGORY_IMAGE_MAP)) {
      if (key.toLowerCase() === normalizedName.toLowerCase()) {
        return value;
      }
    }
    
    const normalized = normalizedName
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
    
    const variations: Record<string, string> = {
      'vegetables': '/category/vegetables.jpeg',
      'vegetable': '/category/vegetables.jpeg',
      'fruits': '/category/fruits.jpeg',
      'fruit': '/category/fruits.jpeg',
      'grains and cereals': '/category/grains&cereals.jpg',
      'grains & cereals': '/category/grains&cereals.jpg',
      'cereals and grains': '/category/grains&cereals.jpg',
      'cereals & grains': '/category/grains&cereals.jpg',
      'grain and cereal': '/category/grains&cereals.jpg',
      'grain & cereal': '/category/grains&cereals.jpg',
      'grains&cereals': '/category/grains&cereals.jpg',
      'spices': '/category/spices.webp',
      'spice': '/category/spices.webp',
      'beverages': shopType === 'retail' ? '/retail/beverages.jpg' : '/category/beverages.jpeg',
      'beverage': shopType === 'retail' ? '/retail/beverages.jpg' : '/category/beverages.jpeg',
      'drinks': shopType === 'retail' ? '/retail/beverages.jpg' : '/category/beverages.jpeg',
      'snacks': '/category/snacks.jpg',
      'snack': '/category/snacks.jpg',
      'green grocery': '/category/green-grocery.jpeg',
      'green-grocery': '/category/green-grocery.jpeg',
      'dairy': '/category/Dairy.jpeg',
      'meat': '/category/meat.jpg',
      'bakery': '/category/bakery.webp',
      'baked goods': '/category/bakery.webp',
      'frozen foods': '/category/frozen-foods.jpg',
      'frozen food': '/category/frozen-foods.jpg',
      'frozen': '/category/frozen-foods.jpg',
      'canned goods': '/category/canned-goods.jpeg',
      'canned good': '/category/canned-goods.jpeg',
      'canned': '/category/canned-goods.jpeg',
      // Retail variations
      'food essentials': '/retail/food%20essentials.jpeg',
      'food essential': '/retail/food%20essentials.jpeg',
      'snacks & confectionery': '/retail/Snacks-Confectionary.jpg',
      'snacks and confectionery': '/retail/Snacks-Confectionary.jpg',
      'confectionery': '/retail/Snacks-Confectionary.jpg',
      'cleaning products': '/retail/cleaning%20products.webp',
      'cleaning product': '/retail/cleaning%20products.webp',
      'personal care': '/retail/beverages.jpg', // Using beverages as placeholder
      'household items': '/retail/beverages.jpg', // Using beverages as placeholder
      'household item': '/retail/beverages.jpg',
      'paper products': '/retail/paper%20products.jpeg',
      'paper product': '/retail/paper%20products.jpeg',
      'general merchandise': '/retail/general%20merchandize.jpeg',
      'general merchandize': '/retail/general%20merchandize.jpeg', // Note: filename has typo
      'merchandise': '/retail/general%20merchandize.jpeg',
      'merchandize': '/retail/general%20merchandize.jpeg',
    };
    
    if (variations[normalized]) {
      return variations[normalized];
    }
    
    for (const [key, value] of Object.entries(variations)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    
    return null;
  };

  const getCategoryIcon = (categoryName: string) => {
    return CATEGORY_ICON_MAP[categoryName] || <Package className="w-7 h-7" />;
  };

  const getCategoryColor = (categoryName: string) => {
    return CATEGORY_COLOR_MAP[categoryName] || 'text-gray-600 dark:text-gray-400';
  };

  // Show all categories in a uniform grid

  const filteredCategories = categories.filter(cat => 
    shouldShowCategory(cat.name, shopType)
  );

  const selectedCategory = selectedCategoryId
    ? filteredCategories.find((c) => c.id === selectedCategoryId)
    : null;

  const handleShopTypeChange = (newShopType: ShopType) => {
    setShopType(newShopType);
    setSelectedCategoryId(null);
  };

  interface ItemWithVariants extends Item {
    isParent?: boolean;
    variantCount?: number;
    variants?: Item[];
  }

  const [categoryItems, setCategoryItems] = useState<ItemWithVariants[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryItems([]);
      setCategorySearchQuery('');
      return;
    }

    async function fetchCategoryItems() {
      try {
        setItemsLoading(true);
        const result = await apiGet<Item[]>(`/api/items?categoryId=${selectedCategoryId}`);
        if (result.success) {
          const allItems: Item[] = result.data ?? [];
          
          // Group items: separate parents and variants
          const parentItems: ItemWithVariants[] = [];
          const variantsByParent = new Map<string, Item[]>();

          for (const item of allItems) {
            if (item.parent_item_id) {
              const variants = variantsByParent.get(item.parent_item_id) || [];
              variants.push(item);
              variantsByParent.set(item.parent_item_id, variants);
            } else {
              parentItems.push(item);
            }
          }

          // Process parent items
          const processedItems: ItemWithVariants[] = [];
          for (const item of parentItems) {
            const variants = variantsByParent.get(item.id);
            if (variants && variants.length > 0) {
              processedItems.push({
                ...item,
                isParent: true,
                variantCount: variants.length,
                variants: variants.sort((a, b) => 
                  (a.variant_name || '').localeCompare(b.variant_name || '')
                ),
              });
            } else {
              processedItems.push(item);
            }
          }

          setCategoryItems(processedItems);
        }
      } catch (err) {
        console.error('Error fetching category items:', err);
      } finally {
        setItemsLoading(false);
      }
    }

    fetchCategoryItems();
  }, [selectedCategoryId]);

  const filteredCategoryItems = categorySearchQuery
    ? categoryItems.filter((item) =>
        item.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
        item.variant_name?.toLowerCase().includes(categorySearchQuery.toLowerCase())
      )
    : categoryItems;

  const handleMobileItemClick = (item: ItemWithVariants) => {
    if (item.isParent && item.variants) {
      setSelectedParentItem({
        id: item.id,
        name: item.name,
        variants: item.variants,
      });
      setVariantSelectorOpen(true);
    } else {
      handleSelectItem(item);
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  return (
    <>
      {/* Mobile Kiosk Design */}
      <div className="md:hidden bg-[#f6f8f6] dark:bg-[#132210] text-[#101b0d] dark:text-[#f0fdf4] min-h-screen w-full overflow-hidden flex flex-col antialiased">
        <style jsx global>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {!selectedCategoryId ? (
          <>
            <header className="flex items-center justify-between p-4 pt-6 bg-[#f6f8f6] dark:bg-[#132210] sticky top-0 z-20 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <button
                  aria-label="Menu"
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                >
                  <Menu className="w-8 h-8" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <h1 className="text-xl font-extrabold tracking-tight uppercase text-[#101b0d]/80 dark:text-[#259783]/90">
                  Kiosk POS
                </h1>
                <ShopTypeSelector 
                  onShopTypeChange={handleShopTypeChange}
                  className="scale-90"
                />
              </div>
              <div className="flex items-center gap-2">
                {isOwnerOrAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center gap-2 px-4 h-12 rounded-full bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#3bd522] hover:to-[#259783] active:scale-95 transition-all shadow-lg shadow-[#259783]/40 hover:shadow-[#3bd522]/40 text-white font-bold text-sm relative overflow-hidden group"
                    aria-label="Admin"
                  >
                    <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                    <Settings className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Admin</span>
                  </Link>
                )}
                <button
                  aria-label="Search"
                  onClick={() => setShowSearch(!showSearch)}
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                >
                  <Search className="w-7 h-7" />
                </button>
                <button
                  aria-label="Logout"
                  onClick={() => signOut({ callbackUrl: '/pos/login' })}
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                  title="Logout"
                >
                  <LogOut className="w-7 h-7" />
                </button>
              </div>
            </header>

            {showSearch && (
              <div className="px-4 pb-4 bg-[#f6f8f6] dark:bg-[#132210] sticky top-[72px] z-20 border-b border-black/5 dark:border-white/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white dark:bg-[#1c2e18] rounded-full border-gray-200 dark:border-gray-700 focus:border-[#259783] focus:ring-2 focus:ring-[#259783]/20"
                  />
                  <button
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <main className="flex-1 overflow-y-auto no-scrollbar pb-32 px-4">
              {!searchQuery && (
                <>
                  <div className="flex gap-3 py-2 overflow-x-auto no-scrollbar w-full mb-4">
                    <button className="flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-[#1c2e18] border-2 border-gray-200 dark:border-gray-700 hover:border-[#259783] dark:hover:border-[#259783] shadow-sm hover:shadow-md px-6 active:scale-95 transition-all">
                      <DollarSign className="w-6 h-6 text-[#259783]" />
                      <p className="font-bold text-base whitespace-nowrap">Custom Amount</p>
                    </button>
                    <button className="flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-[#1c2e18] border-2 border-gray-200 dark:border-gray-700 hover:border-[#259783] dark:hover:border-[#259783] shadow-sm hover:shadow-md px-6 active:scale-95 transition-all">
                      <QrCode className="w-6 h-6 text-[#259783]" />
                      <p className="font-bold text-base whitespace-nowrap">Scan Barcode</p>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 auto-rows-fr">
                    {filteredCategories.map((category) => {
                      const imageUrl = getCategoryImage(category.name);
                      const icon = getCategoryIcon(category.name);
                      const color = getCategoryColor(category.name);

                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategoryId(category.id)}
                          className="group relative flex flex-col justify-between p-4 h-36 rounded-xl bg-white dark:bg-[#1c2e18] shadow-sm border-2 border-transparent hover:border-[#259783] hover:shadow-lg active:scale-[0.98] transition-all overflow-hidden text-left"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-40 group-hover:opacity-30 transition-opacity z-10 rounded-xl"></div>
                          {imageUrl && (
                            <div
                              className="absolute inset-0 bg-cover bg-center rounded-xl transition-transform duration-500 group-hover:scale-110"
                              style={{ backgroundImage: `url(${imageUrl})` }}
                            ></div>
                          )}
                          <span
                            className={`relative z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-sm ${color} shadow-sm`}
                          >
                            {icon}
                          </span>
                          <span className="relative z-20 text-white font-bold text-lg tracking-tight leading-tight drop-shadow-md">
                            {category.name}
                          </span>
                        </button>
                      );
                    })}

                    <div className="h-24 w-full col-span-2"></div>
                  </div>
                </>
              )}

              {searchQuery && (
                <div className="flex-1 overflow-auto">
                  <ItemGrid
                    categoryId={null}
                    searchQuery={searchQuery}
                    onSelectItem={handleSelectItem}
                    onSelectParent={handleSelectParent}
                    onQuickAdd={handleQuickAdd}
                    shopType={shopType}
                  />
                </div>
              )}
            </main>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between p-4 pt-6 bg-[#f6f8f6] dark:bg-[#132210] sticky top-0 z-20 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                >
                  <ArrowLeft className="w-8 h-8" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-1">
                <h1 className="text-xl font-bold text-[#101b0d] dark:text-[#f0fdf4]">
                  {selectedCategory?.name || 'Category'}
                </h1>
                <ShopTypeSelector 
                  onShopTypeChange={handleShopTypeChange}
                  className="scale-90"
                />
              </div>
              <div className="flex items-center gap-2">
                {isOwnerOrAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center gap-2 px-4 h-12 rounded-full bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#3bd522] hover:to-[#259783] active:scale-95 transition-all shadow-lg shadow-[#259783]/40 hover:shadow-[#3bd522]/40 text-white font-bold text-sm relative overflow-hidden group"
                    aria-label="Admin"
                  >
                    <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                    <Settings className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Admin</span>
                  </Link>
                )}
                <button
                  aria-label="Logout"
                  onClick={() => signOut({ callbackUrl: '/pos/login' })}
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                  title="Logout"
                >
                  <LogOut className="w-7 h-7" />
                </button>
              </div>
            </header>

            <div className="px-4 pb-4 bg-[#f6f8f6] dark:bg-[#132210] sticky top-[72px] z-20 border-b border-black/5 dark:border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={`Search ${selectedCategory?.name.toLowerCase()}...`}
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-12 bg-white dark:bg-[#1c2e18] rounded-full border-gray-200 dark:border-gray-700 focus:border-[#259783] focus:ring-2 focus:ring-[#259783]/20"
                />
              </div>
            </div>

            <main className="flex-1 overflow-y-auto no-scrollbar pb-32 px-4">
              {itemsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-10 h-10 border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
                </div>
              ) : filteredCategoryItems.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">
                    {categorySearchQuery
                      ? `No items found for "${categorySearchQuery}"`
                      : 'No items in this category'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 py-4">
                  {filteredCategoryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleMobileItemClick(item)}
                      className={`bg-[#1c2e18] dark:bg-[#132210] rounded-xl shadow-sm overflow-hidden active:scale-95 transition-transform ${
                        item.isParent ? 'ring-2 ring-purple-500' : ''
                      }`}
                    >
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                        {getItemImage(item.name) ? (
                          <img
                            src={getItemImage(item.name)!}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parentEl = target.parentElement;
                              if (parentEl) {
                                parentEl.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800"><svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        {item.isParent && (
                          <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {item.variantCount}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-sm text-left mb-2 line-clamp-2 text-white">
                          {item.name}
                        </h3>
                        {item.isParent ? (
                          <div className="text-purple-400 text-xs font-medium">
                            Tap to select variant
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="bg-[#259783] text-white font-bold text-sm px-2 py-1 rounded">
                              {formatPrice(item.current_sell_price)}
                            </span>
                            <span className="text-xs text-white/80">
                              / {item.unit_type}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </main>
          </>
        )}

        <div className="fixed bottom-6 left-0 right-0 px-4 flex flex-col items-center gap-3 z-30 pointer-events-none">
          <Link
            href="/pos/cart"
            className="pointer-events-auto shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(75,238,43,0.3)] active:scale-95 transition-all w-full max-w-md h-[72px] bg-[#259783] rounded-full flex items-center justify-between px-2 pr-6 group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-black/10 w-[56px] h-[56px] rounded-full flex items-center justify-center group-hover:bg-black/20 transition-colors">
                <ShoppingCart className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-lg leading-none">
                  Checkout
                </span>
                <span className="text-white/90 font-medium text-sm leading-tight mt-1">
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>
            <span className="text-[#101b0d] font-black text-2xl tracking-tight text-teal-50">
              KES {cartTotal.toFixed(0)}
            </span>
          </Link>
        </div>
      </div>

      {/* Desktop Original Design */}
      <div className="hidden md:block">
        <POSLayout
          header={
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-br from-[#259783] to-[#3bd522] rounded-xl flex items-center justify-center shadow-md shadow-[#259783]/30 flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-[#259783] to-[#3bd522] bg-clip-text text-transparent hidden sm:block">
                    {user?.businessName || 'POS'}
                  </h1>
                  <ShopTypeSelector 
                    onShopTypeChange={handleShopTypeChange}
                    className="hidden sm:flex"
                  />
                </div>
                {showSearch ? (
                  <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search items... (Press Esc to close)"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 pr-10 h-10 border-gray-200 focus:border-[#259783] focus:ring-[#259783]"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => {
                        setShowSearch(false);
                        setSearchQuery('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSearch(true)}
                    className="hidden sm:flex items-center gap-2 bg-white hover:bg-[#259783]/10 border-gray-200 hover:border-[#259783] transition-smooth"
                  >
                    <Search className="w-4 h-4" />
                    <span className="hidden md:inline">Search</span>
                    <kbd className="hidden lg:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {isOwnerOrAdmin && (
                  <Link href="/admin">
                    <Button
                      size="sm"
                      className="flex items-center gap-2 bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#3bd522] hover:to-[#259783] text-white font-semibold shadow-lg shadow-[#259783]/40 hover:shadow-[#3bd522]/40 transition-all relative overflow-hidden group"
                    >
                      <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                      <Settings className="w-4 h-4 relative z-10" />
                      <span className="hidden md:inline relative z-10">Admin</span>
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/pos/login' })}
                  className="hidden sm:flex bg-white hover:bg-red-50 border-gray-200 hover:border-red-300 text-gray-700 hover:text-red-600 transition-smooth"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
                <Link href="/pos/cart">
                  <Button
                    variant="outline"
                    size="touch"
                    className="relative bg-white hover:bg-[#259783]/10 border-gray-200 hover:border-[#259783] transition-smooth shadow-sm hover:shadow-md"
                  >
                    <ShoppingCart className="mr-2" />
                    <span className="hidden sm:inline">Cart</span>
                    {cartItemCount > 0 && (
                      <>
                        <Badge
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 animate-pulse"
                        >
                          {cartItemCount}
                        </Badge>
                        <span className="hidden md:inline ml-2 font-semibold text-[#259783]">
                          KES {cartTotal.toFixed(0)}
                        </span>
                      </>
                    )}
                  </Button>
                </Link>
              </div>
            </div>
          }
        >
          <div className="flex flex-col h-full">
            {!searchQuery && (
              <div className="border-b border-gray-200 bg-white/50 backdrop-blur-sm">
                <CategoryList
                  onSelectCategory={setSelectedCategoryId}
                  selectedCategoryId={selectedCategoryId || undefined}
                  shopType={shopType}
                />
              </div>
            )}
            <div className="flex-1 overflow-auto bg-gradient-to-b from-transparent to-gray-50/50">
              <ItemGrid
                categoryId={searchQuery ? null : selectedCategoryId}
                searchQuery={searchQuery || undefined}
                onSelectItem={handleSelectItem}
                onSelectParent={handleSelectParent}
                onQuickAdd={handleQuickAdd}
                shopType={shopType}
              />
            </div>
          </div>
        </POSLayout>
      </div>

      <AddToCartDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <VariantSelector
        parentItem={selectedParentItem}
        open={variantSelectorOpen}
        onOpenChange={setVariantSelectorOpen}
        onSelectVariant={handleVariantSelected}
      />
    </>
  );
}

