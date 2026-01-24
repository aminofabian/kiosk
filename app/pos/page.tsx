'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { POSLayout } from '@/components/layouts/pos-layout';
import { CategoryList } from '@/components/pos/CategoryList';
import { ItemGrid } from '@/components/pos/ItemGrid';
import { AddToCartDialog } from '@/components/pos/AddToCartDialog';
import { VariantSelector } from '@/components/pos/VariantSelector';
import { CartView } from '@/components/pos/CartView';
import { CheckoutForm } from '@/components/pos/CheckoutForm';
import { Receipt } from '@/components/pos/Receipt';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
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
  LogOut,
  Loader2,
  Tag,
  XCircle,
  Sprout,
  GlassWater,
  Drumstick,
  Croissant,
  Snowflake,
  Box,
  Utensils,
  Candy,
  Sparkles,
  Heart,
  Home,
  FileText,
  Store,
  Pill,
  Coffee as CoffeeIcon,
  Cake,
  Shirt,
  BookOpen,
  Heart as HeartIcon,
  Home as HomeIcon,
  UtensilsCrossed,
  RefreshCw,
  Trash2,
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
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useBarcodeScanner, isValidBarcode } from '@/lib/hooks/use-barcode-scanner';

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
  // Grocery categories - all icons use consistent size w-7 h-7
  Vegetables: <Leaf className="w-7 h-7" />,
  Fruits: <Apple className="w-7 h-7" />,
  'Grains & Cereals': <Wheat className="w-7 h-7" />,
  Spices: <Flame className="w-7 h-7" />,
  Beverages: <Droplets className="w-7 h-7" />,
  Snacks: <Package className="w-7 h-7" />,
  'Green Grocery': <Sprout className="w-7 h-7" />,
  Dairy: <GlassWater className="w-7 h-7" />,
  Meat: <Drumstick className="w-7 h-7" />,
  Bakery: <Croissant className="w-7 h-7" />,
  'Frozen Foods': <Snowflake className="w-7 h-7" />,
  'Canned Goods': <Box className="w-7 h-7" />,
  // Retail categories - all icons use consistent size w-7 h-7
  'Food Essentials': <Utensils className="w-7 h-7" />,
  'Snacks & Confectionery': <Candy className="w-7 h-7" />,
  'Cleaning Products': <Sparkles className="w-7 h-7" />,
  'Personal Care': <Heart className="w-7 h-7" />,
  'Household Items': <Home className="w-7 h-7" />,
  'Paper Products': <FileText className="w-7 h-7" />,
  'General Merchandise': <Store className="w-7 h-7" />,
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  // Grocery categories
  Vegetables: 'text-green-700 dark:text-green-400',
  Fruits: 'text-red-600 dark:text-red-400',
  'Grains & Cereals': 'text-amber-700 dark:text-amber-400',
  Spices: 'text-orange-600 dark:text-orange-400',
  Beverages: 'text-blue-600 dark:text-blue-400',
  Snacks: 'text-purple-600 dark:text-purple-400',
  'Green Grocery': 'text-emerald-700 dark:text-emerald-400',
  Dairy: 'text-cyan-600 dark:text-cyan-400',
  Meat: 'text-rose-700 dark:text-rose-400',
  Bakery: 'text-yellow-700 dark:text-yellow-400',
  'Frozen Foods': 'text-sky-600 dark:text-sky-400',
  'Canned Goods': 'text-gray-700 dark:text-gray-400',
  // Retail categories
  'Food Essentials': 'text-amber-600 dark:text-amber-400',
  'Snacks & Confectionery': 'text-pink-600 dark:text-pink-400',
  'Cleaning Products': 'text-teal-600 dark:text-teal-400',
  'Personal Care': 'text-indigo-600 dark:text-indigo-400',
  'Household Items': 'text-slate-600 dark:text-slate-400',
  'Paper Products': 'text-blue-600 dark:text-blue-400',
  'General Merchandise': 'text-violet-600 dark:text-violet-400',
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
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [drawerCategoryId, setDrawerCategoryId] = useState<string | null>(null);
  const [drawerCategoryItems, setDrawerCategoryItems] = useState<ItemWithVariants[]>([]);
  const [drawerGroupedItems, setDrawerGroupedItems] = useState<GroupedItem[]>([]);
  const [drawerItemsLoading, setDrawerItemsLoading] = useState(false);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState('');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutDrawerOpen, setCheckoutDrawerOpen] = useState(false);
  const [receiptDrawerOpen, setReceiptDrawerOpen] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{ sale: any; items: any[]; splitPayments?: any[] } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearCartToast, setShowClearCartToast] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const printedReceiptIdRef = useRef<string | null>(null);
  const { items: cartItems, clearCart } = useCartStore();
  const { user } = useCurrentUser();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const canAccessAdmin = isOwnerOrAdmin || user?.role === 'cashier';
  
  // Debounced search - waits 300ms after user stops typing
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isSearchPending = searchQuery !== debouncedSearchQuery && searchQuery.length > 0;
  
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

  // Barcode scanner state
  const [barcodeScanStatus, setBarcodeScanStatus] = useState<{
    scanning: boolean;
    lastScanned: string | null;
    error: string | null;
    success: boolean;
  }>({ scanning: false, lastScanned: null, error: null, success: false });

  // Handle barcode scan from scanner or manual input
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (!barcode || barcode.length < 4) return;
    
    setBarcodeScanStatus({ scanning: true, lastScanned: barcode, error: null, success: false });
    
    try {
      const result = await apiGet<Item>(`/api/items/barcode/${encodeURIComponent(barcode)}`);
      
      if (result.success && result.data) {
        setBarcodeScanStatus({ scanning: false, lastScanned: barcode, error: null, success: true });
        // Open the item dialog
        setSelectedItem(result.data);
        setDialogOpen(true);
        // Clear search if open
        if (showSearch) {
          setSearchQuery('');
        }
        // Auto-clear success status after 2 seconds
        setTimeout(() => {
          setBarcodeScanStatus(prev => ({ ...prev, success: false }));
        }, 2000);
      } else {
        setBarcodeScanStatus({ 
          scanning: false, 
          lastScanned: barcode, 
          error: `Product not found for barcode: ${barcode}`,
          success: false 
        });
        // Auto-clear error after 3 seconds
        setTimeout(() => {
          setBarcodeScanStatus(prev => ({ ...prev, error: null }));
        }, 3000);
      }
    } catch (err) {
      console.error('Barcode scan error:', err);
      setBarcodeScanStatus({ 
        scanning: false, 
        lastScanned: barcode, 
        error: 'Failed to lookup barcode',
        success: false 
      });
      setTimeout(() => {
        setBarcodeScanStatus(prev => ({ ...prev, error: null }));
      }, 3000);
    }
  }, [showSearch]);

  // Initialize barcode scanner hook
  const { manualScan } = useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    minLength: 4,
    maxDelay: 100, // Increased to be more forgiving
  });

  // Handle search input that might be a barcode
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query && isValidBarcode(query)) {
      handleBarcodeScan(query);
    }
  }, [searchQuery, handleBarcodeScan]);

  const fetchCategories = useCallback(async () => {
    try {
      const result = await apiGet<Category[]>('/api/categories');
      if (result.success) {
        setCategories(result.data ?? []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    if (showSearch) {
      // Focus the appropriate search input based on screen size
      setTimeout(() => {
        if (window.innerWidth < 768) {
          mobileSearchInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      }, 50);
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

  const handleSelectItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  }, []);

  const handleSelectParent = useCallback((parentItem: { id: string; name: string; variants?: Item[] }) => {
    setSelectedParentItem(parentItem);
    setVariantSelectorOpen(true);
  }, []);

  const handleVariantSelected = useCallback((variant: Item) => {
    setVariantSelectorOpen(false);
    setSelectedParentItem(null);
    setSelectedItem(variant);
    setDialogOpen(true);
  }, []);

  const handleQuickAdd = useCallback((item: Item, quantity: number) => {
    if (quantity <= 0) return;

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
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (value) {
      setSelectedCategoryId(null);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
  }, []);

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleClearCart = useCallback(() => {
    if (cartItemCount === 0) return;
    setShowClearCartToast(true);
  }, [cartItemCount]);

  const confirmClearCart = useCallback(() => {
    clearCart();
    setShowClearCartToast(false);
  }, [clearCart]);

  const cancelClearCart = useCallback(() => {
    setShowClearCartToast(false);
  }, []);

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
    if (!categoryName) return <Package className="w-7 h-7" />;
    
    const normalizedName = categoryName.trim();
    const lowerName = normalizedName.toLowerCase();
    
    // Direct match first
    if (CATEGORY_ICON_MAP[normalizedName]) {
      return CATEGORY_ICON_MAP[normalizedName];
    }
    
    // Try case-insensitive match
    for (const [key, value] of Object.entries(CATEGORY_ICON_MAP)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    
    // Try normalized variations
    const normalized = lowerName
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
    
    const variations: Record<string, string> = {
      'vegetables': 'Vegetables',
      'vegetable': 'Vegetables',
      'fruits': 'Fruits',
      'fruit': 'Fruits',
      'grains and cereals': 'Grains & Cereals',
      'grains & cereals': 'Grains & Cereals',
      'cereals and grains': 'Grains & Cereals',
      'cereals & grains': 'Grains & Cereals',
      'grain and cereal': 'Grains & Cereals',
      'grain & cereal': 'Grains & Cereals',
      'grains&cereals': 'Grains & Cereals',
      'spices': 'Spices',
      'spice': 'Spices',
      'beverages': 'Beverages',
      'beverage': 'Beverages',
      'drinks': 'Beverages',
      'snacks': 'Snacks',
      'snack': 'Snacks',
      'green grocery': 'Green Grocery',
      'green-grocery': 'Green Grocery',
      'dairy': 'Dairy',
      'meat': 'Meat',
      'bakery': 'Bakery',
      'baked goods': 'Bakery',
      'frozen foods': 'Frozen Foods',
      'frozen food': 'Frozen Foods',
      'frozen': 'Frozen Foods',
      'canned goods': 'Canned Goods',
      'canned good': 'Canned Goods',
      'canned': 'Canned Goods',
      'food essentials': 'Food Essentials',
      'food essential': 'Food Essentials',
      'snacks & confectionery': 'Snacks & Confectionery',
      'snacks and confectionery': 'Snacks & Confectionery',
      'confectionery': 'Snacks & Confectionery',
      'cleaning products': 'Cleaning Products',
      'cleaning product': 'Cleaning Products',
      'personal care': 'Personal Care',
      'household items': 'Household Items',
      'household item': 'Household Items',
      'household goods': 'Household Items',
      'paper products': 'Paper Products',
      'paper product': 'Paper Products',
      'general merchandise': 'General Merchandise',
      'general merchandize': 'General Merchandise',
      'merchandise': 'General Merchandise',
      'merchandize': 'General Merchandise',
    };
    
    if (variations[normalized] && CATEGORY_ICON_MAP[variations[normalized]]) {
      return CATEGORY_ICON_MAP[variations[normalized]];
    }
    
    // Keyword-based matching for custom categories - all icons use consistent size w-7 h-7
    if (lowerName.includes('medicine') || lowerName.includes('meds') || lowerName.includes('pill') || lowerName.includes('drug')) {
      return <Pill className="w-7 h-7" />;
    }
    if (lowerName.includes('coffee') || lowerName.includes('tea')) {
      return <CoffeeIcon className="w-7 h-7" />;
    }
    if (lowerName.includes('cake') || lowerName.includes('pastry') || lowerName.includes('baked')) {
      return <Cake className="w-7 h-7" />;
    }
    if (lowerName.includes('beauty') || lowerName.includes('cosmetic') || lowerName.includes('makeup')) {
      return <HeartIcon className="w-7 h-7" />;
    }
    if (lowerName.includes('juice') || lowerName.includes('drink') || lowerName.includes('soda')) {
      return <Droplets className="w-7 h-7" />;
    }
    if (lowerName.includes('detergent') || lowerName.includes('soap') || lowerName.includes('cleaner')) {
      return <Sparkles className="w-7 h-7" />;
    }
    if (lowerName.includes('stationery') || lowerName.includes('pen') || lowerName.includes('paper') || lowerName.includes('notebook')) {
      return <BookOpen className="w-7 h-7" />;
    }
    if (lowerName.includes('match') || lowerName.includes('lighter')) {
      return <Flame className="w-7 h-7" />;
    }
    if (lowerName.includes('shoe') || lowerName.includes('polish') || lowerName.includes('suede')) {
      return <Shirt className="w-7 h-7" />;
    }
    if (lowerName.includes('lotion') || lowerName.includes('cream') || lowerName.includes('body')) {
      return <HeartIcon className="w-7 h-7" />;
    }
    if (lowerName.includes('sauce') || lowerName.includes('condiment') || lowerName.includes('ketchup') || lowerName.includes('tomato')) {
      return <UtensilsCrossed className="w-7 h-7" />;
    }
    if (lowerName.includes('flour') || lowerName.includes('wheat') || lowerName.includes('maize') || lowerName.includes('grain') || lowerName.includes('cereal') || lowerName.includes('weetabix')) {
      return <Wheat className="w-7 h-7" />;
    }
    if (lowerName.includes('oil') || lowerName.includes('cooking')) {
      return <Droplets className="w-7 h-7" />;
    }
    if (lowerName.includes('sugar') || lowerName.includes('sweet')) {
      return <Candy className="w-7 h-7" />;
    }
    if (lowerName.includes('household') || lowerName.includes('goods')) {
      return <HomeIcon className="w-7 h-7" />;
    }
    
    // Default fallback - always return an icon
    return <Package className="w-7 h-7" />;
  };

  const getCategoryColor = (categoryName: string) => {
    if (!categoryName) return 'text-gray-600 dark:text-gray-400';
    
    const normalizedName = categoryName.trim();
    
    // Direct match first
    if (CATEGORY_COLOR_MAP[normalizedName]) {
      return CATEGORY_COLOR_MAP[normalizedName];
    }
    
    // Try case-insensitive match
    for (const [key, value] of Object.entries(CATEGORY_COLOR_MAP)) {
      if (key.toLowerCase() === normalizedName.toLowerCase()) {
        return value;
      }
    }
    
    // Try normalized variations
    const normalized = normalizedName
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
    
    const variations: Record<string, string> = {
      'vegetables': 'Vegetables',
      'vegetable': 'Vegetables',
      'fruits': 'Fruits',
      'fruit': 'Fruits',
      'grains and cereals': 'Grains & Cereals',
      'grains & cereals': 'Grains & Cereals',
      'cereals and grains': 'Grains & Cereals',
      'cereals & grains': 'Grains & Cereals',
      'grain and cereal': 'Grains & Cereals',
      'grain & cereal': 'Grains & Cereals',
      'grains&cereals': 'Grains & Cereals',
      'spices': 'Spices',
      'spice': 'Spices',
      'beverages': 'Beverages',
      'beverage': 'Beverages',
      'drinks': 'Beverages',
      'snacks': 'Snacks',
      'snack': 'Snacks',
      'green grocery': 'Green Grocery',
      'green-grocery': 'Green Grocery',
      'dairy': 'Dairy',
      'meat': 'Meat',
      'bakery': 'Bakery',
      'baked goods': 'Bakery',
      'frozen foods': 'Frozen Foods',
      'frozen food': 'Frozen Foods',
      'frozen': 'Frozen Foods',
      'canned goods': 'Canned Goods',
      'canned good': 'Canned Goods',
      'canned': 'Canned Goods',
      'food essentials': 'Food Essentials',
      'food essential': 'Food Essentials',
      'snacks & confectionery': 'Snacks & Confectionery',
      'snacks and confectionery': 'Snacks & Confectionery',
      'confectionery': 'Snacks & Confectionery',
      'cleaning products': 'Cleaning Products',
      'cleaning product': 'Cleaning Products',
      'personal care': 'Personal Care',
      'household items': 'Household Items',
      'household item': 'Household Items',
      'paper products': 'Paper Products',
      'paper product': 'Paper Products',
      'general merchandise': 'General Merchandise',
      'general merchandize': 'General Merchandise',
      'merchandise': 'General Merchandise',
      'merchandize': 'General Merchandise',
    };
    
    if (variations[normalized] && CATEGORY_COLOR_MAP[variations[normalized]]) {
      return CATEGORY_COLOR_MAP[variations[normalized]];
    }
    
    return 'text-gray-600 dark:text-gray-400';
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

  // Handler to open category drawer
  const handleCategoryClick = useCallback((categoryId: string | null) => {
    if (categoryId) {
      setDrawerCategoryId(categoryId);
      setCategoryDrawerOpen(true);
    }
  }, []);

  // Fetch items for drawer category
  useEffect(() => {
    if (!drawerCategoryId || !categoryDrawerOpen) {
      setDrawerCategoryItems([]);
      setDrawerGroupedItems([]);
      return;
    }

    async function fetchDrawerCategoryItems() {
      try {
        setDrawerItemsLoading(true);
        const result = await apiGet<Item[]>(`/api/items?categoryId=${drawerCategoryId}`);
        if (result.success) {
          const allItems: Item[] = result.data ?? [];
          
          // Build parent name map and identify which items have variants
          const parentNames = new Map<string, string>();
          const parentIds = new Set<string>();
          const parentItems = new Map<string, Item>();
          
          for (const item of allItems) {
            if (!item.parent_item_id) {
              parentNames.set(item.id, item.name);
              parentItems.set(item.id, item);
            }
          }
          
          for (const item of allItems) {
            if (item.parent_item_id) {
              parentIds.add(item.parent_item_id);
            }
          }

          // Group items by parent
          const grouped: GroupedItem[] = [];
          const childrenByParent = new Map<string, Item[]>();
          const standaloneItems: Item[] = [];

          // Group children by parent
          for (const item of allItems) {
            if (item.parent_item_id) {
              if (!childrenByParent.has(item.parent_item_id)) {
                childrenByParent.set(item.parent_item_id, []);
              }
              childrenByParent.get(item.parent_item_id)!.push(item);
            } else if (!parentIds.has(item.id)) {
              // Standalone item (not a parent with children)
              standaloneItems.push(item);
            }
          }

          // Add parent groups
          for (const [parentId, children] of childrenByParent.entries()) {
            const parent = parentItems.get(parentId);
            if (parent) {
              grouped.push({
                type: 'parent',
                parent,
                children: children.sort((a, b) => 
                  (a.variant_name || a.name).localeCompare(b.variant_name || b.name)
                ),
              });
            }
          }

          // Add standalone items
          for (const item of standaloneItems) {
            grouped.push({
              type: 'standalone',
              item,
            });
          }

          // Sort grouped items: parents alphabetically, then standalone items
          grouped.sort((a, b) => {
            if (a.type === 'parent' && b.type === 'parent') {
              return (a.parent?.name || '').localeCompare(b.parent?.name || '');
            }
            if (a.type === 'standalone' && b.type === 'standalone') {
              return (a.item?.name || '').localeCompare(b.item?.name || '');
            }
            // Parents come before standalone
            return a.type === 'parent' ? -1 : 1;
          });

          setDrawerGroupedItems(grouped);

          // Also keep flat list for backward compatibility
          const processedItems: ItemWithVariants[] = [];
          for (const group of grouped) {
            if (group.type === 'parent' && group.children) {
              for (const child of group.children) {
                processedItems.push({
                  ...child,
                  parentName: group.parent?.name,
                });
              }
            } else if (group.type === 'standalone' && group.item) {
              processedItems.push(group.item);
            }
          }
          setDrawerCategoryItems(processedItems);
        }
      } catch (err) {
        console.error('Error fetching drawer category items:', err);
      } finally {
        setDrawerItemsLoading(false);
      }
    }

    fetchDrawerCategoryItems();
  }, [drawerCategoryId, categoryDrawerOpen]);

  const drawerCategory = drawerCategoryId
    ? filteredCategories.find((c) => c.id === drawerCategoryId)
    : null;

  const filteredDrawerGroupedItems = drawerSearchQuery
    ? drawerGroupedItems.filter((group) => {
        if (group.type === 'parent') {
          const matchesParent = group.parent?.name.toLowerCase().includes(drawerSearchQuery.toLowerCase());
          const matchesChildren = group.children?.some(child => 
            child.name.toLowerCase().includes(drawerSearchQuery.toLowerCase()) ||
            child.variant_name?.toLowerCase().includes(drawerSearchQuery.toLowerCase())
          );
          return matchesParent || matchesChildren;
        } else {
          return group.item?.name.toLowerCase().includes(drawerSearchQuery.toLowerCase());
        }
      }).map(group => {
        if (group.type === 'parent' && group.children) {
          // Filter children if search query doesn't match parent
          const filteredChildren = group.children.filter(child =>
            child.name.toLowerCase().includes(drawerSearchQuery.toLowerCase()) ||
            child.variant_name?.toLowerCase().includes(drawerSearchQuery.toLowerCase()) ||
            group.parent?.name.toLowerCase().includes(drawerSearchQuery.toLowerCase())
          );
          return { ...group, children: filteredChildren };
        }
        return group;
      })
    : drawerGroupedItems;

  // Fetch receipt data when drawer opens
  useEffect(() => {
    if (!receiptSaleId || !receiptDrawerOpen) {
      setReceiptData(null);
      return;
    }

    async function fetchReceipt() {
      try {
        setReceiptLoading(true);
        setReceiptError(null);
        const result = await apiGet<{ sale: any; items: any[]; splitPayments?: any[] }>(`/api/sales/${receiptSaleId}`);
        if (result.success && result.data) {
          setReceiptData(result.data);
        } else {
          setReceiptError(result.message || 'Failed to load receipt');
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setReceiptError('Failed to load receipt');
      } finally {
        setReceiptLoading(false);
      }
    }

    fetchReceipt();
  }, [receiptSaleId, receiptDrawerOpen]);

  // Direct print function - opens print dialog for printer selection
  const handleDirectPrint = () => {
    // Find the receipt element
    const receiptElement = document.getElementById('receipt-to-print');
    
    if (receiptElement) {
      // Ensure receipt is visible and accessible for printing
      receiptElement.style.visibility = 'visible';
      receiptElement.style.display = 'block';
      receiptElement.style.position = 'relative';
      
      // Force all parent containers to be visible during print
      let parent = receiptElement.parentElement;
      while (parent && parent !== document.body) {
        parent.style.visibility = 'visible';
        parent.style.display = 'block';
        parent = parent.parentElement;
      }
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      // Fallback if element not found
      window.print();
    }
  };

  // Auto-print receipt when drawer opens with print flag
  useEffect(() => {
    if (receiptDrawerOpen && receiptData && receiptSaleId) {
      // Check if URL has print=true (from checkout)
      const urlParams = new URLSearchParams(window.location.search);
      const shouldPrint = urlParams.get('print') === 'true';
      
      // Only print if we haven't already printed this receipt
      if (shouldPrint && printedReceiptIdRef.current !== receiptSaleId) {
        // Small delay to ensure receipt is rendered
        const printTimer = setTimeout(() => {
          handleDirectPrint();
          // Mark this receipt as printed
          printedReceiptIdRef.current = receiptSaleId;
          // Remove print param from URL after printing
          const newUrl = window.location.pathname + window.location.search.replace(/[?&]print=true/, '');
          window.history.replaceState({}, '', newUrl);
        }, 1000);

        return () => clearTimeout(printTimer);
      }
    }
    
    // Reset printed receipt when drawer closes
    if (!receiptDrawerOpen) {
      printedReceiptIdRef.current = null;
    }
  }, [receiptDrawerOpen, receiptData, receiptSaleId]);

  interface ItemWithVariants extends Item {
    isParent?: boolean;
    variantCount?: number;
    variants?: Item[];
    parentName?: string; // Parent name for variants
  }

  interface GroupedItem {
    type: 'parent' | 'standalone';
    parent?: Item;
    children?: Item[];
    item?: Item;
  }

  const [categoryItems, setCategoryItems] = useState<ItemWithVariants[]>([]);
  const [groupedCategoryItems, setGroupedCategoryItems] = useState<GroupedItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryItems([]);
      setGroupedCategoryItems([]);
      setCategorySearchQuery('');
      return;
    }

    async function fetchCategoryItems() {
      try {
        setItemsLoading(true);
        const result = await apiGet<Item[]>(`/api/items?categoryId=${selectedCategoryId}`);
        if (result.success) {
          const allItems: Item[] = result.data ?? [];
          
          // Build parent name map and identify which items have variants
          const parentNames = new Map<string, string>();
          const parentIds = new Set<string>();
          const parentItems = new Map<string, Item>();
          
          for (const item of allItems) {
            if (!item.parent_item_id) {
              parentNames.set(item.id, item.name);
              parentItems.set(item.id, item);
            }
          }
          
          for (const item of allItems) {
            if (item.parent_item_id) {
              parentIds.add(item.parent_item_id);
            }
          }

          // Group items by parent
          const grouped: GroupedItem[] = [];
          const childrenByParent = new Map<string, Item[]>();
          const standaloneItems: Item[] = [];

          // Group children by parent
          for (const item of allItems) {
            if (item.parent_item_id) {
              if (!childrenByParent.has(item.parent_item_id)) {
                childrenByParent.set(item.parent_item_id, []);
              }
              childrenByParent.get(item.parent_item_id)!.push(item);
            } else if (!parentIds.has(item.id)) {
              // Standalone item (not a parent with children)
              standaloneItems.push(item);
            }
          }

          // Add parent groups
          for (const [parentId, children] of childrenByParent.entries()) {
            const parent = parentItems.get(parentId);
            if (parent) {
              grouped.push({
                type: 'parent',
                parent,
                children: children.sort((a, b) => 
                  (a.variant_name || a.name).localeCompare(b.variant_name || b.name)
                ),
              });
            }
          }

          // Add standalone items
          for (const item of standaloneItems) {
            grouped.push({
              type: 'standalone',
              item,
            });
          }

          // Sort grouped items: parents alphabetically, then standalone items
          grouped.sort((a, b) => {
            if (a.type === 'parent' && b.type === 'parent') {
              return (a.parent?.name || '').localeCompare(b.parent?.name || '');
            }
            if (a.type === 'standalone' && b.type === 'standalone') {
              return (a.item?.name || '').localeCompare(b.item?.name || '');
            }
            // Parents come before standalone
            return a.type === 'parent' ? -1 : 1;
          });

          setGroupedCategoryItems(grouped);

          // Also keep flat list for backward compatibility
          const processedItems: ItemWithVariants[] = [];
          for (const group of grouped) {
            if (group.type === 'parent' && group.children) {
              for (const child of group.children) {
                processedItems.push({
                  ...child,
                  parentName: group.parent?.name,
                });
              }
            } else if (group.type === 'standalone' && group.item) {
              processedItems.push(group.item);
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

  const filteredGroupedCategoryItems = categorySearchQuery
    ? groupedCategoryItems.filter((group) => {
        if (group.type === 'parent') {
          const matchesParent = group.parent?.name.toLowerCase().includes(categorySearchQuery.toLowerCase());
          const matchesChildren = group.children?.some(child => 
            child.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
            child.variant_name?.toLowerCase().includes(categorySearchQuery.toLowerCase())
          );
          return matchesParent || matchesChildren;
        } else {
          return group.item?.name.toLowerCase().includes(categorySearchQuery.toLowerCase());
        }
      }).map(group => {
        if (group.type === 'parent' && group.children) {
          // Filter children if search query doesn't match parent
          const filteredChildren = group.children.filter(child =>
            child.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
            child.variant_name?.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
            group.parent?.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
          );
          return { ...group, children: filteredChildren };
        }
        return group;
      })
    : groupedCategoryItems;

  const handleMobileItemClick = (item: ItemWithVariants) => {
    // All items are now directly selectable (variants or standalone)
    handleSelectItem(item);
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  return (
    <>
      {/* Mobile Kiosk Design */}
      <div className="md:hidden print:hidden bg-[#f6f8f6] dark:bg-[#132210] text-[#101b0d] dark:text-[#f0fdf4] min-h-screen w-full overflow-hidden flex flex-col antialiased">
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
            <header className="relative bg-gradient-to-br from-white via-[#f6f8f6] to-white dark:from-slate-900 dark:via-[#132210] dark:to-slate-900 sticky top-0 z-20 border-b border-gray-200/60 dark:border-gray-800/60 backdrop-blur-xl shadow-sm">
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#259783]/5 via-transparent to-[#3bd522]/5 pointer-events-none" />
              
              <div className="relative flex items-center justify-between p-4 pt-5 pb-4">
                {/* Left - Menu */}
                <button
                  aria-label="Menu"
                  className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg group"
                  onClick={() => setCategoryDrawerOpen(true)}
                >
                  <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-[#259783] transition-colors" />
                </button>

                {/* Center - Brand */}
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#259783] to-[#3bd522] blur-lg opacity-30" />
                    <h1 className="relative text-lg font-extrabold bg-gradient-to-r from-[#259783] via-[#2ab870] to-[#3bd522] bg-clip-text text-transparent tracking-tight">
                      Kiosk POS
                    </h1>
                  </div>
                  <ShopTypeSelector 
                    onShopTypeChange={handleShopTypeChange}
                    className="scale-90"
                  />
                </div>

                {/* Right - Actions */}
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Refresh"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg disabled:opacity-50 group"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-[#259783] transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                  
                  {isOwnerOrAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center justify-center gap-1.5 px-3 h-11 rounded-2xl bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#3bd522] hover:to-[#259783] active:scale-95 transition-all shadow-lg shadow-[#259783]/30 hover:shadow-[#3bd522]/40 text-white font-bold text-xs relative overflow-hidden group"
                      aria-label="Admin"
                    >
                      <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                      <Settings className="w-4 h-4 relative z-10" />
                      <span className="relative z-10 hidden xs:inline">Admin</span>
                    </Link>
                  )}
                  
                  <button
                    aria-label="Search"
                    onClick={() => setShowSearch(!showSearch)}
                    className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg group"
                  >
                    <Search className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-[#259783] transition-colors" />
                  </button>
                  
                  <button
                    aria-label="Logout"
                    onClick={() => signOut({ callbackUrl: '/pos/login' })}
                    className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-950/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg group"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              </div>
            </header>

            {showSearch && (
              <div className="px-4 pb-4 bg-[#f6f8f6] dark:bg-[#132210] sticky top-[72px] z-20 border-b border-black/5 dark:border-white/5 animate-in slide-in-from-top-2 duration-200">
                <form onSubmit={handleSearchSubmit}>
                  <div className="relative">
                    {isSearchPending || barcodeScanStatus.scanning ? (
                      <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#259783] animate-spin" />
                    ) : (
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    )}
                    <Input
                      ref={mobileSearchInputRef}
                      type="text"
                      placeholder="Search or scan barcode..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="pl-12 pr-12 h-14 bg-white dark:bg-[#1c2e18] rounded-2xl border-2 border-gray-200 dark:border-gray-700 focus:border-[#259783] focus:ring-4 focus:ring-[#259783]/20 text-base font-medium placeholder:text-gray-400 shadow-sm"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      data-barcode-enabled="true"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </form>
                {searchQuery && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {isSearchPending ? (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 bg-[#259783] rounded-full animate-pulse"></span>
                          Searching...
                        </span>
                      ) : isValidBarcode(searchQuery) ? (
                        <span className="flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-[#259783]" />
                          Press Enter to scan barcode
                        </span>
                      ) : (
                        `Showing results for "${debouncedSearchQuery}"`
                      )}
                    </span>
                    <button
                      onClick={clearSearch}
                      className="text-[#259783] font-medium hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            <main className="flex-1 overflow-y-auto no-scrollbar pb-32 px-4">
              {!searchQuery && !debouncedSearchQuery && (
                <>
                  <div className="flex gap-3 py-2 overflow-x-auto no-scrollbar w-full mb-4">
                    <button className="flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-[#1c2e18] border-2 border-gray-200 dark:border-gray-700 hover:border-[#259783] dark:hover:border-[#259783] shadow-sm hover:shadow-md px-6 active:scale-95 transition-all">
                      <DollarSign className="w-6 h-6 text-[#259783]" />
                      <p className="font-bold text-base whitespace-nowrap">Custom Amount</p>
                    </button>
                    <button 
                      onClick={() => {
                        setShowSearch(true);
                        setSearchQuery('');
                        // Focus will be handled by useEffect
                      }}
                      className="flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-full bg-gradient-to-r from-[#259783]/10 to-[#3bd522]/10 dark:from-[#259783]/20 dark:to-[#3bd522]/20 border-2 border-[#259783]/30 dark:border-[#259783]/40 hover:border-[#259783] dark:hover:border-[#259783] shadow-sm hover:shadow-md px-6 active:scale-95 transition-all"
                    >
                      <QrCode className="w-6 h-6 text-[#259783]" />
                      <p className="font-bold text-base whitespace-nowrap text-[#259783]">Scan Barcode</p>
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
                          onClick={() => handleCategoryClick(category.id)}
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
                            className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full bg-white/95 dark:bg-black/70 backdrop-blur-sm ${color} shadow-md`}
                          >
                            {icon}
                          </span>
                          <span className="relative z-20 text-white font-bold text-base tracking-tight leading-tight drop-shadow-lg">
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
                  {isSearchPending ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-[#259783]/20 rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-[#259783] border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                      </div>
                      <p className="text-gray-500 font-medium">Searching products...</p>
                    </div>
                  ) : debouncedSearchQuery ? (
                    <ItemGrid
                      categoryId={null}
                      searchQuery={debouncedSearchQuery}
                      onSelectItem={handleSelectItem}
                      onSelectParent={handleSelectParent}
                      onQuickAdd={handleQuickAdd}
                      shopType={shopType}
                      categories={categories}
                    />
                  ) : null}
                </div>
              )}
            </main>
          </>
        ) : (
          <>
            <header className="relative bg-gradient-to-br from-white via-[#f6f8f6] to-white dark:from-slate-900 dark:via-[#132210] dark:to-slate-900 sticky top-0 z-20 border-b border-gray-200/60 dark:border-gray-800/60 backdrop-blur-xl shadow-sm">
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#259783]/5 via-transparent to-[#3bd522]/5 pointer-events-none" />
              
              <div className="relative flex items-center justify-between p-4 pt-5 pb-4">
                {/* Left - Back */}
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg group"
                >
                  <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-[#259783] transition-colors" />
                </button>

                {/* Center - Category Name */}
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#259783] to-[#3bd522] blur-lg opacity-30" />
                    <h1 className="relative text-lg font-bold bg-gradient-to-r from-[#259783] to-[#3bd522] bg-clip-text text-transparent">
                      {selectedCategory?.name || 'Category'}
                    </h1>
                  </div>
                  <ShopTypeSelector 
                    onShopTypeChange={handleShopTypeChange}
                    className="scale-90"
                  />
                </div>

                {/* Right - Actions */}
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Refresh"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg disabled:opacity-50 group"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-[#259783] transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                  
                  {canAccessAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center justify-center gap-1.5 px-3 h-11 rounded-2xl bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#3bd522] hover:to-[#259783] active:scale-95 transition-all shadow-lg shadow-[#259783]/30 hover:shadow-[#3bd522]/40 text-white font-bold text-xs relative overflow-hidden group"
                      aria-label="Admin"
                    >
                      <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                      <Settings className="w-4 h-4 relative z-10" />
                      <span className="relative z-10 hidden xs:inline">Admin</span>
                    </Link>
                  )}
                  
                  <button
                    aria-label="Logout"
                    onClick={() => signOut({ callbackUrl: '/pos/login' })}
                    className="flex size-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-950/20 border border-gray-200/60 dark:border-gray-700/60 active:scale-95 transition-all shadow-md hover:shadow-lg group"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
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
              ) : filteredGroupedCategoryItems.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">
                    {categorySearchQuery
                      ? `No items found for "${categorySearchQuery}"`
                      : 'No items in this category'}
                  </p>
                </div>
              ) : (
                <div className="space-y-8 py-4">
                  {filteredGroupedCategoryItems.map((group, groupIndex) => {
                    if (group.type === 'parent' && group.parent && group.children && group.children.length > 0) {
                      return (
                        <div key={group.parent.id} className="space-y-4 bg-gradient-to-br from-[#259783]/5 via-transparent to-[#3bd522]/5 dark:from-[#259783]/10 dark:via-transparent dark:to-[#3bd522]/10 rounded-2xl p-4 sm:p-5 border border-[#259783]/10 dark:border-[#259783]/20">
                          {/* Parent Label */}
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-[#259783]/20 dark:border-[#259783]/30"></div>
                            </div>
                            <div className="relative flex justify-center">
                              <div className="px-5 py-2.5 bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] rounded-full shadow-lg shadow-[#259783]/30 border-2 border-white dark:border-[#132210]">
                                <h2 className="text-sm font-extrabold text-white uppercase tracking-wider whitespace-nowrap drop-shadow-sm">
                                  {group.parent.name}
                                </h2>
                              </div>
                            </div>
                          </div>
                          {/* Children Grid */}
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            {group.children.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => handleMobileItemClick(item)}
                                className="bg-[#1c2e18] dark:bg-[#132210] rounded-xl shadow-md hover:shadow-xl border border-[#259783]/10 dark:border-[#259783]/20 overflow-hidden active:scale-[0.98] transition-all duration-200 relative group"
                              >
                                <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                                  {group.parent && getItemImage(group.parent.name) ? (
                                    <img
                                      src={getItemImage(group.parent.name)!}
                                      alt={item.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                                </div>
                                <div className="p-3.5">
                                  <h3 className="font-bold text-sm text-left mb-2.5 line-clamp-2 text-white leading-tight">
                                    {item.name}
                                  </h3>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-md">
                                        {formatPrice(item.current_sell_price)}
                                      </span>
                                      <span className="text-xs text-white/70 font-medium">
                                        / {item.unit_type}
                                      </span>
                                    </div>
                                    {/* Bundle Pricing Badge */}
                                    {item.bundle_quantity && item.bundle_price && item.bundle_quantity > 0 && item.bundle_price > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                          <Tag className="w-2.5 h-2.5" />
                                          {item.bundle_name || `${item.bundle_quantity} for ${formatPrice(item.bundle_price)}`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    } else if (group.type === 'standalone' && group.item) {
                      return (
                        <div key={group.item.id} className="flex justify-center">
                          <button
                            onClick={() => handleMobileItemClick(group.item!)}
                            className="bg-[#1c2e18] dark:bg-[#132210] rounded-xl shadow-md hover:shadow-xl border border-[#259783]/10 dark:border-[#259783]/20 overflow-hidden active:scale-[0.98] transition-all duration-200 relative group w-full max-w-xs"
                          >
                          <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                            {getItemImage(group.item.name) ? (
                              <img
                                src={getItemImage(group.item.name)!}
                                alt={group.item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                          </div>
                          <div className="p-3.5">
                            <h3 className="font-bold text-sm text-left mb-2.5 line-clamp-2 text-white leading-tight">
                              {group.item.name}
                            </h3>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-md">
                                  {formatPrice(group.item.current_sell_price)}
                                </span>
                                <span className="text-xs text-white/70 font-medium">
                                  / {group.item.unit_type}
                                </span>
                              </div>
                              {/* Bundle Pricing Badge */}
                              {group.item.bundle_quantity && group.item.bundle_price && group.item.bundle_quantity > 0 && group.item.bundle_price > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                    <Tag className="w-2.5 h-2.5" />
                                    {group.item.bundle_name || `${group.item.bundle_quantity} for ${formatPrice(group.item.bundle_price)}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </main>
          </>
        )}

        <div className="fixed bottom-6 left-0 right-0 px-4 flex flex-col items-center gap-2.5 z-30 pointer-events-none">
          <button
            onClick={() => setCartDrawerOpen(true)}
            className="pointer-events-auto shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(75,238,43,0.3)] active:scale-95 transition-all w-full max-w-md h-[72px] bg-[#259783] rounded-full flex items-center justify-between px-2 pr-6 group text-white relative"
            style={{ backgroundColor: '#259783' }}
          >
            {cartItemCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearCart();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 z-10"
                title="Clear Cart"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-black/10 w-[56px] h-[56px] rounded-full flex items-center justify-center group-hover:bg-black/20 transition-colors">
                <ShoppingCart className="w-7 h-7 text-white" style={{ color: '#ffffff' }} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-lg leading-none" style={{ color: '#ffffff' }}>
                  Checkout
                </span>
                <span className="text-white/90 font-medium text-sm leading-tight mt-1" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>
            <span className="text-[#101b0d] font-black text-2xl tracking-tight text-teal-50" style={{ color: '#f0fdfa' }}>
              KES {cartTotal.toFixed(0)}
            </span>
          </button>
        </div>
      </div>

      {/* Desktop Original Design */}
      <div className="hidden md:block print:hidden">
        <POSLayout
          header={
            <div className="relative bg-gradient-to-br from-white via-[#f6f8f6] to-white dark:from-slate-900 dark:via-[#132210] dark:to-slate-900 border-b border-gray-200/60 dark:border-gray-800/60 backdrop-blur-xl">
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#259783]/5 via-transparent to-[#3bd522]/5 pointer-events-none" />
              
              <div className="relative flex items-center justify-between gap-4 px-4 py-4">
                {/* Left Section - Brand & Search */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Logo/Brand Section */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#259783] to-[#3bd522] rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
                      <div className="relative w-12 h-12 bg-gradient-to-br from-[#259783] to-[#3bd522] rounded-2xl flex items-center justify-center shadow-lg shadow-[#259783]/30 group-hover:shadow-[#3bd522]/40 transition-all group-hover:scale-105">
                        <ShoppingCart className="w-6 h-6 text-white drop-shadow-sm" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <h1 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-[#259783] via-[#2ab870] to-[#3bd522] bg-clip-text text-transparent hidden sm:block tracking-tight">
                        {user?.businessName || 'POS'}
                      </h1>
                      <ShopTypeSelector 
                        onShopTypeChange={handleShopTypeChange}
                        className="hidden sm:flex scale-95"
                      />
                    </div>
                  </div>

                  {/* Search Section */}
                  {showSearch ? (
                    <div className="flex-1 max-w-2xl relative animate-in fade-in slide-in-from-top-1 duration-300">
                      <form onSubmit={handleSearchSubmit}>
                        <div className="relative group">
                          {/* Glow effect on focus */}
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#259783] to-[#3bd522] rounded-2xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300" />
                          
                          <div className="relative flex items-center">
                            <div className="absolute left-4 z-10">
                              {isSearchPending || barcodeScanStatus.scanning ? (
                                <Loader2 className="w-5 h-5 text-[#259783] animate-spin" />
                              ) : isValidBarcode(searchQuery) ? (
                                <QrCode className="w-5 h-5 text-[#259783]" />
                              ) : (
                                <Search className="w-5 h-5 text-gray-400 group-focus-within:text-[#259783] transition-colors" />
                              )}
                            </div>
                            <Input
                              ref={searchInputRef}
                              type="text"
                              placeholder="Search products or scan barcode..."
                              value={searchQuery}
                              onChange={(e) => handleSearchChange(e.target.value)}
                              className="pl-12 pr-28 h-12 border-2 border-gray-200/80 dark:border-gray-700/80 focus:border-[#259783] focus:ring-4 focus:ring-[#259783]/20 rounded-2xl text-sm font-medium bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 dark:shadow-gray-900/50 transition-all"
                              autoComplete="off"
                              autoCorrect="off"
                              spellCheck={false}
                              data-barcode-enabled="true"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {searchQuery && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                                  onClick={clearSearch}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                              <kbd className="pointer-events-none h-7 select-none items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 px-2 font-mono text-[10px] font-semibold text-gray-600 dark:text-gray-400 hidden sm:flex shadow-sm">
                                Esc
                              </kbd>
                            </div>
                          </div>
                        </div>
                        {searchQuery && (
                          <div className="absolute top-full left-0 right-0 mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 pl-4 animate-in fade-in slide-in-from-top-1">
                            {isSearchPending ? (
                              <>
                                <span className="inline-block w-1.5 h-1.5 bg-[#259783] rounded-full animate-pulse"></span>
                                <span>Searching...</span>
                              </>
                            ) : isValidBarcode(searchQuery) ? (
                              <>
                                <QrCode className="w-3.5 h-3.5 text-[#259783]" />
                                <span className="text-[#259783] font-medium">Press Enter to scan barcode</span>
                              </>
                            ) : null}
                          </div>
                        )}
                      </form>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSearch(true)}
                      className="hidden sm:flex items-center gap-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 border-gray-200/80 dark:border-gray-700/80 hover:border-[#259783] transition-all h-11 px-5 rounded-2xl shadow-md hover:shadow-lg hover:scale-105 group"
                    >
                      <Search className="w-4 h-4 text-gray-500 group-hover:text-[#259783] transition-colors" />
                      <span className="hidden md:inline text-gray-600 dark:text-gray-300 font-medium">Search</span>
                      <kbd className="hidden lg:inline pointer-events-none h-6 select-none items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 px-1.5 font-mono text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                        <span className="text-xs">⌘</span>K
                      </kbd>
                    </Button>
                  )}
                </div>

                {/* Right Section - Actions & Cart */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {/* Action Buttons Group */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="hidden sm:flex h-9 w-9 p-0 hover:bg-[#259783]/10 dark:hover:bg-[#259783]/20 text-gray-600 dark:text-gray-300 hover:text-[#259783] transition-all rounded-xl disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    
                    {canAccessAdmin && (
                      <Link href="/admin">
                        <Button
                          size="sm"
                          className="hidden sm:flex items-center gap-2 h-9 px-3 bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#3bd522] hover:to-[#259783] text-white font-semibold shadow-lg shadow-[#259783]/30 hover:shadow-[#3bd522]/40 transition-all relative overflow-hidden group rounded-xl"
                        >
                          <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
                          <Settings className="w-4 h-4 relative z-10" />
                          <span className="hidden md:inline relative z-10 text-sm">Admin</span>
                        </Button>
                      </Link>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => signOut({ callbackUrl: '/pos/login' })}
                      className="hidden sm:flex h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-all rounded-xl"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Cart Section */}
                  <div className="flex items-center gap-2 pl-3 border-l border-gray-200/60 dark:border-gray-700/60">
                    {cartItemCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCart}
                        className="hidden sm:flex h-10 w-10 p-0 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-all rounded-xl group"
                        title="Clear Cart"
                      >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="touch"
                      onClick={() => setCartDrawerOpen(true)}
                      className="relative h-12 px-4 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 hover:from-[#259783]/10 hover:to-[#3bd522]/10 dark:hover:from-[#259783]/20 dark:hover:to-[#3bd522]/20 border-2 border-gray-200/80 dark:border-gray-700/80 hover:border-[#259783] transition-all shadow-lg hover:shadow-xl hover:scale-105 rounded-2xl group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <ShoppingCart className="w-5 h-5 text-[#259783] group-hover:scale-110 transition-transform" />
                          {cartItemCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="absolute -top-2.5 -right-2.5 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-pulse shadow-lg"
                            >
                              {cartItemCount}
                            </Badge>
                          )}
                        </div>
                        <span className="hidden sm:inline font-semibold text-gray-700 dark:text-gray-200">Cart</span>
                        {cartItemCount > 0 && (
                          <span className="hidden md:inline ml-1 font-bold text-[#259783] text-sm">
                            KES {cartTotal.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <div className="flex flex-col h-full">
            {!debouncedSearchQuery && !searchQuery && (
              <div className="border-b border-gray-200 bg-white/50 backdrop-blur-sm">
                <CategoryList
                  onSelectCategory={handleCategoryClick}
                  selectedCategoryId={selectedCategoryId || undefined}
                  shopType={shopType}
                  categories={categories}
                />
              </div>
            )}
            <div className="flex-1 overflow-auto bg-gradient-to-b from-transparent to-gray-50/50">
              {searchQuery && isSearchPending ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-[#259783]/20 rounded-full"></div>
                    <div className="w-12 h-12 border-4 border-[#259783] border-t-transparent rounded-full animate-spin absolute inset-0"></div>
                  </div>
                  <p className="text-gray-500 font-medium">Searching products...</p>
                </div>
              ) : (
                <ItemGrid
                  categoryId={debouncedSearchQuery ? null : selectedCategoryId}
                  searchQuery={debouncedSearchQuery || undefined}
                  onSelectItem={handleSelectItem}
                  onSelectParent={handleSelectParent}
                  onQuickAdd={handleQuickAdd}
                  shopType={shopType}
                  categories={categories}
                />
              )}
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

      {/* Clear Cart Confirmation Toast */}
      {showClearCartToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={cancelClearCart}
          />
          
          {/* Toast Content */}
          <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-300">
            {/* Main Card */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-hidden">
              <div className="p-6">
                {/* Header Section */}
                <div className="flex items-start gap-4 mb-5">
                  {/* Icon Container */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  
                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Clear Cart?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      Remove all <span className="font-medium text-gray-900 dark:text-gray-200">{cartItemCount}</span> {cartItemCount === 1 ? 'item' : 'items'} from your cart?
                    </p>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={cancelClearCart}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={cancelClearCart}
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmClearCart}
                    size="sm"
                    className="flex-1 h-10 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium rounded-xl transition-colors"
                  >
                    Clear Cart
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scan Status Notification */}
      {(barcodeScanStatus.scanning || barcodeScanStatus.error || barcodeScanStatus.success) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300 print:hidden">
          <div className={`
            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm
            ${barcodeScanStatus.scanning 
              ? 'bg-blue-50/90 border-blue-200 text-blue-800' 
              : barcodeScanStatus.error 
                ? 'bg-red-50/90 border-red-200 text-red-800'
                : 'bg-green-50/90 border-green-200 text-green-800'
            }
          `}>
            {barcodeScanStatus.scanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <div>
                  <p className="font-semibold text-sm">Scanning barcode...</p>
                  <p className="text-xs opacity-75">{barcodeScanStatus.lastScanned}</p>
                </div>
              </>
            ) : barcodeScanStatus.error ? (
              <>
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Barcode not found</p>
                  <p className="text-xs opacity-75">{barcodeScanStatus.lastScanned}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <QrCode className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Product found!</p>
                  <p className="text-xs opacity-75">{barcodeScanStatus.lastScanned}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Category Products Drawer */}
      <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 print:hidden">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-sm flex-shrink-0">
                  {drawerCategory && getCategoryIcon(drawerCategory.name)}
                </div>
                <div>
                  <DrawerTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    {drawerCategory?.name || 'Category'}
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {drawerItemsLoading 
                      ? 'Loading products...' 
                      : `${drawerCategoryItems.length} ${drawerCategoryItems.length === 1 ? 'product' : 'products'} available`}
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </DrawerClose>
            </div>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder={`Search ${drawerCategory?.name.toLowerCase()}...`}
                value={drawerSearchQuery}
                onChange={(e) => setDrawerSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-11 bg-white dark:bg-slate-800 rounded-xl border-gray-200 dark:border-gray-700 focus:border-[#259783] focus:ring-2 focus:ring-[#259783]/20"
              />
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900 px-4 sm:px-6 py-6">
            {drawerItemsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
              </div>
            ) : filteredDrawerGroupedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Package className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  {drawerSearchQuery
                    ? `No products found for "${drawerSearchQuery}"`
                    : 'No products in this category'}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredDrawerGroupedItems.map((group) => {
                  if (group.type === 'parent' && group.parent && group.children && group.children.length > 0) {
                    return (
                      <div key={group.parent.id} className="space-y-5 bg-gradient-to-br from-[#259783]/5 via-transparent to-[#3bd522]/5 dark:from-[#259783]/10 dark:via-transparent dark:to-[#3bd522]/10 rounded-2xl p-5 sm:p-6 border border-[#259783]/10 dark:border-[#259783]/20">
                        {/* Parent Label */}
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#259783]/20 dark:border-[#259783]/30"></div>
                          </div>
                          <div className="relative flex justify-center">
                            <div className="px-6 py-3 bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] rounded-full shadow-lg shadow-[#259783]/30 border-2 border-white dark:border-slate-900">
                              <h2 className="text-base font-extrabold text-white uppercase tracking-wider whitespace-nowrap drop-shadow-sm">
                                {group.parent.name}
                              </h2>
                            </div>
                          </div>
                        </div>
                        {/* Children Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {group.children.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                handleSelectItem(item);
                                setCategoryDrawerOpen(false);
                              }}
                              className="group bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl border border-slate-200 dark:border-slate-700 hover:border-[#259783] active:scale-[0.98] transition-all duration-200 overflow-hidden text-left"
                            >
                              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                                {group.parent && getItemImage(group.parent.name) ? (
                                  <img
                                    src={getItemImage(group.parent.name)!}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
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
                              </div>
                              <div className="p-3.5">
                                <h3 className="font-bold text-sm mb-2.5 line-clamp-2 text-slate-900 dark:text-white leading-tight">
                                  {item.name}
                                </h3>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-md">
                                      KES {item.current_sell_price.toFixed(0)}
                                    </span>
                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                      / {item.unit_type}
                                    </span>
                                  </div>
                                  {item.bundle_quantity && item.bundle_price && item.bundle_quantity > 0 && item.bundle_price > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                        <Tag className="w-2.5 h-2.5" />
                                        {item.bundle_name || `${item.bundle_quantity} for KES ${item.bundle_price.toFixed(0)}`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  } else if (group.type === 'standalone' && group.item) {
                    return (
                      <div key={group.item.id} className="flex justify-center">
                        <button
                          onClick={() => {
                            handleSelectItem(group.item!);
                            setCategoryDrawerOpen(false);
                          }}
                          className="group bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl border border-slate-200 dark:border-slate-700 hover:border-[#259783] active:scale-[0.98] transition-all duration-200 overflow-hidden text-left w-full max-w-xs"
                        >
                        <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden relative">
                          {getItemImage(group.item.name) ? (
                            <img
                              src={getItemImage(group.item.name)!}
                              alt={group.item.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
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
                        </div>
                        <div className="p-3.5">
                          <h3 className="font-bold text-sm mb-2.5 line-clamp-2 text-slate-900 dark:text-white leading-tight">
                            {group.item.name}
                          </h3>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-[#259783] bg-gradient-to-r from-[#259783] to-[#3bd522] text-white font-bold text-sm px-3 py-1.5 rounded-lg shadow-md">
                                KES {group.item.current_sell_price.toFixed(0)}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                / {group.item.unit_type}
                              </span>
                            </div>
                            {group.item.bundle_quantity && group.item.bundle_price && group.item.bundle_quantity > 0 && group.item.bundle_price > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                  <Tag className="w-2.5 h-2.5" />
                                  {group.item.bundle_name || `${group.item.bundle_quantity} for KES ${group.item.bundle_price.toFixed(0)}`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Cart Drawer */}
      <Drawer open={cartDrawerOpen} onOpenChange={setCartDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 print:hidden">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-sm flex-shrink-0">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Shopping Cart
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} • KES {cartTotal.toFixed(0)}
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900">
            <CartView 
              onContinueShopping={() => setCartDrawerOpen(false)}
              onCheckout={() => {
                setCartDrawerOpen(false);
                setCheckoutDrawerOpen(true);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Checkout Drawer */}
      <Drawer open={checkoutDrawerOpen} onOpenChange={setCheckoutDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 print:hidden">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-sm flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Checkout
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Complete your purchase
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900 px-4 sm:px-6 py-6">
            <CheckoutForm 
              onBackToCart={() => {
                setCheckoutDrawerOpen(false);
                setCartDrawerOpen(true);
              }}
              onContinueShopping={() => {
                setCheckoutDrawerOpen(false);
              }}
              onSaleComplete={(saleId) => {
                setCheckoutDrawerOpen(false);
                setReceiptSaleId(saleId);
                setReceiptDrawerOpen(true);
                // Add print=true to URL for auto-print
                const url = new URL(window.location.href);
                url.searchParams.set('print', 'true');
                window.history.replaceState({}, '', url.toString());
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Receipt Drawer */}
      <Drawer open={receiptDrawerOpen} onOpenChange={setReceiptDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[800px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5 print:hidden">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-sm flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Receipt
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Sale completed successfully
                  </DrawerDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {receiptData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDirectPrint}
                    className="hidden sm:flex"
                  >
                    Print
                  </Button>
                )}
                <DrawerClose asChild>
                  <button
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
                    aria-label="Close drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </DrawerClose>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900 px-4 sm:px-6 py-6 print:bg-white print:p-0">
            {receiptLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#259783]" />
                <p className="text-gray-500 dark:text-gray-400">Loading receipt...</p>
              </div>
            ) : receiptError || !receiptData ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <XCircle className="w-16 h-16 text-red-300 dark:text-red-600" />
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  {receiptError || 'Receipt not found'}
                </p>
                <Button
                  onClick={() => {
                    setReceiptDrawerOpen(false);
                  }}
                  size="touch"
                  className="bg-[#259783] hover:bg-[#45d827] text-white"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="print:p-0">
                <Receipt sale={receiptData.sale} items={receiptData.items} splitPayments={receiptData.splitPayments} />
                <div className="mt-6 flex gap-3 print:hidden">
                  <Button
                    variant="outline"
                    size="touch"
                    onClick={handleDirectPrint}
                    className="flex-1 sm:hidden"
                  >
                    Print
                  </Button>
                  <Button
                    size="touch"
                    onClick={() => {
                      setReceiptDrawerOpen(false);
                      setCartDrawerOpen(false);
                      setCheckoutDrawerOpen(false);
                    }}
                    className="flex-1 bg-[#259783] hover:bg-[#45d827] text-white"
                  >
                    New Sale
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}