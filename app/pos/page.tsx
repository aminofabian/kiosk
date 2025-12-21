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
} from 'lucide-react';
import Link from 'next/link';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import { getItemImage } from '@/lib/utils/item-images';
import { DownloadButton } from '@/components/DownloadButton';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { Settings } from 'lucide-react';

const CATEGORY_IMAGE_MAP: Record<string, string> = {
  Vegetables: '/images/vegetables.jpeg',
  Fruits: '/images/fruits.jpeg',
  'Grains & Cereals': '/images/grains and cereals.jpeg',
  Spices: '/images/spices.jpeg',
  Beverages: '/images/beverages.jpeg',
  Snacks: '/images/snacks.jpeg',
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { items: cartItems } = useCartStore();
  const { user } = useCurrentUser();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  
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
        const response = await fetch('/api/categories');
        const result = await response.json();
        if (result.success) {
          setCategories(result.data);
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
    return CATEGORY_IMAGE_MAP[categoryName] || null;
  };

  const getCategoryIcon = (categoryName: string) => {
    return CATEGORY_ICON_MAP[categoryName] || <Package className="w-7 h-7" />;
  };

  const getCategoryColor = (categoryName: string) => {
    return CATEGORY_COLOR_MAP[categoryName] || 'text-gray-600 dark:text-gray-400';
  };

  const primaryCategories = categories.slice(0, 4);
  const secondaryCategories = categories.slice(4, 6);
  const miscCategory = categories.length > 6 ? categories[6] : null;

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null;

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
        const response = await fetch(`/api/items?categoryId=${selectedCategoryId}`);
        const result = await response.json();
        if (result.success) {
          const allItems: Item[] = result.data;
          
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
            <header className="flex items-center justify-between p-4 pt-6 bg-[#f6f8f6] dark:bg-[#132210] sticky top-0 z-20">
              <div className="flex items-center gap-2">
                <button
                  aria-label="Menu"
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                >
                  <Menu className="w-8 h-8" />
                </button>
                {isOwnerOrAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center gap-2 px-4 h-12 rounded-full bg-[#259783] hover:bg-[#3bd522] active:scale-95 transition-all shadow-lg shadow-[#259783]/30 text-white"
                    aria-label="Admin"
                  >
                    <Settings className="w-5 h-5 text-[#101b0d]" />
                    <span className="font-bold text-sm text-[#101b0d]">Admin</span>
                  </Link>
                )}
              </div>
              <h1 className="text-xl font-extrabold tracking-tight uppercase text-[#101b0d]/80 dark:text-[#259783]/90">
                Kiosk POS
              </h1>
              <button
                aria-label="Search"
                onClick={() => setShowSearch(!showSearch)}
                className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
              >
                <Search className="w-7 h-7" />
              </button>
            </header>

            {showSearch && (
              <div className="px-4 pb-4 bg-[#f6f8f6] dark:bg-[#132210] sticky top-[72px] z-20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-10 h-10 bg-white dark:bg-[#1c2e18]"
                  />
                  <button
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
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
                    <button className="flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-[#1c2e18] border border-black/5 dark:border-white/5 shadow-sm px-6 active:scale-95 transition-transform">
                      <DollarSign className="w-6 h-6 text-[#259783]" />
                      <p className="font-bold text-base whitespace-nowrap">Custom Amount</p>
                    </button>
                    <button className="flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-[#1c2e18] border border-black/5 dark:border-white/5 shadow-sm px-6 active:scale-95 transition-transform">
                      <QrCode className="w-6 h-6 text-[#259783]" />
                      <p className="font-bold text-base whitespace-nowrap">Scan Barcode</p>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                    {primaryCategories.map((category) => {
                      const imageUrl = getCategoryImage(category.name);
                      const icon = getCategoryIcon(category.name);
                      const color = getCategoryColor(category.name);

                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategoryId(category.id)}
                          className="group relative flex flex-col justify-between p-5 h-48 rounded-xl bg-white dark:bg-[#1c2e18] shadow-sm border-2 border-transparent hover:border-[#259783] active:scale-[0.98] transition-all overflow-hidden text-left"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-40 group-hover:opacity-30 transition-opacity z-10 rounded-xl"></div>
                          {imageUrl && (
                            <div
                              className="absolute inset-0 bg-cover bg-center rounded-xl transition-transform duration-500 group-hover:scale-110"
                              style={{ backgroundImage: `url(${imageUrl})` }}
                            ></div>
                          )}
                          <span
                            className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-sm ${color} shadow-sm`}
                          >
                            {icon}
                          </span>
                          <span className="relative z-20 text-white font-black text-2xl tracking-tight leading-none drop-shadow-md">
                            {category.name}
                          </span>
                        </button>
                      );
                    })}

                    {secondaryCategories.map((category) => {
                      const imageUrl = getCategoryImage(category.name);
                      const icon = getCategoryIcon(category.name);
                      const color = getCategoryColor(category.name);

                      return (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategoryId(category.id)}
                          className="group relative flex flex-col justify-between p-5 h-40 rounded-xl bg-white dark:bg-[#1c2e18] shadow-sm border-2 border-transparent hover:border-[#259783] active:scale-[0.98] transition-all overflow-hidden text-left"
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
                          <span className="relative z-20 text-white font-bold text-xl tracking-tight leading-none drop-shadow-md">
                            {category.name}
                          </span>
                        </button>
                      );
                    })}

                    {miscCategory && (
                      <button
                        onClick={() => setSelectedCategoryId(miscCategory.id)}
                        className="col-span-2 group relative flex flex-row items-center justify-between p-5 h-32 rounded-xl bg-white dark:bg-[#1c2e18] shadow-sm border-2 border-transparent hover:border-[#259783] active:scale-[0.98] transition-all overflow-hidden text-left"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-400 dark:from-gray-800 dark:to-gray-700 opacity-100 z-0 rounded-xl"></div>
                        <div
                          className="absolute inset-0 opacity-10"
                          style={{
                            backgroundImage:
                              "url('data:image/svg+xml,%3Csvg width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 20 20\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cg fill=\\'%23ffffff\\' fill-opacity=\\'1\\' fill-rule=\\'evenodd\\'%3E%3Ccircle cx=\\'3\\' cy=\\'3\\' r=\\'3\\'/%3E%3Ccircle cx=\\'13\\' cy=\\'13\\' r=\\'3\\'/%3E%3C/g%3E%3C/svg%3E')",
                          }}
                        ></div>
                        <div className="relative z-20 flex items-center gap-4">
                          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white shadow-inner">
                            <Package className="w-8 h-8" />
                          </span>
                          <div className="flex flex-col">
                            <span className="text-white font-black text-2xl tracking-tight">
                              {miscCategory.name}
                            </span>
                            <span className="text-white/80 font-medium text-sm">
                              Tap for uncategorized items
                            </span>
                          </div>
                        </div>
                        <div className="relative z-20 bg-white/20 p-2 rounded-full">
                          <span className="text-white text-2xl">›</span>
                        </div>
                      </button>
                    )}

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
                  />
                </div>
              )}
            </main>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between p-4 pt-6 bg-[#f6f8f6] dark:bg-[#132210] sticky top-0 z-20">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className="flex size-12 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform"
                >
                  <ArrowLeft className="w-8 h-8" />
                </button>
                {isOwnerOrAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center gap-2 px-4 h-12 rounded-full bg-[#259783] hover:bg-[#3bd522] active:scale-95 transition-all shadow-lg shadow-[#259783]/30 text-white"
                    aria-label="Admin"
                  >
                    <Settings className="w-5 h-5 text-[#101b0d]" />
                    <span className="font-bold text-sm text-[#101b0d]">Admin</span>
                  </Link>
                )}
              </div>
              <h1 className="text-xl font-bold text-[#101b0d] dark:text-[#f0fdf4]">
                {selectedCategory?.name || 'Category'}
              </h1>
              <div className="w-12"></div>
            </header>

            <div className="px-4 pb-4 bg-[#f6f8f6] dark:bg-[#132210] sticky top-[72px] z-20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={`Search ${selectedCategory?.name.toLowerCase()}...`}
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-10 bg-white dark:bg-[#1c2e18] rounded-full"
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
          <div className="pointer-events-auto w-full max-w-md flex justify-end">
            <DownloadButton
              size="sm"
              className="bg-white/95 backdrop-blur-sm hover:bg-white border-2 border-[#259783] text-[#259783] hover:text-[#3bd522] font-semibold shadow-lg"
            />
          </div>
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
            <span className="text-[#101b0d] font-black text-2xl tracking-tight">
              KES {cartTotal.toFixed(0)}
            </span>
          </Link>
        </div>
      </div>

      {/* Desktop Original Design */}
      <div className="hidden md:block">
        <POSLayout
          header={
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-[#259783] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-[#259783] hidden sm:block">
                  Grocery POS
                </h1>
                {isOwnerOrAdmin && (
                  <Link href="/admin">
                    <Button
                      size="sm"
                      className="hidden sm:flex items-center gap-2 bg-[#259783] hover:bg-[#3bd522] text-white font-semibold shadow-md shadow-[#259783]/30"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden md:inline">Admin</span>
                    </Button>
                  </Link>
                )}
                {showSearch ? (
                  <div className="flex-1 max-w-md relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search items... (Press Esc to close)"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-10 pr-10 h-10"
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
                    className="hidden sm:flex items-center gap-2 bg-white hover:bg-[#259783]/10 border-gray-200 hover:border-[#259783]"
                  >
                    <Search className="w-4 h-4" />
                    <span className="hidden md:inline">Search</span>
                    <kbd className="hidden lg:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <DownloadButton
                  variant="outline"
                  size="sm"
                  className="hidden lg:flex bg-white hover:bg-[#259783]/10 border-gray-200 hover:border-[#259783]"
                />
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

