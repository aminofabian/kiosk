"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { POSLayout } from "@/components/layouts/pos-layout";
import { CategoryList } from "@/components/pos/CategoryList";
import { ItemGrid } from "@/components/pos/ItemGrid";
import { AddToCartDialog } from "@/components/pos/AddToCartDialog";
import { OutOfStockRequestModal } from "@/components/pos/OutOfStockRequestModal";
import { VariantSelector } from "@/components/pos/VariantSelector";
import { PosClearCacheButton } from "@/components/pos/PosClearCacheButton";
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
import {
  PosCashierOperationsProvider,
  PosShiftStatusBar,
} from "@/components/pos/PosCashierOperations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { searchItemsOffline } from "@/lib/offline/search";
import { ShopTypeSelector } from "@/components/pos/ShopTypeSelector";
import {
  getShopType,
  itemMatchesShopType,
  shouldShowCategory,
} from "@/lib/utils/shop-type";
import { useItemTypes } from "@/lib/hooks/use-item-types";
import { storeUserRole, clearUserRole } from "@/lib/utils/user-role-storage";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  useBarcodeScanner,
  isValidBarcode,
} from "@/lib/hooks/use-barcode-scanner";
import { BarcodeCameraScannerDialog } from "@/components/pos/BarcodeCameraScannerDialog";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
} from "@/lib/utils/recent-searches";
import { Clock, Command } from "lucide-react";
import {
  CATEGORY_COLOR_MAP,
  CATEGORY_ICON_MAP,
  CATEGORY_IMAGE_MAP,
} from "@/lib/pos/category-maps";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
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
  const [drawerCategoryItems, setDrawerCategoryItems] = useState<
    ItemWithVariants[]
  >([]);
  const [drawerGroupedItems, setDrawerGroupedItems] = useState<GroupedItem[]>(
    [],
  );
  const [drawerItemsLoading, setDrawerItemsLoading] = useState(false);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<
    {
      id: string;
      name: string;
      variant_name?: string | null;
      current_sell_price: number;
      unit_type?: string;
      category_name?: string | null;
      parent_item_id?: string | null;
      parent_name?: string | null;
      sibling_count?: number;
      batch_number?: string | null;
    }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionsAbortRef = useRef<AbortController | null>(null);
  const flatSuggestionsRef = useRef<typeof searchSuggestions>([]);
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

  // SSE connection for real-time events
  useDepartmentEvents({
    role: user?.role,
    userId: user?.id,
    businessId: user?.businessId,
    onForwarded: () => {
      void refreshPendingSales();
      setCartRefreshTrigger((k) => k + 1);
    },
    onCompleted: (event) => {
      const pendingSaleId = event.data.pendingSaleId;
      if (typeof pendingSaleId === "string") {
        removeSale(pendingSaleId);
        clearCartByPendingSaleId(pendingSaleId);
      }
      void refreshPendingSales();
      setCartRefreshTrigger((k) => k + 1);
    },
    onQueueUpdate: (event) => {
      const pendingSaleId = event.data.pendingSaleId;
      if (
        event.data.action === "completed" &&
        typeof pendingSaleId === "string"
      ) {
        removeSale(pendingSaleId);
        clearCartByPendingSaleId(pendingSaleId);
      }
      void refreshPendingSales();
      setCartRefreshTrigger((k) => k + 1);
    },
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

  // Debounced search - 50ms for suggestions (instant feel), 80ms for item grid
  const debouncedSearchQuery = useDebounce(searchQuery, 80);
  const quickDebouncedSearchQuery = useDebounce(searchQuery, 50);
  const isSearchPending =
    searchQuery !== debouncedSearchQuery && searchQuery.length > 0;

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
        setShowSuggestions(false);
        setSearchQuery("");
        setShowSearch(false);
        setSearchSuggestions([]);

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
    [searchQuery, handleBarcodeScan, showSuggestions, selectedSuggestionIndex],
  );

  // Handle keyboard navigation in suggestions
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || searchSuggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < searchSuggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : searchSuggestions.length - 1,
        );
      }
    },
    [showSuggestions, searchSuggestions.length],
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

  // Load recent searches on mount
  useEffect(() => {
    const searches = getRecentSearches();
    setRecentSearches(searches.map((s) => s.query));
  }, []);

  // Save search when user commits to a search
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery.length >= 2) {
      addRecentSearch(debouncedSearchQuery);
      // Update local state
      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== debouncedSearchQuery.toLowerCase(),
        );
        return [debouncedSearchQuery, ...filtered].slice(0, 8);
      });
    }
  }, [debouncedSearchQuery]);

  // In-memory suggestion cache to avoid redundant requests
  const suggestCacheRef = useRef<
    Map<string, { data: typeof searchSuggestions; ts: number }>
  >(new Map());
  const SUGGEST_CACHE_TTL = 5 * 60_000; // 5 minutes

  const mapSuggestItem = useCallback(
    (item: {
      id: string;
      name: string;
      variant_name?: string | null;
      current_sell_price: number;
      unit_type?: string;
      category_name?: string | null;
      parent_item_id?: string | null;
      parent_name?: string | null;
      sibling_count?: number;
      batch_number?: string | null;
    }) => ({
      id: item.id,
      name: item.name,
      variant_name: item.variant_name,
      current_sell_price: item.current_sell_price,
      unit_type: item.unit_type,
      category_name: item.category_name,
      parent_item_id: item.parent_item_id,
      parent_name: item.parent_name,
      sibling_count: item.sibling_count,
      batch_number: item.batch_number,
    }),
    [],
  );

  const filterSuggestionsForQuery = useCallback(
    (
      suggestions: typeof searchSuggestions,
      query: string,
    ): typeof searchSuggestions => {
      const q = query.toLowerCase().trim();
      if (!q) return suggestions;
      const filtered = suggestions.filter((s) => {
        const hay =
          `${s.name} ${s.variant_name ?? ""} ${s.parent_name ?? ""} ${s.category_name ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
      return filtered.length > 0 ? filtered : suggestions;
    },
    [],
  );

  const findWarmSuggestionCache = useCallback((query: string) => {
    const key = query.toLowerCase().trim();
    const exact = suggestCacheRef.current.get(key);
    if (exact) return exact;
    for (let len = key.length - 1; len >= 1; len--) {
      const prefix = suggestCacheRef.current.get(key.slice(0, len));
      if (prefix) return prefix;
    }
    return null;
  }, []);

  // Fetch search suggestions: offline = cached search, online = /api/items/suggest
  useEffect(() => {
    const suggestionQuery = quickDebouncedSearchQuery.trim();
    if (suggestionsAbortRef.current) {
      suggestionsAbortRef.current.abort();
    }

    if (!suggestionQuery || suggestionQuery.length < 1) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (isValidBarcode(suggestionQuery)) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const cacheKey = suggestionQuery.toLowerCase();
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    const applySuggestions = (suggestions: typeof searchSuggestions) => {
      setSearchSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
      setSelectedSuggestionIndex(-1);
    };

    // Offline: search cached items
    if (isOffline) {
      setLoadingSuggestions(true);
      searchItemsOffline(suggestionQuery, 10)
        .then((suggestions) => {
          applySuggestions(suggestions);
        })
        .catch((err) => console.error("Offline search error:", err))
        .finally(() => setLoadingSuggestions(false));
      return;
    }

    // Show prefix/exact cache instantly while fetching updated results
    const warmCache = findWarmSuggestionCache(cacheKey);
    if (warmCache) {
      applySuggestions(filterSuggestionsForQuery(warmCache.data, cacheKey));
    }

    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < SUGGEST_CACHE_TTL) {
      applySuggestions(cached.data);
      setLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    suggestionsAbortRef.current = controller;
    let cancelled = false;

    async function fetchSuggestions() {
      if (cancelled) return;
      try {
        if (!warmCache) setLoadingSuggestions(true);
        const response = await fetch(
          `/api/items/suggest?q=${encodeURIComponent(suggestionQuery)}&limit=10`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (cancelled) return;

        const result = await response.json();

        if (cancelled) return;
        if (result.success && result.data) {
          const suggestions = result.data.map(mapSuggestItem);
          suggestCacheRef.current.set(cacheKey, {
            data: suggestions,
            ts: Date.now(),
          });
          if (suggestCacheRef.current.size > 50) {
            const oldest = [...suggestCacheRef.current.entries()].sort(
              (a, b) => a[1].ts - b[1].ts,
            )[0];
            if (oldest) suggestCacheRef.current.delete(oldest[0]);
          }
          applySuggestions(suggestions);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Error fetching suggestions:", err);
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    quickDebouncedSearchQuery,
    mapSuggestItem,
    filterSuggestionsForQuery,
    findWarmSuggestionCache,
  ]);

  // Close suggestions when clicking outside (use 'click' so suggestion button onClick runs first)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMobile = searchContainerRef.current?.contains(target);
      const insideDesktop = desktopSearchContainerRef.current?.contains(target);
      if (!insideMobile && !insideDesktop) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback(
    async (suggestion: { id: string; name: string }) => {
      setShowSuggestions(false);
      setSearchQuery("");
      setShowSearch(false);

      // Fetch the full item details and open the dialog
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
    [],
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
    setSearchQuery("");
    setSearchSuggestions([]);
    setShowSuggestions(false);
  }, []);

  // Highlight matching text segments in search results
  // Supports exact substring → word-level → fuzzy character-level matching
  const MARK_CLASS =
    "bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/15 text-[#1c6a1e] dark:text-[#2a8a30] font-semibold rounded-[1px] px-[0.5px]";

  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query || query.length < 1) return <>{text}</>;

    // First try exact contiguous match (fastest, cleanest highlights)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    if (regex.test(text)) {
      const parts = text.split(regex);
      regex.lastIndex = 0;
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark
                key={i}
                className={MARK_CLASS}
                style={{ textDecoration: "none" }}
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </>
      );
    }

    // Try matching individual words from the query
    const words = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (words.length > 1) {
      const wordPattern = words
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const wordRegex = new RegExp(`(${wordPattern})`, "gi");
      if (wordRegex.test(text)) {
        const parts = text.split(wordRegex);
        wordRegex.lastIndex = 0;
        return (
          <>
            {parts.map((part, i) =>
              wordRegex.test(part) ? (
                <mark
                  key={i}
                  className={MARK_CLASS}
                  style={{ textDecoration: "none" }}
                >
                  {part}
                </mark>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </>
        );
      }
    }

    // Fuzzy fallback: highlight characters that match query chars in order
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndices = new Set<number>();
    let qi = 0;
    for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
      if (lowerText[ti] === lowerQuery[qi]) {
        matchIndices.add(ti);
        qi++;
      }
    }

    if (matchIndices.size === 0) return <>{text}</>;

    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < text.length) {
      if (matchIndices.has(i)) {
        let end = i;
        while (end < text.length && matchIndices.has(end)) end++;
        elements.push(
          <mark
            key={i}
            className={MARK_CLASS}
            style={{ textDecoration: "none" }}
          >
            {text.slice(i, end)}
          </mark>,
        );
        i = end;
      } else {
        let end = i;
        while (end < text.length && !matchIndices.has(end)) end++;
        elements.push(<span key={i}>{text.slice(i, end)}</span>);
        i = end;
      }
    }
    return <>{elements}</>;
  }, []);

  // Group suggestions by parent for variant display
  // Only groups items that share a parent AND have siblings (sibling_count > 1)
  type SuggestionGroup =
    | {
        type: "standalone";
        item: (typeof searchSuggestions)[0];
      }
    | {
        type: "variant-group";
        parentId: string;
        parentName: string;
        items: typeof searchSuggestions;
      };

  const groupedSuggestionsData = (() => {
    if (searchSuggestions.length === 0)
      return {
        groups: [] as SuggestionGroup[],
        flatItems: [] as typeof searchSuggestions,
      };

    const parentBuckets = new Map<string, typeof searchSuggestions>();
    const standalone: typeof searchSuggestions = [];

    for (const s of searchSuggestions) {
      // Only group if item has a parent AND there are multiple siblings
      if (
        s.parent_item_id &&
        s.parent_name &&
        s.sibling_count &&
        s.sibling_count > 1
      ) {
        if (!parentBuckets.has(s.parent_item_id)) {
          parentBuckets.set(s.parent_item_id, []);
        }
        parentBuckets.get(s.parent_item_id)!.push(s);
      } else {
        standalone.push(s);
      }
    }

    const groups: SuggestionGroup[] = [];

    // Add variant groups (multiple results from same parent shown as group)
    for (const [parentId, items] of parentBuckets) {
      if (items.length > 1) {
        groups.push({
          type: "variant-group",
          parentId,
          parentName: items[0].parent_name!,
          items,
        });
      } else {
        // Single variant found — show inline as standalone with variant context
        standalone.push(items[0]);
      }
    }

    // Add standalone items
    for (const item of standalone) {
      groups.push({ type: "standalone", item });
    }

    // Build flat items list for keyboard navigation index mapping
    const flatItems: typeof searchSuggestions = [];
    for (const g of groups) {
      if (g.type === "variant-group") {
        for (const item of g.items) flatItems.push(item);
      } else {
        flatItems.push(g.item);
      }
    }

    // Keep ref in sync for keyboard submit handler
    flatSuggestionsRef.current = flatItems;

    return { groups, flatItems };
  })();

  // Shared search suggestions dropdown renderer
  const renderSuggestionsDropdown = useCallback(
    (isDesktop = false) => {
      const showSkeleton =
        loadingSuggestions &&
        searchQuery &&
        searchSuggestions.length === 0 &&
        !showSuggestions &&
        !debouncedSearchQuery;
      const showResults = showSuggestions && searchSuggestions.length > 0;
      const showNoResults =
        !loadingSuggestions &&
        searchQuery.length >= 2 &&
        searchSuggestions.length === 0 &&
        !showSuggestions &&
        !isSearchPending &&
        !debouncedSearchQuery;

      if (!showSkeleton && !showResults && !showNoResults) return null;

      const { groups, flatItems } = groupedSuggestionsData;

      let flatIndex = -1;

      const renderItem = (
        suggestion: (typeof searchSuggestions)[0],
        isVariant: boolean,
        isLastInGroup: boolean,
      ) => {
        flatIndex++;
        const currentFlatIndex = flatIndex;
        const isSelected = currentFlatIndex === selectedSuggestionIndex;

        return (
          <button
            key={suggestion.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectSuggestion(suggestion);
            }}
            onMouseEnter={() => setSelectedSuggestionIndex(currentFlatIndex)}
            className={`w-full flex items-center gap-2.5 text-left transition-colors duration-75 ${
              isVariant
                ? `pl-3 pr-3 py-[9px] ${!isLastInGroup ? "border-b border-gray-100/60 dark:border-gray-800/40" : ""}`
                : "px-3 py-[10px]"
            } ${
              isSelected
                ? "bg-[#1c6a1e]/[0.06] dark:bg-[#1c6a1e]/10"
                : "hover:bg-gray-50/80 dark:hover:bg-white/[0.03]"
            }`}
          >
            {/* Icon */}
            <div
              className={`${isVariant ? "w-7 h-7" : "w-9 h-9"} rounded-[3px] flex items-center justify-center flex-shrink-0 transition-all duration-100 ${
                isSelected
                  ? "bg-[#1c6a1e] shadow-sm shadow-[#1c6a1e]/20"
                  : isVariant
                    ? "bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/40"
                    : "bg-gray-100 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/40"
              }`}
            >
              {isVariant ? (
                <Tag
                  className={`w-3 h-3 ${isSelected ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
                />
              ) : (
                <Package
                  className={`w-4 h-4 ${isSelected ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
                />
              )}
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <div
                className={`${isVariant ? "text-[12.5px]" : "text-[13px]"} font-medium truncate leading-snug transition-colors ${
                  isSelected
                    ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {isVariant && suggestion.variant_name
                  ? highlightMatch(suggestion.variant_name, searchQuery)
                  : highlightMatch(suggestion.name, searchQuery)}
              </div>
              <div className="flex items-center gap-1 mt-[2px] flex-wrap">
                {!isVariant &&
                  suggestion.variant_name &&
                  suggestion.sibling_count &&
                  suggestion.sibling_count > 1 &&
                  suggestion.parent_name && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {highlightMatch(suggestion.parent_name, searchQuery)} ›
                    </span>
                  )}
                {!isVariant && suggestion.variant_name && (
                  <span className="text-[10.5px] text-gray-400 dark:text-gray-500 truncate">
                    {highlightMatch(suggestion.variant_name, searchQuery)}
                  </span>
                )}
                {suggestion.category_name && (
                  <span
                    className={`text-[9.5px] font-medium px-1.5 py-[1px] rounded-[2px] flex-shrink-0 ${
                      isSelected
                        ? "text-[#1c6a1e]/70 dark:text-[#2a8a30]/60 bg-[#1c6a1e]/[0.06] dark:bg-[#1c6a1e]/10"
                        : "text-gray-400 dark:text-gray-500 bg-gray-100/80 dark:bg-gray-800/60"
                    }`}
                  >
                    {suggestion.category_name}
                  </span>
                )}
                {suggestion.batch_number && (
                  <span className="text-[9.5px] font-mono text-slate-500 dark:text-slate-400">
                    Lot: {suggestion.batch_number}
                  </span>
                )}
              </div>
            </div>

            {/* Price + unit */}
            <div className="flex flex-col items-end flex-shrink-0 ml-auto pl-2">
              <span
                className={`text-[13px] font-semibold tabular-nums transition-colors leading-tight ${
                  isSelected
                    ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                    : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {suggestion.current_sell_price.toFixed(0)}
              </span>
              <span
                className={`text-[9.5px] tabular-nums transition-colors ${
                  isSelected
                    ? "text-[#1c6a1e]/50 dark:text-[#2a8a30]/40"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                KES{suggestion.unit_type ? `/${suggestion.unit_type}` : ""}
              </span>
            </div>
          </button>
        );
      };

      return (
        <div
          className={`absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#192e15] border border-gray-200/90 dark:border-gray-700/50 shadow-xl shadow-black/[0.08] dark:shadow-black/30 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 rounded-[4px] ${isDesktop ? "max-h-[440px]" : "max-h-[65vh]"}`}
        >
          {/* Skeleton loading */}
          {showSkeleton && (
            <div className="p-1.5">
              {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-[10px]"
                >
                  <div className="w-9 h-9 rounded-[3px] bg-gray-100 dark:bg-gray-800/70 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div
                      className="h-3.5 bg-gray-100 dark:bg-gray-800/70 rounded-[2px] animate-pulse"
                      style={{ width: `${w * 60}%` }}
                    />
                    <div
                      className="h-2.5 bg-gray-50 dark:bg-gray-800/40 rounded-[2px] animate-pulse"
                      style={{ width: `${w * 35}%` }}
                    />
                  </div>
                  <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800/70 rounded-[2px] animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Results list */}
          {showResults && (
            <>
              {/* Header bar */}
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-black/10">
                <div className="flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      {flatItems.length}
                    </span>{" "}
                    result{flatItems.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  className="flex h-5 w-5 items-center justify-center rounded-[3px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700/50 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div
                className="overflow-y-auto overscroll-contain"
                style={{ maxHeight: isDesktop ? "350px" : "48vh" }}
              >
                <div className="py-1">
                  {groups.map((group, gi) => {
                    if (group.type === "variant-group") {
                      return (
                        <div key={`group-${group.parentId}`}>
                          {/* Separator before group (if not first) */}
                          {gi > 0 && (
                            <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800/50" />
                          )}

                          {/* Parent group header */}
                          <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                              {highlightMatch(group.parentName, searchQuery)}
                            </span>
                            <span className="text-[9px] font-semibold text-[#1c6a1e] dark:text-[#2a8a30]/80 bg-[#1c6a1e]/[0.07] dark:bg-[#1c6a1e]/10 px-1.5 py-[2px] rounded-[2px] flex-shrink-0 leading-tight">
                              {group.items.length} variant
                              {group.items.length !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Variant items with subtle left accent */}
                          <div className="ml-3.5 border-l-[2px] border-[#1c6a1e]/15 dark:border-[#1c6a1e]/10">
                            {group.items.map((item, idx) =>
                              renderItem(
                                item,
                                true,
                                idx === group.items.length - 1,
                              ),
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={group.item.id}>
                          {/* Thin separator between standalone items */}
                          {gi > 0 &&
                            groups[gi - 1]?.type !== "variant-group" && (
                              <div className="mx-3 border-t border-gray-50 dark:border-gray-800/30" />
                            )}
                          {gi > 0 &&
                            groups[gi - 1]?.type === "variant-group" && (
                              <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-800/50" />
                            )}
                          {renderItem(group.item, false, true)}
                        </div>
                      );
                    }
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-3.5 py-1.5 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-black/10">
                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                  <div className="hidden md:flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[3px] text-[9px] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        ↑↓
                      </kbd>
                      <span className="text-gray-400">navigate</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[3px] text-[9px] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        ↵
                      </kbd>
                      <span className="text-gray-400">select</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[3px] text-[9px] font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        esc
                      </kbd>
                      <span className="text-gray-400">close</span>
                    </span>
                  </div>
                  <div className="md:hidden text-gray-400 dark:text-gray-500">
                    Tap to select
                  </div>
                  <span className="font-medium text-[#1c6a1e]/80 dark:text-[#2a8a30]/70">
                    {flatItems.length} found
                  </span>
                </div>
              </div>
            </>
          )}

          {/* No results state */}
          {showNoResults && (
            <div className="px-5 py-8 text-center">
              <div className="w-11 h-11 mx-auto mb-3 bg-gray-100 dark:bg-gray-800/70 rounded-full flex items-center justify-center">
                <Search className="w-4.5 h-4.5 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
                No matches for &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-[11.5px] text-gray-400 dark:text-gray-500 mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                Try a shorter or different term. Misspellings are handled
                automatically.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    (
                      mobileSearchInputRef.current || searchInputRef.current
                    )?.focus();
                  }}
                  className="text-[11px] font-medium text-[#1c6a1e] dark:text-[#2a8a30] hover:underline"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </div>
      );
    },
    [
      loadingSuggestions,
      searchQuery,
      debouncedSearchQuery,
      showSuggestions,
      searchSuggestions,
      isSearchPending,
      selectedSuggestionIndex,
      handleSelectSuggestion,
      highlightMatch,
      groupedSuggestionsData,
    ],
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
    clearCart();
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
        setSearchQuery("");
        setSearchSuggestions([]);
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
      .replace(/&/g, "and")
      .replace(/\s+/g, " ")
      .trim();

    const variations: Record<string, string> = {
      vegetables: "/category/vegetables.jpeg",
      vegetable: "/category/vegetables.jpeg",
      fruits: "/category/fruits.jpeg",
      fruit: "/category/fruits.jpeg",
      "grains and cereals": "/category/grains&cereals.jpg",
      "grains & cereals": "/category/grains&cereals.jpg",
      "cereals and grains": "/category/grains&cereals.jpg",
      "cereals & grains": "/category/grains&cereals.jpg",
      "grain and cereal": "/category/grains&cereals.jpg",
      "grain & cereal": "/category/grains&cereals.jpg",
      "grains&cereals": "/category/grains&cereals.jpg",
      spices: "/category/spices.webp",
      spice: "/category/spices.webp",
      beverages:
        shopType === "retail"
          ? "/retail/beverages.jpg"
          : "/category/beverages.jpeg",
      beverage:
        shopType === "retail"
          ? "/retail/beverages.jpg"
          : "/category/beverages.jpeg",
      drinks:
        shopType === "retail"
          ? "/retail/beverages.jpg"
          : "/category/beverages.jpeg",
      snacks: "/category/snacks.jpg",
      snack: "/category/snacks.jpg",
      "green grocery": "/category/green-grocery.jpeg",
      "green-grocery": "/category/green-grocery.jpeg",
      dairy: "/category/Dairy.jpeg",
      meat: "/category/meat.jpg",
      bakery: "/category/bakery.webp",
      "baked goods": "/category/bakery.webp",
      "frozen foods": "/category/frozen-foods.jpg",
      "frozen food": "/category/frozen-foods.jpg",
      frozen: "/category/frozen-foods.jpg",
      "canned goods": "/category/canned-goods.jpeg",
      "canned good": "/category/canned-goods.jpeg",
      canned: "/category/canned-goods.jpeg",
      // Retail variations
      "food essentials": "/retail/food%20essentials.jpeg",
      "food essential": "/retail/food%20essentials.jpeg",
      "snacks & confectionery": "/retail/Snacks-Confectionary.jpg",
      "snacks and confectionery": "/retail/Snacks-Confectionary.jpg",
      confectionery: "/retail/Snacks-Confectionary.jpg",
      "cleaning products": "/retail/cleaning%20products.webp",
      "cleaning product": "/retail/cleaning%20products.webp",
      "personal care": "/retail/beverages.jpg", // Using beverages as placeholder
      "household items": "/retail/beverages.jpg", // Using beverages as placeholder
      "household item": "/retail/beverages.jpg",
      "paper products": "/retail/paper%20products.jpeg",
      "paper product": "/retail/paper%20products.jpeg",
      "general merchandise": "/retail/general%20merchandize.jpeg",
      "general merchandize": "/retail/general%20merchandize.jpeg", // Note: filename has typo
      merchandise: "/retail/general%20merchandize.jpeg",
      merchandize: "/retail/general%20merchandize.jpeg",
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
      .replace(/&/g, "and")
      .replace(/\s+/g, " ")
      .trim();

    const variations: Record<string, string> = {
      vegetables: "Vegetables",
      vegetable: "Vegetables",
      fruits: "Fruits",
      fruit: "Fruits",
      "grains and cereals": "Grains & Cereals",
      "grains & cereals": "Grains & Cereals",
      "cereals and grains": "Grains & Cereals",
      "cereals & grains": "Grains & Cereals",
      "grain and cereal": "Grains & Cereals",
      "grain & cereal": "Grains & Cereals",
      "grains&cereals": "Grains & Cereals",
      spices: "Spices",
      spice: "Spices",
      beverages: "Beverages",
      beverage: "Beverages",
      drinks: "Beverages",
      snacks: "Snacks",
      snack: "Snacks",
      "green grocery": "Green Grocery",
      "green-grocery": "Green Grocery",
      dairy: "Dairy",
      meat: "Meat",
      bakery: "Bakery",
      "baked goods": "Bakery",
      "frozen foods": "Frozen Foods",
      "frozen food": "Frozen Foods",
      frozen: "Frozen Foods",
      "canned goods": "Canned Goods",
      "canned good": "Canned Goods",
      canned: "Canned Goods",
      "food essentials": "Food Essentials",
      "food essential": "Food Essentials",
      "snacks & confectionery": "Snacks & Confectionery",
      "snacks and confectionery": "Snacks & Confectionery",
      confectionery: "Snacks & Confectionery",
      "cleaning products": "Cleaning Products",
      "cleaning product": "Cleaning Products",
      "personal care": "Personal Care",
      "household items": "Household Items",
      "household item": "Household Items",
      "household goods": "Household Items",
      "paper products": "Paper Products",
      "paper product": "Paper Products",
      "general merchandise": "General Merchandise",
      "general merchandize": "General Merchandise",
      merchandise: "General Merchandise",
      merchandize: "General Merchandise",
    };

    if (variations[normalized] && CATEGORY_ICON_MAP[variations[normalized]]) {
      return CATEGORY_ICON_MAP[variations[normalized]];
    }

    // Keyword-based matching for custom categories - all icons use consistent size w-7 h-7
    if (
      lowerName.includes("medicine") ||
      lowerName.includes("meds") ||
      lowerName.includes("pill") ||
      lowerName.includes("drug")
    ) {
      return <Pill className="w-7 h-7" />;
    }
    if (lowerName.includes("coffee") || lowerName.includes("tea")) {
      return <CoffeeIcon className="w-7 h-7" />;
    }
    if (
      lowerName.includes("cake") ||
      lowerName.includes("pastry") ||
      lowerName.includes("baked")
    ) {
      return <Cake className="w-7 h-7" />;
    }
    if (
      lowerName.includes("beauty") ||
      lowerName.includes("cosmetic") ||
      lowerName.includes("makeup")
    ) {
      return <HeartIcon className="w-7 h-7" />;
    }
    if (
      lowerName.includes("juice") ||
      lowerName.includes("drink") ||
      lowerName.includes("soda")
    ) {
      return <Droplets className="w-7 h-7" />;
    }
    if (
      lowerName.includes("detergent") ||
      lowerName.includes("soap") ||
      lowerName.includes("cleaner")
    ) {
      return <Sparkles className="w-7 h-7" />;
    }
    if (
      lowerName.includes("stationery") ||
      lowerName.includes("pen") ||
      lowerName.includes("paper") ||
      lowerName.includes("notebook")
    ) {
      return <BookOpen className="w-7 h-7" />;
    }
    if (lowerName.includes("match") || lowerName.includes("lighter")) {
      return <Flame className="w-7 h-7" />;
    }
    if (
      lowerName.includes("shoe") ||
      lowerName.includes("polish") ||
      lowerName.includes("suede")
    ) {
      return <Shirt className="w-7 h-7" />;
    }
    if (
      lowerName.includes("lotion") ||
      lowerName.includes("cream") ||
      lowerName.includes("body")
    ) {
      return <HeartIcon className="w-7 h-7" />;
    }
    if (
      lowerName.includes("sauce") ||
      lowerName.includes("condiment") ||
      lowerName.includes("ketchup") ||
      lowerName.includes("tomato")
    ) {
      return <UtensilsCrossed className="w-7 h-7" />;
    }
    if (
      lowerName.includes("flour") ||
      lowerName.includes("wheat") ||
      lowerName.includes("maize") ||
      lowerName.includes("grain") ||
      lowerName.includes("cereal") ||
      lowerName.includes("weetabix")
    ) {
      return <Wheat className="w-7 h-7" />;
    }
    if (lowerName.includes("oil") || lowerName.includes("cooking")) {
      return <Droplets className="w-7 h-7" />;
    }
    if (lowerName.includes("sugar") || lowerName.includes("sweet")) {
      return <Candy className="w-7 h-7" />;
    }
    if (lowerName.includes("household") || lowerName.includes("goods")) {
      return <HomeIcon className="w-7 h-7" />;
    }

    // Default fallback - always return an icon
    return <Package className="w-7 h-7" />;
  };

  const getCategoryColor = (categoryName: string) => {
    if (!categoryName) return "text-gray-600 dark:text-gray-400";

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
      .replace(/&/g, "and")
      .replace(/\s+/g, " ")
      .trim();

    const variations: Record<string, string> = {
      vegetables: "Vegetables",
      vegetable: "Vegetables",
      fruits: "Fruits",
      fruit: "Fruits",
      "grains and cereals": "Grains & Cereals",
      "grains & cereals": "Grains & Cereals",
      "cereals and grains": "Grains & Cereals",
      "cereals & grains": "Grains & Cereals",
      "grain and cereal": "Grains & Cereals",
      "grain & cereal": "Grains & Cereals",
      "grains&cereals": "Grains & Cereals",
      spices: "Spices",
      spice: "Spices",
      beverages: "Beverages",
      beverage: "Beverages",
      drinks: "Beverages",
      snacks: "Snacks",
      snack: "Snacks",
      "green grocery": "Green Grocery",
      "green-grocery": "Green Grocery",
      dairy: "Dairy",
      meat: "Meat",
      bakery: "Bakery",
      "baked goods": "Bakery",
      "frozen foods": "Frozen Foods",
      "frozen food": "Frozen Foods",
      frozen: "Frozen Foods",
      "canned goods": "Canned Goods",
      "canned good": "Canned Goods",
      canned: "Canned Goods",
      "food essentials": "Food Essentials",
      "food essential": "Food Essentials",
      "snacks & confectionery": "Snacks & Confectionery",
      "snacks and confectionery": "Snacks & Confectionery",
      confectionery: "Snacks & Confectionery",
      "cleaning products": "Cleaning Products",
      "cleaning product": "Cleaning Products",
      "personal care": "Personal Care",
      "household items": "Household Items",
      "household item": "Household Items",
      "paper products": "Paper Products",
      "paper product": "Paper Products",
      "general merchandise": "General Merchandise",
      "general merchandize": "General Merchandise",
      merchandise: "General Merchandise",
      merchandize: "General Merchandise",
    };

    if (variations[normalized] && CATEGORY_COLOR_MAP[variations[normalized]]) {
      return CATEGORY_COLOR_MAP[variations[normalized]];
    }

    return "text-gray-600 dark:text-gray-400";
  };

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
        const result = await apiGetOffline<Item[]>(
          `/api/items?categoryId=${drawerCategoryId}`,
        );
        if (result.success) {
          const rawItems: Item[] = result.data ?? [];
          const allItems = rawItems.filter((item) =>
            itemMatchesShopType(item, shopType),
          );

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
                type: "parent",
                parent,
                children: children.sort((a, b) =>
                  (a.variant_name || a.name).localeCompare(
                    b.variant_name || b.name,
                  ),
                ),
              });
            }
          }

          // Add standalone items
          for (const item of standaloneItems) {
            grouped.push({
              type: "standalone",
              item,
            });
          }

          // Sort grouped items: parents alphabetically, then standalone items
          grouped.sort((a, b) => {
            if (a.type === "parent" && b.type === "parent") {
              return (a.parent?.name || "").localeCompare(b.parent?.name || "");
            }
            if (a.type === "standalone" && b.type === "standalone") {
              return (a.item?.name || "").localeCompare(b.item?.name || "");
            }
            // Parents come before standalone
            return a.type === "parent" ? -1 : 1;
          });

          setDrawerGroupedItems(grouped);

          // Also keep flat list for backward compatibility
          const processedItems: ItemWithVariants[] = [];
          for (const group of grouped) {
            if (group.type === "parent" && group.children) {
              for (const child of group.children) {
                processedItems.push({
                  ...child,
                  parentName: group.parent?.name,
                });
              }
            } else if (group.type === "standalone" && group.item) {
              processedItems.push(group.item);
            }
          }
          setDrawerCategoryItems(processedItems);
        }
      } catch (err) {
        console.error("Error fetching drawer category items:", err);
      } finally {
        setDrawerItemsLoading(false);
      }
    }

    fetchDrawerCategoryItems();
  }, [drawerCategoryId, categoryDrawerOpen, refreshKey, shopType]);

  const drawerCategory = drawerCategoryId
    ? filteredCategories.find((c) => c.id === drawerCategoryId)
    : null;

  const filteredDrawerGroupedItems = drawerSearchQuery
    ? drawerGroupedItems
        .filter((group) => {
          if (group.type === "parent") {
            const matchesParent = group.parent?.name
              .toLowerCase()
              .includes(drawerSearchQuery.toLowerCase());
            const matchesChildren = group.children?.some(
              (child) =>
                child.name
                  .toLowerCase()
                  .includes(drawerSearchQuery.toLowerCase()) ||
                child.variant_name
                  ?.toLowerCase()
                  .includes(drawerSearchQuery.toLowerCase()),
            );
            return matchesParent || matchesChildren;
          } else {
            return group.item?.name
              .toLowerCase()
              .includes(drawerSearchQuery.toLowerCase());
          }
        })
        .map((group) => {
          if (group.type === "parent" && group.children) {
            // Filter children if search query doesn't match parent
            const filteredChildren = group.children.filter(
              (child) =>
                child.name
                  .toLowerCase()
                  .includes(drawerSearchQuery.toLowerCase()) ||
                child.variant_name
                  ?.toLowerCase()
                  .includes(drawerSearchQuery.toLowerCase()) ||
                group.parent?.name
                  .toLowerCase()
                  .includes(drawerSearchQuery.toLowerCase()),
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

  interface ItemWithVariants extends Item {
    isParent?: boolean;
    variantCount?: number;
    variants?: Item[];
    parentName?: string; // Parent name for variants
  }

  interface GroupedItem {
    type: "parent" | "standalone";
    parent?: Item;
    children?: Item[];
    item?: Item;
  }

  const [categoryItems, setCategoryItems] = useState<ItemWithVariants[]>([]);
  const [groupedCategoryItems, setGroupedCategoryItems] = useState<
    GroupedItem[]
  >([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryItems([]);
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
          const rawItems: Item[] = result.data ?? [];
          const allItems = rawItems.filter((item) =>
            itemMatchesShopType(item, shopType),
          );

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
                type: "parent",
                parent,
                children: children.sort((a, b) =>
                  (a.variant_name || a.name).localeCompare(
                    b.variant_name || b.name,
                  ),
                ),
              });
            }
          }

          // Add standalone items
          for (const item of standaloneItems) {
            grouped.push({
              type: "standalone",
              item,
            });
          }

          // Sort grouped items: parents alphabetically, then standalone items
          grouped.sort((a, b) => {
            if (a.type === "parent" && b.type === "parent") {
              return (a.parent?.name || "").localeCompare(b.parent?.name || "");
            }
            if (a.type === "standalone" && b.type === "standalone") {
              return (a.item?.name || "").localeCompare(b.item?.name || "");
            }
            // Parents come before standalone
            return a.type === "parent" ? -1 : 1;
          });

          setGroupedCategoryItems(grouped);

          // Also keep flat list for backward compatibility
          const processedItems: ItemWithVariants[] = [];
          for (const group of grouped) {
            if (group.type === "parent" && group.children) {
              for (const child of group.children) {
                processedItems.push({
                  ...child,
                  parentName: group.parent?.name,
                });
              }
            } else if (group.type === "standalone" && group.item) {
              processedItems.push(group.item);
            }
          }
          setCategoryItems(processedItems);
        }
      } catch (err) {
        console.error("Error fetching category items:", err);
      } finally {
        setItemsLoading(false);
      }
    }

    fetchCategoryItems();
  }, [selectedCategoryId, refreshKey, shopType]);

  const filteredGroupedCategoryItems = categorySearchQuery
    ? groupedCategoryItems
        .filter((group) => {
          if (group.type === "parent") {
            const matchesParent = group.parent?.name
              .toLowerCase()
              .includes(categorySearchQuery.toLowerCase());
            const matchesChildren = group.children?.some(
              (child) =>
                child.name
                  .toLowerCase()
                  .includes(categorySearchQuery.toLowerCase()) ||
                child.variant_name
                  ?.toLowerCase()
                  .includes(categorySearchQuery.toLowerCase()),
            );
            return matchesParent || matchesChildren;
          } else {
            return group.item?.name
              .toLowerCase()
              .includes(categorySearchQuery.toLowerCase());
          }
        })
        .map((group) => {
          if (group.type === "parent" && group.children) {
            // Filter children if search query doesn't match parent
            const filteredChildren = group.children.filter(
              (child) =>
                child.name
                  .toLowerCase()
                  .includes(categorySearchQuery.toLowerCase()) ||
                child.variant_name
                  ?.toLowerCase()
                  .includes(categorySearchQuery.toLowerCase()) ||
                group.parent?.name
                  .toLowerCase()
                  .includes(categorySearchQuery.toLowerCase()),
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
                onFocus={() =>
                  searchSuggestions.length > 0 && setShowSuggestions(true)
                }
                inputRef={mobileSearchInputRef}
                containerRef={searchContainerRef}
                isPending={isSearchPending}
                isScanning={barcodeScanStatus.scanning}
                isLoadingSuggestions={loadingSuggestions}
                suggestions={renderSuggestionsDropdown(false)}
              />
              <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] px-3">
                {searchQuery && isSearchPending ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="bg-white dark:bg-[#1c2e18] rounded-xl border border-slate-200 h-32 animate-pulse"
                      />
                    ))}
                  </div>
                ) : debouncedSearchQuery ? (
                  <ItemGrid
                    key={`search-${refreshKey}`}
                    categoryId={null}
                    searchQuery={debouncedSearchQuery}
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
                onFocus={() =>
                  searchSuggestions.length > 0 && setShowSuggestions(true)
                }
                inputRef={mobileSearchInputRef}
                containerRef={searchContainerRef}
                isPending={isSearchPending}
                isScanning={barcodeScanStatus.scanning}
                isLoadingSuggestions={loadingSuggestions}
                suggestions={renderSuggestionsDropdown(false)}
              />

              <main className="flex-1 overflow-y-auto no-scrollbar pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] px-3 flex flex-col min-h-0">
                {debouncedSearchQuery ? (
                  <div className="flex-1 min-h-0 flex flex-col -mx-1">
                    <ItemGrid
                      key={`msearch-${refreshKey}`}
                      categoryId={null}
                      searchQuery={debouncedSearchQuery}
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
                onFocus={() =>
                  searchSuggestions.length > 0 && setShowSuggestions(true)
                }
                inputRef={mobileSearchInputRef}
                containerRef={searchContainerRef}
                isPending={isSearchPending}
                isScanning={barcodeScanStatus.scanning}
                isLoadingSuggestions={loadingSuggestions}
                suggestions={renderSuggestionsDropdown(false)}
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
                    key={`csearch-${refreshKey}`}
                    categoryId={null}
                    searchQuery={debouncedSearchQuery}
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
                  onSearchFocus={() =>
                    searchSuggestions.length > 0 && setShowSuggestions(true)
                  }
                  onClearSearch={clearSearch}
                  onOpenCamera={() => setBarcodeCameraOpen(true)}
                  searchInputRef={searchInputRef}
                  searchContainerRef={desktopSearchContainerRef}
                  isSearchPending={isSearchPending}
                  isScanning={barcodeScanStatus.scanning}
                  isValidBarcode={isValidBarcode}
                  showSuggestions={showSuggestions}
                  loadingSuggestions={loadingSuggestions}
                  suggestions={renderSuggestionsDropdown(true)}
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
                  {searchQuery && isSearchPending ? (
                    <div className="p-6 px-6 sm:px-10">
                      {/* Skeleton loading grid for desktop search */}
                      <div className="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,8.75rem),1fr))] animate-pulse">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div
                            key={i}
                            className="bg-white dark:bg-slate-800 rounded-none border-2 border-slate-300 dark:border-slate-600 overflow-hidden"
                          >
                            <div className="p-4 sm:p-5 space-y-3">
                              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-4/5" />
                              <div className="h-3 bg-gray-50 dark:bg-gray-700/60 rounded w-3/5" />
                              <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded w-2/5 mt-2" />
                              <div className="h-3 bg-gray-50 dark:bg-gray-700/60 rounded w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-full flex flex-col px-3 sm:px-4 lg:px-6">
                      <ItemGrid
                        key={`grid-${refreshKey}`}
                        categoryId={
                          debouncedSearchQuery ? null : selectedCategoryId
                        }
                        searchQuery={debouncedSearchQuery || undefined}
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
                  )}
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
                        Remove all{" "}
                        <span className="font-medium text-gray-900 dark:text-gray-200">
                          {cartItemCount}
                        </span>{" "}
                        {cartItemCount === 1 ? "item" : "items"} from your cart?
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

        {/* Category Products Drawer */}
        <Drawer
          open={categoryDrawerOpen}
          onOpenChange={setCategoryDrawerOpen}
          direction="right"
        >
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 print:hidden">
            <DrawerHeader className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900 px-4 sm:px-5 py-4">
              <div className="flex items-center justify-between pr-8">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm shadow-[#1c6a1e]/20 flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:text-white">
                    {drawerCategory && getCategoryIcon(drawerCategory.name)}
                  </div>
                  <div className="min-w-0">
                    <DrawerTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                      {drawerCategory?.name || "Category"}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {drawerItemsLoading
                        ? "Loading..."
                        : `${drawerCategoryItems.length} product${drawerCategoryItems.length !== 1 ? "s" : ""}`}
                    </DrawerDescription>
                  </div>
                </div>
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-none bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </DrawerClose>
              </div>
              {/* Drawer search */}
              <div className="mt-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder={`Search ${drawerCategory?.name.toLowerCase() || "products"}...`}
                  value={drawerSearchQuery}
                  onChange={(e) => setDrawerSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-none border-gray-200/80 dark:border-gray-700/60 focus:border-[#1c6a1e] focus:ring-2 focus:ring-[#1c6a1e]/20 text-sm"
                />
                {drawerSearchQuery && (
                  <button
                    onClick={() => setDrawerSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-none bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </DrawerHeader>

            <div className="overflow-y-auto flex-1 bg-gray-50/50 dark:bg-slate-900/50 px-4 sm:px-5 py-4">
              {drawerItemsLoading ? (
                /* Skeleton loading grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden animate-pulse"
                    >
                      <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800" />
                      <div className="p-3 space-y-2">
                        <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                        <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-2/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredDrawerGroupedItems.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <div className="w-16 h-16 rounded-none bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Package className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {drawerSearchQuery
                        ? `No results for "${drawerSearchQuery}"`
                        : "No products yet"}
                    </p>
                    {drawerSearchQuery && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Try a different search term
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Parent groups */}
                  {filteredDrawerGroupedItems
                    .filter((g) => g.type === "parent")
                    .map((group) => {
                      if (
                        !group.parent ||
                        !group.children ||
                        group.children.length === 0
                      )
                        return null;
                      return (
                        <div
                          key={group.parent.id}
                          className="rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/40 overflow-hidden"
                        >
                          {/* Parent header */}
                          <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700/40 bg-gray-50/80 dark:bg-gray-800/30">
                            <div className="w-7 h-7 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center flex-shrink-0">
                              <Package className="w-3.5 h-3.5 text-white" />
                            </div>
                            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate flex-1">
                              {group.parent.name}
                            </h2>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium flex-shrink-0">
                              {group.children.length} variant
                              {group.children.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {/* Children grid */}
                          <div className="p-2.5">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {group.children.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    handleSelectItem(item);
                                    setCategoryDrawerOpen(false);
                                  }}
                                  className="pos-grid-btn group bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-800/95 dark:to-slate-800/70 rounded-none border-2 border-slate-300 dark:border-slate-500 overflow-hidden text-left"
                                >
                                  {/* Image */}
                                  <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800/50 overflow-hidden relative">
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
                                              '<div class="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/50"><svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                      </div>
                                    )}
                                    {/* Stock overlay when zero or negative */}
                                    {item.current_stock <= 0 && (
                                      <div className="absolute inset-0 bg-white/60 dark:bg-black/40 flex items-center justify-center">
                                        <span
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-none ${
                                            item.current_stock < 0
                                              ? "text-red-600 dark:text-red-400 bg-red-50/95 dark:bg-red-950/80"
                                              : "text-gray-500 dark:text-gray-400 bg-white/90 dark:bg-black/60"
                                          }`}
                                        >
                                          {item.current_stock < 0
                                            ? `${item.current_stock.toFixed(item.unit_type === "kg" || item.unit_type === "g" ? 2 : 0)} ${item.unit_type}`
                                            : "Out of stock"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div className="p-2">
                                    <h3 className="font-semibold text-[11px] sm:text-[12px] text-gray-800 dark:text-gray-100 leading-tight group-hover:text-[#1c6a1e] dark:group-hover:text-[#2a8a30] transition-colors uppercase tracking-tight break-words">
                                      {item.name}
                                    </h3>
                                    <div className="flex items-baseline gap-1 mt-1">
                                      <span className="text-sm font-bold text-[#1c6a1e]">
                                        KES {item.current_sell_price.toFixed(0)}
                                      </span>
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                        /{item.unit_type}
                                      </span>
                                    </div>
                                    {/* Stock indicator */}
                                    <div className="flex items-center gap-1 mt-1.5">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-none flex-shrink-0 ${
                                          item.current_stock < 0
                                            ? "bg-red-500"
                                            : item.current_stock <= 0
                                              ? "bg-gray-300 dark:bg-gray-600"
                                              : item.current_stock < 10
                                                ? "bg-amber-400 animate-pulse"
                                                : "bg-emerald-400"
                                        }`}
                                      />
                                      <span
                                        className={`text-[10px] font-medium ${
                                          item.current_stock < 0
                                            ? "text-red-600 dark:text-red-400 font-semibold"
                                            : item.current_stock <= 0
                                              ? "text-gray-400"
                                              : item.current_stock < 10
                                                ? "text-amber-500"
                                                : "text-gray-400"
                                        }`}
                                      >
                                        {item.current_stock < 0
                                          ? `${item.current_stock.toFixed(item.unit_type === "kg" || item.unit_type === "g" ? 2 : 0)} ${item.unit_type}`
                                          : item.current_stock <= 0
                                            ? "Out of stock"
                                            : `${item.current_stock} ${item.unit_type}`}
                                      </span>
                                    </div>
                                    {item.bundle_quantity &&
                                      item.bundle_price &&
                                      item.bundle_quantity > 0 &&
                                      item.bundle_price > 0 && (
                                        <div className="mt-1.5">
                                          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-700/40">
                                            <Tag className="w-2 h-2" />
                                            {item.bundle_name ||
                                              `${item.bundle_quantity} for KES ${item.bundle_price.toFixed(0)}`}
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* Standalone items grouped */}
                  {filteredDrawerGroupedItems.filter(
                    (g) => g.type === "standalone",
                  ).length > 0 && (
                    <div>
                      {filteredDrawerGroupedItems.some(
                        (g) => g.type === "parent",
                      ) && (
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Individual Products
                          </h3>
                          <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {filteredDrawerGroupedItems
                          .filter((g) => g.type === "standalone")
                          .map((group) => {
                            if (!group.item) return null;
                            const item = group.item;
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  handleSelectItem(item);
                                  setCategoryDrawerOpen(false);
                                }}
                                className="pos-grid-btn group bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-800/95 dark:to-slate-800/70 rounded-none border-2 border-slate-300 dark:border-slate-500 overflow-hidden text-left"
                              >
                                <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800/50 overflow-hidden relative">
                                  {resolveItemImageUrl(item) ? (
                                    <img
                                      src={resolveItemImageUrl(item)!}
                                      alt={item.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target =
                                          e.target as HTMLImageElement;
                                        const parentEl = target.parentElement;
                                        if (parentEl) {
                                          parentEl.innerHTML =
                                            '<div class="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/50"><svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                    </div>
                                  )}
                                  {item.current_stock <= 0 && (
                                    <div className="absolute inset-0 bg-white/60 dark:bg-black/40 flex items-center justify-center">
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-none ${
                                          item.current_stock < 0
                                            ? "text-red-600 dark:text-red-400 bg-red-50/95 dark:bg-red-950/80"
                                            : "text-gray-500 dark:text-gray-400 bg-white/90 dark:bg-black/60"
                                        }`}
                                      >
                                        {item.current_stock < 0
                                          ? `${item.current_stock.toFixed(item.unit_type === "kg" || item.unit_type === "g" ? 2 : 0)} ${item.unit_type}`
                                          : "Out of stock"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-2">
                                  <h3 className="font-semibold text-[11px] sm:text-[12px] text-gray-800 dark:text-gray-100 leading-tight group-hover:text-[#1c6a1e] dark:group-hover:text-[#2a8a30] transition-colors uppercase tracking-tight break-words">
                                    {item.name}
                                  </h3>
                                  <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-sm font-bold text-[#1c6a1e]">
                                      KES {item.current_sell_price.toFixed(0)}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                      /{item.unit_type}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-none flex-shrink-0 ${
                                        item.current_stock < 0
                                          ? "bg-red-500"
                                          : item.current_stock <= 0
                                            ? "bg-gray-300 dark:bg-gray-600"
                                            : item.current_stock < 10
                                              ? "bg-amber-400 animate-pulse"
                                              : "bg-emerald-400"
                                      }`}
                                    />
                                    <span
                                      className={`text-[10px] font-medium ${
                                        item.current_stock < 0
                                          ? "text-red-600 dark:text-red-400 font-semibold"
                                          : item.current_stock <= 0
                                            ? "text-gray-400"
                                            : item.current_stock < 10
                                              ? "text-amber-500"
                                              : "text-gray-400"
                                      }`}
                                    >
                                      {item.current_stock < 0
                                        ? `${item.current_stock.toFixed(item.unit_type === "kg" || item.unit_type === "g" ? 2 : 0)} ${item.unit_type}`
                                        : item.current_stock <= 0
                                          ? "Out of stock"
                                          : `${item.current_stock} ${item.unit_type}`}
                                    </span>
                                  </div>
                                  {item.bundle_quantity &&
                                    item.bundle_price &&
                                    item.bundle_quantity > 0 &&
                                    item.bundle_price > 0 && (
                                      <div className="mt-1.5">
                                        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-700/40">
                                          <Tag className="w-2 h-2" />
                                          {item.bundle_name ||
                                            `${item.bundle_quantity} for KES ${item.bundle_price.toFixed(0)}`}
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>

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
