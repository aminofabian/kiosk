"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { POSLayout } from "@/components/layouts/pos-layout";
import { CategoryList } from "@/components/pos/CategoryList";
import { ItemGrid } from "@/components/pos/ItemGrid";
import { AddToCartDialog } from "@/components/pos/AddToCartDialog";
import { OutOfStockRequestModal } from "@/components/pos/OutOfStockRequestModal";
import { VariantSelector } from "@/components/pos/VariantSelector";
import { PosCategoryChips } from "@/components/pos/PosCategoryChips";
import { PosTransactionDrawers } from "@/components/pos/PosTransactionDrawers";
import { PosCartColumn } from "@/components/pos/PosCartColumn";
import { PosDepartmentRail } from "@/components/pos/PosDepartmentRail";
import { PosDesktopHeader } from "@/components/pos/PosDesktopHeader";
import { PosBottomNav, type PosMobileTab } from "@/components/pos/PosBottomNav";
import { PosMobileMoreSheet } from "@/components/pos/PosMobileMoreSheet";
import { PosReturnsDialog } from "@/components/pos/PosReturnsDialog";
import { PosMobileCartTab } from "@/components/pos/PosMobileCartTab";
import { PosMobileSearchBar } from "@/components/pos/PosMobileSearchBar";
import { PosSearchSuggestionsDropdown } from "@/components/pos/PosSearchSuggestionsDropdown";
import { PosCategoryDrawer } from "@/components/pos/PosCategoryDrawer";
import {
  PosCashierOperationsProvider,
  PosShiftStatusBar,
} from "@/components/pos/PosCashierOperations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { useCartStore } from "@/lib/stores/cart-store";
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
  PackageX,
  BarChart2,
  RotateCcw,
  Camera,
} from "lucide-react";
import Link from "next/link";
import type { Item } from "@/lib/db/types";
import type { Category } from "@/lib/db/types";
import { resolveItemImageUrl } from "@/lib/utils/item-images";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { canProcessRefund } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/constants";
import { Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { apiGet } from "@/lib/utils/api-client";
import { apiGetOffline } from "@/lib/offline/api-offline";
import { ShopTypeSelector } from "@/components/pos/ShopTypeSelector";
import {
  getShopType,
  itemMatchesShopType,
  shouldShowCategory,
} from "@/lib/utils/shop-type";
import { useItemTypes } from "@/lib/hooks/use-item-types";
import { usePosSearch } from "@/lib/hooks/use-pos-search";
import {
  useBarcodeScanner,
  isValidBarcode,
} from "@/lib/hooks/use-barcode-scanner";
import { BarcodeCameraScannerDialog } from "@/components/pos/BarcodeCameraScannerDialog";
import { storeUserRole, clearUserRole } from "@/lib/utils/user-role-storage";
import { Clock, Command } from "lucide-react";
import {
  groupItemsByParent,
  filterGroupedItems,
  type GroupedItem,
  type ItemWithVariants,
} from "@/lib/pos/item-groups";
import { usePosKeyboardShortcuts } from "@/lib/hooks/use-pos-keyboard-shortcuts";
import { usePendingSales } from "@/lib/hooks/use-pending-sales";
import { isDepartmentOrder } from "@/lib/pos/pending-sales";
import { useDepartmentEvents } from "@/lib/hooks/use-department-events";

export default function POSPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    isSearchPending,
    recentSearches,
    searchSuggestions,
    showSuggestions,
    setShowSuggestions,
    searchFocused,
    loadingSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    searchGridItems,
    searchGridQuery,
    flatSuggestionsRef,
    handleSearchFocus,
    handleRecentSearchClick,
    handleSearchKeyDown,
    dismissSuggestions,
    resetSearch,
  } = usePosSearch();
  const [categories, setCategories] = useState<Category[]>([]);
  const { itemTypeKeys, allowSellOutOfStock } = useItemTypes();
  const [shopType, setShopType] = useState<string>(() => getShopType());

  useEffect(() => {
    if (itemTypeKeys.length > 0) {
      setShopType(getShopType(itemTypeKeys));
    }
  }, [itemTypeKeys]);

  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [drawerCategoryId, setDrawerCategoryId] = useState<string | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutDrawerOpen, setCheckoutDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<PosMobileTab>("sell");
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [isWideViewport, setIsWideViewport] = useState(false);

  useEffect(() => {
    if (isWideViewport) {
      setShowSearch(true);
    }
  }, [isWideViewport]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsWideViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [receiptDrawerOpen, setReceiptDrawerOpen] = useState(false);
  const [outOfStockModalOpen, setOutOfStockModalOpen] = useState(false);
  const [returnsDialogOpen, setReturnsDialogOpen] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    sale: any;
    items: any[];
    splitPayments?: any[];
    receiptSettings?: {
      tagline?: string;
      website?: string;
      phone?: string;
      tillNumber?: string;
    };
  } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showClearCartToast, setShowClearCartToast] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<Item[]>([]);
  const [lowStockHomeItems, setLowStockHomeItems] = useState<Item[]>([]);
  const [outStockItems, setOutStockItems] = useState<Item[]>([]);
  const [lowQtyHomeItems, setLowQtyHomeItems] = useState<Item[]>([]);
  const [posStockFilter, setPosStockFilter] = useState<"all" | "out" | "low">(
    "all",
  );
  const [statsMenuOpen, setStatsMenuOpen] = useState(false);
  const statsMenuRefMobile = useRef<HTMLDivElement>(null);
  const statsMenuRefDesktop = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const printedReceiptIdRef = useRef<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const desktopSearchContainerRef = useRef<HTMLDivElement>(null);
  const {
    clearCart,
    carts,
    activeCartId,
    switchCart,
    createCart,
    clearCartByPendingSaleId,
  } = useCartStore();
  const {
    orphaned,
    refresh: refreshPendingSales,
    removeSale,
  } = usePendingSales();
  const departmentOrphanedCount = useMemo(
    () => orphaned.filter(isDepartmentOrder).length,
    [orphaned],
  );
  const { user } = useCurrentUser();

  // Refresh trigger for PosPendingSalesPanel (incremented on SSE events)
  const [cartRefreshTrigger, setCartRefreshTrigger] = useState(0);

  // Auto-select first cart if none is active
  useEffect(() => {
    if (!activeCartId && carts.length > 0) {
      switchCart(carts[0].id);
    }
  }, [activeCartId, carts, switchCart]);

  // Calculate total items across all carts
  const totalCartsWithItems = carts.filter((c) => c.items.length > 0).length;
  const activeCart = carts.find((c) => c.id === activeCartId) || carts[0];
  const cartItems = activeCart?.items || [];
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";
  const canAccessAdmin = isOwnerOrAdmin || user?.role === "cashier";
  const canProcessReturn = user?.role
    ? canProcessRefund(user.role as UserRole)
    : false;

  const bumpCartRefresh = useCallback(() => {
    setCartRefreshTrigger((k) => k + 1);
  }, []);

  const handleDeptOrderForwarded = useCallback(() => {
    void refreshPendingSales();
    bumpCartRefresh();
  }, [refreshPendingSales, bumpCartRefresh]);

  const handleDeptOrderCompleted = useCallback(
    (event: { data: Record<string, unknown> }) => {
      const pendingSaleId = event.data.pendingSaleId;
      if (typeof pendingSaleId === "string") {
        removeSale(pendingSaleId);
        clearCartByPendingSaleId(pendingSaleId);
      }
      void refreshPendingSales();
      bumpCartRefresh();
    },
    [removeSale, clearCartByPendingSaleId, refreshPendingSales, bumpCartRefresh],
  );

  const handleDeptQueueUpdate = useCallback(
    (event: { data: Record<string, unknown> }) => {
      const pendingSaleId = event.data.pendingSaleId;
      if (
        event.data.action === "completed" &&
        typeof pendingSaleId === "string"
      ) {
        removeSale(pendingSaleId);
        clearCartByPendingSaleId(pendingSaleId);
      }
      void refreshPendingSales();
      bumpCartRefresh();
    },
    [removeSale, clearCartByPendingSaleId, refreshPendingSales, bumpCartRefresh],
  );

  // WebSocket/SSE for department orders — stable callbacks avoid reconnect on each keystroke
  useDepartmentEvents({
    role: user?.role,
    userId: user?.id,
    businessId: user?.businessId,
    onForwarded: handleDeptOrderForwarded,
    onCompleted: handleDeptOrderCompleted,
    onQueueUpdate: handleDeptQueueUpdate,
  });

  const posStockStats = useMemo(() => {
    const popular = featuredItems.filter((i) =>
      itemMatchesShopType(i, shopType),
    ).length;
    const out = outStockItems.filter((i) =>
      itemMatchesShopType(i, shopType),
    ).length;
    const low = lowQtyHomeItems.filter((i) =>
      itemMatchesShopType(i, shopType),
    ).length;
    return { popular, out, low };
  }, [featuredItems, outStockItems, lowQtyHomeItems, shopType]);

  useEffect(() => {
    if (!isOwnerOrAdmin && posStockFilter !== "all") {
      setPosStockFilter("all");
    }
  }, [isOwnerOrAdmin, posStockFilter]);

  useEffect(() => {
    if (!statsMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        statsMenuRefMobile.current?.contains(t) ||
        statsMenuRefDesktop.current?.contains(t)
      ) {
        return;
      }
      setStatsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [statsMenuOpen]);

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

  const [barcodeCameraOpen, setBarcodeCameraOpen] = useState(false);

  // Barcode scanner state
  const [barcodeScanStatus, setBarcodeScanStatus] = useState<{
    scanning: boolean;
    lastScanned: string | null;
    error: string | null;
    success: boolean;
  }>({ scanning: false, lastScanned: null, error: null, success: false });

  // Handle barcode scan from scanner or manual input
  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      if (!barcode || barcode.length < 4) return;

      setBarcodeScanStatus({
        scanning: true,
        lastScanned: barcode,
        error: null,
        success: false,
      });

      try {
        const result = await apiGetOffline<Item>(
          `/api/items/barcode/${encodeURIComponent(barcode)}`,
        );

        if (result.success && result.data) {
          setBarcodeScanStatus({
            scanning: false,
            lastScanned: barcode,
            error: null,
            success: true,
          });
          // Open the item dialog
          setSelectedItem(result.data);
          setDialogOpen(true);
          // Clear search if open
          if (showSearch) {
            setSearchQuery("");
          }
          // Auto-clear success status after 2 seconds
          setTimeout(() => {
            setBarcodeScanStatus((prev) => ({ ...prev, success: false }));
          }, 2000);
        } else {
          setBarcodeScanStatus({
            scanning: false,
            lastScanned: barcode,
            error: `Product not found for barcode: ${barcode}`,
            success: false,
          });
          // Auto-clear error after 3 seconds
          setTimeout(() => {
            setBarcodeScanStatus((prev) => ({ ...prev, error: null }));
          }, 3000);
        }
      } catch (err) {
        console.error("Barcode scan error:", err);
        setBarcodeScanStatus({
          scanning: false,
          lastScanned: barcode,
          error: "Failed to lookup barcode",
          success: false,
        });
        setTimeout(() => {
          setBarcodeScanStatus((prev) => ({ ...prev, error: null }));
        }, 3000);
      }
    },
    [showSearch],
  );

  const handleCameraBarcode = useCallback(
    (code: string) => {
      setSearchQuery(code);
      void handleBarcodeScan(code);
    },
    [handleBarcodeScan],
  );

  // Initialize barcode scanner hook
  const { manualScan } = useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    minLength: 4,
    maxDelay: 100, // Increased to be more forgiving
  });

  // Handle search input that might be a barcode
  const handleSearchSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // If a suggestion is selected, choose it (using flat items ref for correct grouped order)
      const flatItems = flatSuggestionsRef.current;
      if (
        showSuggestions &&
        selectedSuggestionIndex >= 0 &&
        selectedSuggestionIndex < flatItems.length
      ) {
        const selectedSuggestion = flatItems[selectedSuggestionIndex];
        setShowSearch(false);
        resetSearch();

        try {
          const result = await apiGetOffline<Item>(
            `/api/items/${selectedSuggestion.id}`,
          );
          if (result.success && result.data) {
            setSelectedItem(result.data);
            setDialogOpen(true);
          }
        } catch (err) {
          console.error("Error fetching item:", err);
        }
        return;
      }

      // Close suggestions dropdown when submitting
      setShowSuggestions(false);

      const query = searchQuery.trim();
      if (query && isValidBarcode(query)) {
        handleBarcodeScan(query);
      }
    },
    [searchQuery, handleBarcodeScan, showSuggestions, selectedSuggestionIndex, resetSearch],
  );

  const fetchCategories = useCallback(async () => {
    try {
      const result = await apiGetOffline<Category[]>("/api/categories");
      if (result.success) {
        setCategories(result.data ?? []);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Load POS insights (popular + low stock) for Quick Sell
  // Re-fetch on mount, tab visible, and when Refresh is clicked
  const loadPosInsights = useCallback(async () => {
    try {
      const result = await apiGet<{
        topItems: Item[];
        lowStockItems: Item[];
        outOfStockItems?: Item[];
        lowQuantityItems?: Item[];
      }>(`/api/pos/insights?days=7&_=${Date.now()}`);
      if (!result.success || !result.data) return;
      setFeaturedItems(result.data.topItems || []);
      setLowStockHomeItems(result.data.lowStockItems || []);
      setOutStockItems(result.data.outOfStockItems ?? []);
      setLowQtyHomeItems(result.data.lowQuantityItems ?? []);
    } catch (err) {
      console.error("Error fetching POS insights:", err);
    }
  }, []);

  useEffect(() => {
    loadPosInsights();
  }, [loadPosInsights]);

  const handleItemImageUpdated = useCallback(
    (itemId: string, imageUrl: string | null) => {
      const patch = (list: Item[]) =>
        list.map((i) => (i.id === itemId ? { ...i, image_url: imageUrl } : i));
      setFeaturedItems(patch);
      setLowStockHomeItems(patch);
      setOutStockItems(patch);
      setLowQtyHomeItems(patch);
    },
    [],
  );

  // Cache current shift for offline sales (when online)
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      apiGetOffline<import("@/lib/db/types").Shift | null>(
        "/api/shifts/current",
      ).catch(() => {});
    }
  }, []);

  // Soft refresh: re-fetch insights + categories + items without full reload (keeps cart)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadPosInsights(), fetchCategories()]);
      setRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [loadPosInsights, fetchCategories]);

  // Close suggestions when clicking outside (use 'click' so suggestion button onClick runs first)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMobile = searchContainerRef.current?.contains(target);
      const insideDesktop = desktopSearchContainerRef.current?.contains(target);
      if (!insideMobile && !insideDesktop) {
        dismissSuggestions();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [dismissSuggestions]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback(
    async (suggestion: { id: string; name: string }) => {
      setShowSearch(false);
      resetSearch();

      try {
        const result = await apiGetOffline<Item>(`/api/items/${suggestion.id}`);
        if (result.success && result.data) {
          setSelectedItem(result.data);
          setDialogOpen(true);
        }
      } catch (err) {
        console.error("Error fetching item:", err);
      }
    },
    [resetSearch],
  );

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

  const handleSelectItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  }, []);

  const handleSelectParent = useCallback(
    (parentItem: { id: string; name: string; variants?: Item[] }) => {
      setSelectedParentItem(parentItem);
      setVariantSelectorOpen(true);
    },
    [],
  );

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
      quantity,
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
    resetSearch();
  }, [resetSearch]);

  const handleClearSearchFromDropdown = useCallback(() => {
    setSearchQuery("");
    (mobileSearchInputRef.current || searchInputRef.current)?.focus();
  }, [setSearchQuery]);

  const suggestionsDropdownProps = useMemo(
    () => ({
      searchQuery,
      debouncedSearchQuery,
      loadingSuggestions,
      showSuggestions,
      searchFocused,
      recentSearches,
      searchSuggestions,
      selectedSuggestionIndex,
      flatSuggestionsRef,
      onSelectSuggestion: handleSelectSuggestion,
      onRecentSearchClick: handleRecentSearchClick,
      onDismiss: () => setShowSuggestions(false),
      onClearSearch: handleClearSearchFromDropdown,
      setSelectedSuggestionIndex,
    }),
    [
      searchQuery,
      debouncedSearchQuery,
      loadingSuggestions,
      showSuggestions,
      searchFocused,
      recentSearches,
      searchSuggestions,
      selectedSuggestionIndex,
      handleSelectSuggestion,
      handleRecentSearchClick,
      handleClearSearchFromDropdown,
      setShowSuggestions,
      setSelectedSuggestionIndex,
    ],
  );

  const suggestionsDesktop = useMemo(
    () => <PosSearchSuggestionsDropdown isDesktop {...suggestionsDropdownProps} />,
    [suggestionsDropdownProps],
  );
  const suggestionsMobile = useMemo(
    () => <PosSearchSuggestionsDropdown {...suggestionsDropdownProps} />,
    [suggestionsDropdownProps],
  );

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const handleClearCart = useCallback(() => {
    if (cartItemCount === 0) return;
    setShowClearCartToast(true);
  }, [cartItemCount]);

  const confirmClearCart = useCallback(() => {
    clearCart({ confirmed: true });
    setShowClearCartToast(false);
  }, [clearCart]);

  const cancelClearCart = useCallback(() => {
    setShowClearCartToast(false);
  }, []);

  const handleMobileTabChange = useCallback((tab: PosMobileTab) => {
    setMobileTab(tab);
    if (tab === "search") {
      setShowSearch(true);
      setSelectedCategoryId(null);
      window.setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
    } else {
      setShowSearch(false);
      setShowSuggestions(false);
    }
  }, []);

  usePosKeyboardShortcuts({
    onFocusSearch: () => {
      if (!isWideViewport) {
        handleMobileTabChange("search");
      } else {
        setShowSearch(true);
      }
    },
    onCloseSearch: () => {
      if (isWideViewport) {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else if (searchQuery) {
          clearSearch();
        }
        return;
      }
      if (!isWideViewport && mobileTab === "search") {
        handleMobileTabChange("sell");
        return;
      }
      if (showSuggestions) {
        setShowSuggestions(false);
      } else if (showSearch) {
        setShowSearch(false);
        resetSearch();
      }
    },
    onOpenCheckout: () => {
      if (cartItemCount > 0) {
        setCartDrawerOpen(false);
        setCheckoutDrawerOpen(true);
        if (!isWideViewport) {
          setMobileTab("cart");
        }
      }
    },
    onClearCart: handleClearCart,
    onNewCart: () => createCart(),
    searchOpen: showSearch,
    suggestionsOpen: showSuggestions,
    cartHasItems: cartItemCount > 0,
  });


  // Show all categories in a uniform grid

  const filteredCategories = categories.filter((cat) =>
    shouldShowCategory(cat.name, shopType),
  );

  const selectedCategory = selectedCategoryId
    ? filteredCategories.find((c) => c.id === selectedCategoryId)
    : null;

  const handleShopTypeChange = (newShopType: string) => {
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
        const result = await apiGet<{
          sale: any;
          items: any[];
          splitPayments?: any[];
        }>(`/api/sales/${receiptSaleId}`);
        if (result.success && result.data) {
          setReceiptData(result.data);
        } else {
          setReceiptError(result.message || "Failed to load receipt");
        }
      } catch (err) {
        console.error("Error fetching receipt:", err);
        setReceiptError("Failed to load receipt");
      } finally {
        setReceiptLoading(false);
      }
    }

    fetchReceipt();
  }, [receiptSaleId, receiptDrawerOpen]);

  // Direct print function - opens print dialog for printer selection
  const handleDirectPrint = () => {
    // Find the receipt element
    const receiptElement = document.getElementById("receipt-to-print");

    if (receiptElement) {
      // Ensure receipt is visible and accessible for printing
      receiptElement.style.visibility = "visible";
      receiptElement.style.display = "block";
      receiptElement.style.position = "relative";

      // Force all parent containers to be visible during print
      let parent = receiptElement.parentElement;
      while (parent && parent !== document.body) {
        parent.style.visibility = "visible";
        parent.style.display = "block";
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
      const shouldPrint = urlParams.get("print") === "true";

      // Only print if we haven't already printed this receipt
      if (shouldPrint && printedReceiptIdRef.current !== receiptSaleId) {
        // Small delay to ensure receipt is rendered
        const printTimer = setTimeout(() => {
          handleDirectPrint();
          // Mark this receipt as printed
          printedReceiptIdRef.current = receiptSaleId;
          // Remove print param from URL after printing
          const newUrl =
            window.location.pathname +
            window.location.search.replace(/[?&]print=true/, "");
          window.history.replaceState({}, "", newUrl);
        }, 1000);

        return () => clearTimeout(printTimer);
      }
    }

    // Reset printed receipt when drawer closes
    if (!receiptDrawerOpen) {
      printedReceiptIdRef.current = null;
    }
  }, [receiptDrawerOpen, receiptData, receiptSaleId]);

  const [groupedCategoryItems, setGroupedCategoryItems] = useState<
    GroupedItem[]
  >([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  useEffect(() => {
    if (!selectedCategoryId) {
      setGroupedCategoryItems([]);
      setCategorySearchQuery("");
      return;
    }

    async function fetchCategoryItems() {
      try {
        setItemsLoading(true);
        const result = await apiGetOffline<Item[]>(
          `/api/items?categoryId=${selectedCategoryId}`,
        );
        if (result.success) {
          const allItems = (result.data ?? []).filter((item) =>
            itemMatchesShopType(item, shopType),
          );
          const grouped = groupItemsByParent(allItems);
          setGroupedCategoryItems(grouped);
        }
      } catch (err) {
        console.error("Error fetching category items:", err);
      } finally {
        setItemsLoading(false);
      }
    }

    fetchCategoryItems();
  }, [selectedCategoryId, refreshKey, shopType]);

  const filteredGroupedCategoryItems = filterGroupedItems(
    groupedCategoryItems,
    categorySearchQuery,
  );

  const handleMobileItemClick = (item: ItemWithVariants) => {
    // All items are now directly selectable (variants or standalone)
    handleSelectItem(item);
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  return (
    <PosCashierOperationsProvider>
      <>
        {/* Mobile app shell */}
        <div className="md:hidden print:hidden bg-[#f6f8f6] dark:bg-[#132210] text-[#101b0d] dark:text-[#f0fdf4] h-[100dvh] w-full overflow-hidden flex flex-col antialiased">
          <PosShiftStatusBar variant="mobile" />
          <style jsx global>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          {mobileTab === "cart" ? (
            <PosMobileCartTab
              cartItemCount={cartItemCount}
              onClearCart={handleClearCart}
              onCheckout={() => setCheckoutDrawerOpen(true)}
              refreshTrigger={cartRefreshTrigger}
            />
          ) : mobileTab === "search" ? (
            <>
              <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center px-4 h-12">
                  <h1 className="text-[17px] font-bold text-slate-900 dark:text-white">
                    Search
                  </h1>
                </div>
              </header>
              <PosMobileSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                onSearchSubmit={handleSearchSubmit}
                onSearchKeyDown={handleSearchKeyDown}
                onClear={clearSearch}
                onOpenCamera={() => setBarcodeCameraOpen(true)}
                onFocus={handleSearchFocus}
                inputRef={mobileSearchInputRef}
                containerRef={searchContainerRef}
                isPending={isSearchPending}
                isScanning={barcodeScanStatus.scanning}
                isLoadingSuggestions={loadingSuggestions}
                suggestions={suggestionsMobile}
              />
              <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] px-3">
                {debouncedSearchQuery ? (
                  <ItemGrid
                    key="search-mobile"
                    categoryId={null}
                    searchQuery={debouncedSearchQuery}
                    searchDebounceMs={0}
                    prefetchedSearchItems={
                      searchGridQuery === debouncedSearchQuery
                        ? searchGridItems
                        : null
                    }
                    prefetchedSearchQuery={
                      searchGridQuery === debouncedSearchQuery
                        ? searchGridQuery
                        : undefined
                    }
                    onSelectItem={handleSelectItem}
                    onSelectParent={handleSelectParent}
                    onQuickAdd={handleQuickAdd}
                    shopType={shopType}
                    itemTypeKeys={itemTypeKeys}
                    categories={categories}
                    featuredItems={featuredItems}
                    lowStockItems={lowStockHomeItems}
                    outStockItems={outStockItems}
                    lowQuantityItems={lowQtyHomeItems}
                    stockListFilter="all"
                    canManageItemImages={isOwnerOrAdmin}
                    onItemImageUpdated={handleItemImageUpdated}
                    allowSellOutOfStock={allowSellOutOfStock}
                  />
                ) : (
                  <div className="py-12 text-center text-sm text-slate-500">
                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    Search by name or scan a barcode
                  </div>
                )}
              </main>
            </>
          ) : !selectedCategoryId ? (
            <>
              <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center justify-between px-3 h-12">
                  <button
                    aria-label="Browse categories"
                    className="pos-icon-btn"
                    onClick={() => setCategoryDrawerOpen(true)}
                  >
                    <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                  <h1 className="text-[17px] font-bold text-[#1c6a1e] leading-none tracking-tight truncate max-w-[52%]">
                    {user?.businessName || "POS"}
                  </h1>
                  <button
                    aria-label="Scan barcode"
                    className="pos-icon-btn"
                    onClick={() => setBarcodeCameraOpen(true)}
                  >
                    <Camera className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </header>

              <PosMobileSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                onSearchSubmit={handleSearchSubmit}
                onSearchKeyDown={handleSearchKeyDown}
                onClear={clearSearch}
                onOpenCamera={() => setBarcodeCameraOpen(true)}
                onFocus={handleSearchFocus}
                inputRef={mobileSearchInputRef}
                containerRef={searchContainerRef}
                isPending={isSearchPending}
                isScanning={barcodeScanStatus.scanning}
                isLoadingSuggestions={loadingSuggestions}
                suggestions={suggestionsMobile}
              />

              <main className="flex-1 overflow-y-auto no-scrollbar pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] px-3 flex flex-col min-h-0">
                {debouncedSearchQuery ? (
                  <div className="flex-1 min-h-0 flex flex-col -mx-1">
                    <ItemGrid
                      key="msearch"
                      categoryId={null}
                      searchQuery={debouncedSearchQuery}
                    searchDebounceMs={0}
                    prefetchedSearchItems={
                      searchGridQuery === debouncedSearchQuery
                        ? searchGridItems
                        : null
                    }
                    prefetchedSearchQuery={
                      searchGridQuery === debouncedSearchQuery
                        ? searchGridQuery
                        : undefined
                    }
                      onSelectItem={handleSelectItem}
                      onSelectParent={handleSelectParent}
                      onQuickAdd={handleQuickAdd}
                      shopType={shopType}
                      itemTypeKeys={itemTypeKeys}
                      categories={categories}
                      featuredItems={featuredItems}
                      lowStockItems={lowStockHomeItems}
                      outStockItems={outStockItems}
                      lowQuantityItems={lowQtyHomeItems}
                      stockListFilter="all"
                      canManageItemImages={isOwnerOrAdmin}
                      onItemImageUpdated={handleItemImageUpdated}
                      allowSellOutOfStock={allowSellOutOfStock}
                    />
                  </div>
                ) : (
                  <>
                    <PosCategoryChips
                      categories={filteredCategories}
                      onSelect={handleCategoryClick}
                    />

                    <div className="flex-1 min-h-0 flex flex-col mt-1 -mx-1">
                      <ItemGrid
                        key={`mhome-${refreshKey}`}
                        categoryId={null}
                        onSelectItem={handleSelectItem}
                        onSelectParent={handleSelectParent}
                        onQuickAdd={handleQuickAdd}
                        shopType={shopType}
                        itemTypeKeys={itemTypeKeys}
                        categories={categories}
                        featuredItems={featuredItems}
                        lowStockItems={lowStockHomeItems}
                        outStockItems={outStockItems}
                        lowQuantityItems={lowQtyHomeItems}
                        stockListFilter={
                          isOwnerOrAdmin ? posStockFilter : "all"
                        }
                        showLowStockStrip={isOwnerOrAdmin}
                        canManageItemImages={isOwnerOrAdmin}
                        onItemImageUpdated={handleItemImageUpdated}
                        allowSellOutOfStock={allowSellOutOfStock}
                      />
                    </div>
                  </>
                )}
              </main>
            </>
          ) : (
            <>
              <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
                <div className="flex items-center gap-2 px-3 h-12">
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className="pos-icon-btn flex-shrink-0"
                    aria-label="Back to home"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                  <h1 className="flex-1 min-w-0 text-[17px] font-bold text-slate-800 dark:text-white truncate leading-none">
                    {selectedCategory?.name || "Category"}
                  </h1>
                </div>
              </header>

              <PosMobileSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                onSearchSubmit={handleSearchSubmit}
                onSearchKeyDown={handleSearchKeyDown}
                onClear={clearSearch}
                onOpenCamera={() => setBarcodeCameraOpen(true)}
                onFocus={handleSearchFocus}
                inputRef={mobileSearchInputRef}
                containerRef={searchContainerRef}
                isPending={isSearchPending}
                isScanning={barcodeScanStatus.scanning}
                isLoadingSuggestions={loadingSuggestions}
                suggestions={suggestionsMobile}
              />

              {!debouncedSearchQuery && (
                <div className="px-3 pb-2 pt-1 bg-[#f6f8f6] dark:bg-[#132210] border-b border-black/5 dark:border-white/5">
                  <div className="relative max-w-3xl mx-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder={`Filter in ${selectedCategory?.name.toLowerCase()}...`}
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      className="pl-9 pr-9 h-10 bg-white dark:bg-[#1c2e18] rounded-xl border-gray-200 dark:border-gray-700 focus:border-[#1c6a1e] focus:ring-2 focus:ring-[#1c6a1e]/20 text-sm"
                    />
                  </div>
                </div>
              )}

              <main className="flex-1 overflow-y-auto no-scrollbar pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] px-5 sm:px-6">
                {debouncedSearchQuery ? (
                  <ItemGrid
                    key="csearch"
                    categoryId={null}
                    searchQuery={debouncedSearchQuery}
                    searchDebounceMs={0}
                    prefetchedSearchItems={
                      searchGridQuery === debouncedSearchQuery
                        ? searchGridItems
                        : null
                    }
                    prefetchedSearchQuery={
                      searchGridQuery === debouncedSearchQuery
                        ? searchGridQuery
                        : undefined
                    }
                    onSelectItem={handleSelectItem}
                    onSelectParent={handleSelectParent}
                    onQuickAdd={handleQuickAdd}
                    shopType={shopType}
                    itemTypeKeys={itemTypeKeys}
                    categories={categories}
                    featuredItems={featuredItems}
                    lowStockItems={lowStockHomeItems}
                    outStockItems={outStockItems}
                    lowQuantityItems={lowQtyHomeItems}
                    stockListFilter="all"
                    canManageItemImages={isOwnerOrAdmin}
                    onItemImageUpdated={handleItemImageUpdated}
                    allowSellOutOfStock={allowSellOutOfStock}
                  />
                ) : itemsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-4 border-[#1c6a1e]/20 border-t-[#1c6a1e] rounded-none animate-spin"></div>
                  </div>
                ) : filteredGroupedCategoryItems.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500">
                      {categorySearchQuery
                        ? `No items found for "${categorySearchQuery}"`
                        : "No items in this category"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8 py-4">
                    {filteredGroupedCategoryItems.map((group, groupIndex) => {
                      if (
                        group.type === "parent" &&
                        group.parent &&
                        group.children &&
                        group.children.length > 0
                      ) {
                        return (
                          <div
                            key={group.parent.id}
                            className="space-y-4 bg-gradient-to-br from-[#1c6a1e]/5 via-transparent to-[#2a8a30]/5 dark:from-[#1c6a1e]/10 dark:via-transparent dark:to-[#2a8a30]/10 rounded-none p-4 sm:p-5 border border-[#1c6a1e]/10 dark:border-[#1c6a1e]/20"
                          >
                            {/* Parent Label */}
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#1c6a1e]/20 dark:border-[#1c6a1e]/30"></div>
                              </div>
                              <div className="relative flex justify-center">
                                <div className="px-5 py-2.5 bg-[#1c6a1e] bg-gradient-to-r from-[#1c6a1e] to-[#2a8a30] rounded-none shadow-lg shadow-[#1c6a1e]/30 border-2 border-white dark:border-[#132210]">
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
                                  className="pos-grid-btn bg-gradient-to-b from-[#1c2e18] to-[#152a14] dark:from-[#132210] dark:to-[#0f1d0e] rounded-none border-2 border-[#1c6a1e] dark:border-[#2a8a30] overflow-hidden relative group"
                                >
                                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-2xl overflow-hidden relative">
                                    {group.parent &&
                                    resolveItemImageUrl(group.parent) ? (
                                      <img
                                        src={resolveItemImageUrl(group.parent)!}
                                        alt={item.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                        onError={(e) => {
                                          const target =
                                            e.target as HTMLImageElement;
                                          const parentEl = target.parentElement;
                                          if (parentEl) {
                                            parentEl.innerHTML =
                                              '<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800"><svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-12 h-12 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <h3 className="font-bold text-xs text-left mb-1 text-white leading-tight uppercase tracking-tight break-words">
                                      {item.name}
                                    </h3>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="bg-gradient-to-r from-[#1c6a1e] to-[#2ab88a] text-white font-bold text-sm px-3 py-1.5 rounded-none shadow-lg shadow-[#1c6a1e]/25">
                                          {formatPrice(item.current_sell_price)}
                                        </span>
                                        <span className="text-xs text-white/70 font-medium">
                                          / {item.unit_type}
                                        </span>
                                      </div>
                                      {/* Bundle Pricing Badge */}
                                      {item.bundle_quantity &&
                                        item.bundle_price &&
                                        item.bundle_quantity > 0 &&
                                        item.bundle_price > 0 && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                              <Tag className="w-2.5 h-2.5" />
                                              {item.bundle_name ||
                                                `${item.bundle_quantity} for ${formatPrice(item.bundle_price)}`}
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
                      } else if (group.type === "standalone" && group.item) {
                        return (
                          <div
                            key={group.item.id}
                            className="flex justify-center"
                          >
                            <button
                              onClick={() => handleMobileItemClick(group.item!)}
                              className="pos-grid-btn bg-gradient-to-b from-[#1c2e18] to-[#152a14] dark:from-[#132210] dark:to-[#0f1d0e] rounded-none border-2 border-[#1c6a1e] dark:border-[#2a8a30] overflow-hidden relative group w-full max-w-xs"
                            >
                              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-2xl overflow-hidden relative">
                                {resolveItemImageUrl(group.item!) ? (
                                  <img
                                    src={resolveItemImageUrl(group.item!)!}
                                    alt={group.item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      const parentEl = target.parentElement;
                                      if (parentEl) {
                                        parentEl.innerHTML =
                                          '<div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800"><svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-12 h-12 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2">
                                <h3 className="font-bold text-xs text-left mb-1 text-white leading-tight uppercase tracking-tight break-words">
                                  {group.item.name}
                                </h3>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-gradient-to-r from-[#1c6a1e] to-[#2ab88a] text-white font-bold text-sm px-3 py-1.5 rounded-none shadow-lg shadow-[#1c6a1e]/25">
                                      {formatPrice(
                                        group.item.current_sell_price,
                                      )}
                                    </span>
                                    <span className="text-xs text-white/70 font-medium">
                                      / {group.item.unit_type}
                                    </span>
                                  </div>
                                  {/* Bundle Pricing Badge */}
                                  {group.item.bundle_quantity &&
                                    group.item.bundle_price &&
                                    group.item.bundle_quantity > 0 &&
                                    group.item.bundle_price > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                                          <Tag className="w-2.5 h-2.5" />
                                          {group.item.bundle_name ||
                                            `${group.item.bundle_quantity} for ${formatPrice(group.item.bundle_price)}`}
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

          <PosBottomNav
            activeTab={mobileTab}
            onTabChange={handleMobileTabChange}
            onMorePress={() => setMoreSheetOpen(true)}
            cartItemCount={cartItemCount}
            orphanedCount={departmentOrphanedCount}
          />

          <PosMobileMoreSheet
            open={moreSheetOpen}
            onOpenChange={setMoreSheetOpen}
            businessName={user?.businessName ?? undefined}
            canAccessAdmin={canAccessAdmin}
            canProcessReturn={canProcessReturn}
            isOwnerOrAdmin={isOwnerOrAdmin}
            posStockFilter={posStockFilter}
            posStockStats={posStockStats}
            refreshing={refreshing}
            onShopTypeChange={handleShopTypeChange}
            onRefresh={handleRefresh}
            onStockFilterChange={setPosStockFilter}
            onOutOfStock={() => setOutOfStockModalOpen(true)}
            onReturns={() => setReturnsDialogOpen(true)}
            onLogout={() => signOut({ callbackUrl: "/pos/login" })}
          />
        </div>

        {/* Desktop Original Design */}
        <div className="hidden md:block print:hidden">
          <POSLayout
            header={
              <>
                <PosDesktopHeader
                  businessName={user?.businessName ?? undefined}
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  onSearchSubmit={handleSearchSubmit}
                  onSearchKeyDown={handleSearchKeyDown}
                  onSearchFocus={handleSearchFocus}
                  onClearSearch={clearSearch}
                  onOpenCamera={() => setBarcodeCameraOpen(true)}
                  searchInputRef={searchInputRef}
                  searchContainerRef={desktopSearchContainerRef}
                  isSearchPending={isSearchPending}
                  isScanning={barcodeScanStatus.scanning}
                  isValidBarcode={isValidBarcode}
                  showSuggestions={showSuggestions}
                  loadingSuggestions={loadingSuggestions}
                  suggestions={suggestionsDesktop}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  statsMenuOpen={statsMenuOpen}
                  onStatsMenuToggle={() => setStatsMenuOpen((o) => !o)}
                  statsMenuRef={statsMenuRefDesktop}
                  posStockFilter={posStockFilter}
                  posStockStats={posStockStats}
                  onStockFilterChange={(filter) => {
                    setPosStockFilter(filter);
                    setStatsMenuOpen(false);
                  }}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                  onOutOfStock={() => setOutOfStockModalOpen(true)}
                  canProcessReturn={canProcessReturn}
                  onReturns={() => setReturnsDialogOpen(true)}
                  canAccessAdmin={canAccessAdmin}
                  onLogout={() => signOut({ callbackUrl: "/pos/login" })}
                  cartItemCount={cartItemCount}
                  cartTotal={cartTotal}
                  cartsCount={carts.length}
                  orphanedCount={departmentOrphanedCount}
                  onClearCart={handleClearCart}
                />
              </>
            }
          >
            <div className="flex flex-1 min-h-0 h-full overflow-hidden">
              <PosDepartmentRail onShopTypeChange={handleShopTypeChange} />
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                {!debouncedSearchQuery && !searchQuery && (
                  <div className="flex-shrink-0 border-b border-gray-200 bg-white/50 backdrop-blur-sm">
                    <CategoryList
                      onSelectCategory={handleCategoryClick}
                      selectedCategoryId={selectedCategoryId || undefined}
                      shopType={shopType}
                      categories={categories}
                    />
                  </div>
                )}
                <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-transparent to-gray-50/50 flex flex-col">
                  <div className="min-h-full flex flex-col px-3 sm:px-4 lg:px-6">
                    <ItemGrid
                      key={
                        debouncedSearchQuery
                          ? "grid-search"
                          : `grid-${selectedCategoryId ?? "home"}-${refreshKey}`
                      }
                        categoryId={
                          debouncedSearchQuery ? null : selectedCategoryId
                        }
                        searchQuery={debouncedSearchQuery || undefined}
                        searchDebounceMs={debouncedSearchQuery ? 0 : undefined}
                        prefetchedSearchItems={
                          debouncedSearchQuery &&
                          searchGridQuery === debouncedSearchQuery
                            ? searchGridItems
                            : null
                        }
                        prefetchedSearchQuery={
                          debouncedSearchQuery &&
                          searchGridQuery === debouncedSearchQuery
                            ? searchGridQuery
                            : undefined
                        }
                        onSelectItem={handleSelectItem}
                        onSelectParent={handleSelectParent}
                        onQuickAdd={handleQuickAdd}
                        shopType={shopType}
                        itemTypeKeys={itemTypeKeys}
                        categories={categories}
                        featuredItems={featuredItems}
                        lowStockItems={lowStockHomeItems}
                        outStockItems={outStockItems}
                        lowQuantityItems={lowQtyHomeItems}
                        stockListFilter={
                          debouncedSearchQuery ||
                          selectedCategoryId ||
                          !isOwnerOrAdmin
                            ? "all"
                            : posStockFilter
                        }
                        showLowStockStrip={isOwnerOrAdmin}
                        canManageItemImages={isOwnerOrAdmin}
                        onItemImageUpdated={handleItemImageUpdated}
                        allowSellOutOfStock={allowSellOutOfStock}
                      />
                    </div>
                </div>
              </div>
              <PosCartColumn
                carts={carts}
                activeCart={activeCart}
                cartItemCount={cartItemCount}
                cartTotal={cartTotal}
                onCheckout={() => setCheckoutDrawerOpen(true)}
                refreshTrigger={cartRefreshTrigger}
              />
            </div>
          </POSLayout>
        </div>

        <AddToCartDialog
          item={selectedItem}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          allowStockEdit={isOwnerOrAdmin}
          allowSellOutOfStock={allowSellOutOfStock}
          onItemStockUpdated={(itemId, newStock) => {
            setSelectedItem((prev) =>
              prev && prev.id === itemId
                ? { ...prev, current_stock: newStock }
                : prev,
            );
            setRefreshKey((k) => k + 1);
          }}
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
              <div className="relative bg-white dark:bg-slate-900 rounded-none shadow-2xl shadow-slate-900/10 border border-slate-200/80 dark:border-slate-700/60 backdrop-blur-xl overflow-hidden">
                <div className="p-6">
                  {/* Header Section */}
                  <div className="flex items-start gap-4 mb-5">
                    {/* Icon Container */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-none bg-red-50 dark:bg-red-950/30 flex items-center justify-center border border-red-100/50 dark:border-red-900/30">
                      <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Clear Cart?
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {activeCart?.pendingSaleId ? (
                          activeCart.pendingSaleIsDepartment ? (
                            <>
                              This cart is linked to a department order.
                              Clearing removes all{" "}
                              <span className="font-medium text-gray-900 dark:text-gray-200">
                                {cartItemCount}
                              </span>{" "}
                              {cartItemCount === 1 ? "item" : "items"} and
                              discards the order on the server.
                            </>
                          ) : (
                            <>
                              This cart is linked to a saved sale. Clearing
                              removes all{" "}
                              <span className="font-medium text-gray-900 dark:text-gray-200">
                                {cartItemCount}
                              </span>{" "}
                              {cartItemCount === 1 ? "item" : "items"} and
                              discards it on the server.
                            </>
                          )
                        ) : (
                          <>
                            Remove all{" "}
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                              {cartItemCount}
                            </span>{" "}
                            {cartItemCount === 1 ? "item" : "items"} from your
                            cart?
                          </>
                        )}
                      </p>
                    </div>

                    {/* Close Button */}
                    <button
                      onClick={cancelClearCart}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={cancelClearCart}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 pos-btn-outline rounded-none font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmClearCart}
                      size="sm"
                      className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-none shadow-lg shadow-red-500/25 transition-all active:scale-[0.98]"
                    >
                      Clear Cart
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <BarcodeCameraScannerDialog
          open={barcodeCameraOpen}
          onOpenChange={setBarcodeCameraOpen}
          onScan={handleCameraBarcode}
        />

        {/* Barcode Scan Status Notification */}
        {(barcodeScanStatus.scanning ||
          barcodeScanStatus.error ||
          barcodeScanStatus.success) && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300 print:hidden">
            <div
              className={`
            flex items-center gap-3 px-5 py-3.5 rounded-none shadow-xl border backdrop-blur-md
            ${
              barcodeScanStatus.scanning
                ? "bg-blue-50/95 dark:bg-blue-950/80 border-blue-200/80 dark:border-blue-800/50 text-blue-800 dark:text-blue-200"
                : barcodeScanStatus.error
                  ? "bg-red-50/95 dark:bg-red-950/80 border-red-200/80 dark:border-red-800/50 text-red-800 dark:text-red-200"
                  : "bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200/80 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200"
            }
          `}
            >
              {barcodeScanStatus.scanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <div>
                    <p className="font-semibold text-sm">Scanning barcode...</p>
                    <p className="text-xs opacity-75">
                      {barcodeScanStatus.lastScanned}
                    </p>
                  </div>
                </>
              ) : barcodeScanStatus.error ? (
                <>
                  <div className="w-8 h-8 rounded-none bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Barcode not found</p>
                    <p className="text-xs opacity-75">
                      {barcodeScanStatus.lastScanned}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-none bg-green-100 flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Product found!</p>
                    <p className="text-xs opacity-75">
                      {barcodeScanStatus.lastScanned}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <PosCategoryDrawer
          open={categoryDrawerOpen}
          onOpenChange={setCategoryDrawerOpen}
          categoryId={drawerCategoryId}
          categoryName={
            drawerCategoryId
              ? filteredCategories.find((c) => c.id === drawerCategoryId)?.name ??
                null
              : null
          }
          shopType={shopType}
          refreshKey={refreshKey}
          onSelectItem={handleSelectItem}
        />

        
        <PosTransactionDrawers
          checkoutDrawerOpen={checkoutDrawerOpen}
          onCheckoutDrawerOpenChange={setCheckoutDrawerOpen}
          receiptDrawerOpen={receiptDrawerOpen}
          onReceiptDrawerOpenChange={setReceiptDrawerOpen}
          cartIsColumn={isWideViewport}
          onOpenCartDrawer={() => {
            if (isWideViewport) {
              setCartDrawerOpen(true);
            } else {
              setMobileTab("cart");
            }
          }}
          receiptLoading={receiptLoading}
          receiptError={receiptError}
          receiptData={receiptData}
          onSaleComplete={(saleId, pendingSaleId) => {
            const completedPendingId = pendingSaleId ?? saleId;
            removeSale(completedPendingId);
            clearCartByPendingSaleId(completedPendingId);
            void refreshPendingSales();
            setCartRefreshTrigger((k) => k + 1);
            setCheckoutDrawerOpen(false);
            setReceiptSaleId(saleId);
            setReceiptDrawerOpen(true);
            const url = new URL(window.location.href);
            url.searchParams.set("print", "true");
            window.history.replaceState({}, "", url.toString());
          }}
          onDirectPrint={handleDirectPrint}
          onContinueShoppingFromReceipt={() => {
            setReceiptDrawerOpen(false);
            setCartDrawerOpen(false);
            setCheckoutDrawerOpen(false);
            if (!isWideViewport) {
              setMobileTab("sell");
            }
          }}
        />

        <OutOfStockRequestModal
          open={outOfStockModalOpen}
          onOpenChange={setOutOfStockModalOpen}
        />

        <PosReturnsDialog
          open={returnsDialogOpen}
          onOpenChange={setReturnsDialogOpen}
        />
      </>
    </PosCashierOperationsProvider>
  );
}
