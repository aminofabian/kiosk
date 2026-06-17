"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ArrowLeft, Menu, ShoppingCart } from "lucide-react";
import { POSLayout } from "@/components/layouts/pos-layout";
import { CategoryList } from "@/components/pos/CategoryList";
import { ItemGrid } from "@/components/pos/ItemGrid";
import { AddToCartDialog } from "@/components/pos/AddToCartDialog";
import { VariantSelector } from "@/components/pos/VariantSelector";
import { PosCategoryChips } from "@/components/pos/PosCategoryChips";
import { PosMobileSearchBar } from "@/components/pos/PosMobileSearchBar";
import { PosDepartmentRail } from "@/components/pos/PosDepartmentRail";
import { DepartmentDesktopHeader } from "@/components/department/DepartmentDesktopHeader";
import { DepartmentCartColumn } from "@/components/department/DepartmentCartColumn";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import { useCartStore } from "@/lib/stores/cart-store";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useItemTypes } from "@/lib/hooks/use-item-types";
import { apiGet } from "@/lib/utils/api-client";
import {
  categoryMatchesAssignedTypes,
  SHOP_TYPE_ALL,
} from "@/lib/utils/shop-type";
import type { Category, Item } from "@/lib/db/types";

export default function DepartmentPage() {
  const {
    assignedTypes,
    shopType,
    setShopType,
    businessName,
    userName,
    cartItemCount,
    customerName,
    setCustomerName,
    submitOrder,
    submitting,
  } = useDepartmentApp();
  const { carts, activeCartId, switchCart, addItem } = useCartStore();
  const { itemTypeKeys, allowSellOutOfStock } = useItemTypes();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedParentItem, setSelectedParentItem] = useState<{
    id: string;
    name: string;
    variants?: Item[];
  } | null>(null);
  const [variantSelectorOpen, setVariantSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<Item[]>([]);

  const debouncedSearchQuery = useDebounce(searchQuery, 280);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeCartId && carts.length > 0) {
      switchCart(carts[0].id);
    }
  }, [activeCartId, carts, switchCart]);

  const fetchCategories = useCallback(async () => {
    try {
      const result = await apiGet<Category[]>("/api/categories");
      if (result.success && result.data) {
        setCategories(result.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  // Load most-forwarded items for Quick Forward section
  const loadDepartmentInsights = useCallback(async () => {
    try {
      const result = await apiGet<{ topForwardedItems: Item[] }>(
        `/api/department/insights?days=30&_=${Date.now()}`,
      );
      if (result.success && result.data) {
        setFeaturedItems(result.data.topForwardedItems || []);
      }
    } catch {
      // non-critical — home screen still works without insights
    }
  }, []);

  useEffect(() => {
    void loadDepartmentInsights();
  }, [loadDepartmentInsights]);

  const filteredCategories = useMemo(
    () =>
      categories.filter((cat) =>
        categoryMatchesAssignedTypes(cat.name, shopType, assignedTypes),
      ),
    [categories, shopType, assignedTypes],
  );

  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)
    : null;

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

  const handleQuickAdd = useCallback(
    (item: Item, quantity: number) => {
      if (quantity <= 0) return;
      addItem(
        {
          itemId: item.id,
          name: item.name,
          price: item.current_sell_price,
          unitType: item.unit_type,
        },
        quantity,
      );
    },
    [addItem],
  );

  const handleShopTypeChange = useCallback(
    (newShopType: string) => {
      setShopType(newShopType);
      setSelectedCategoryId(null);
    },
    [setShopType],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadDepartmentInsights(), fetchCategories()]);
      setRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCategories, loadDepartmentInsights]);

  const itemGridProps = {
    onSelectItem: handleSelectItem,
    onSelectParent: handleSelectParent,
    onQuickAdd: handleQuickAdd,
    shopType,
    itemTypeKeys,
    categories,
    featuredItems,
    itemTypesFilter: assignedTypes.length > 0 ? assignedTypes : undefined,
    stockListFilter: "all" as const,
    showShopTypeCatalog: assignedTypes.length > 0,
    allowSellOutOfStock,
  };

  const noTypesBanner = assignedTypes.length === 0 && (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
      No product types assigned to your account. Ask an admin to edit your user
      and select departments under{" "}
      <strong>Department Staff → Product Types</strong>, then sign out and back
      in.
    </div>
  );

  return (
    <>
      {/* Mobile — bottom nav shell */}
      <div className="md:hidden h-full flex flex-col min-h-0 bg-[#f6f8f6] dark:bg-[#132210] text-[#101b0d] dark:text-[#f0fdf4]">
        {!selectedCategoryId ? (
          <>
            <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center justify-between px-3 h-12 w-full">
                <button
                  aria-label="Browse categories"
                  className="pos-icon-btn"
                  onClick={() => setCategoryDrawerOpen(true)}
                >
                  <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <h1 className="text-[17px] font-bold text-[#1c6a1e] leading-none tracking-tight truncate max-w-[45%]">
                  {businessName || "Department"}
                </h1>
                <Link
                  href="/department/cart"
                  className="pos-icon-btn relative"
                  aria-label="View cart"
                >
                  <ShoppingCart className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#1c6a1e] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </span>
                  )}
                </Link>
              </div>
            </header>

            <PosMobileSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearchSubmit={(e) => e.preventDefault()}
              onSearchKeyDown={() => {}}
              onClear={() => setSearchQuery("")}
              onOpenCamera={() => {}}
              inputRef={mobileSearchInputRef}
              placeholder="Search products..."
            />

            <main className="flex-1 overflow-y-auto no-scrollbar px-3 flex flex-col min-h-0 w-full">
              {assignedTypes.length === 0 && (
                <div className="shrink-0 mt-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
                  No product types assigned. Ask an admin to set your
                  departments, then sign out and back in.
                </div>
              )}

              {debouncedSearchQuery ? (
                <div className="flex-1 min-h-0 flex flex-col -mx-1 pt-1">
                  <ItemGrid
                    key={`msearch-${debouncedSearchQuery}`}
                    {...itemGridProps}
                    categoryId={null}
                    searchQuery={debouncedSearchQuery}
                    showShopTypeCatalog={false}
                  />
                </div>
              ) : (
                <>
                  <PosCategoryChips
                    categories={filteredCategories}
                    onSelect={(id) => setSelectedCategoryId(id)}
                  />
                  <div className="flex-1 min-h-0 flex flex-col mt-1 -mx-1">
                    <ItemGrid
                      key="mhome"
                      {...itemGridProps}
                      categoryId={null}
                      showShopTypeCatalog={false}
                    />
                  </div>
                </>
              )}
            </main>
          </>
        ) : (
          <>
            <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
              <div className="flex items-center gap-2 px-3 h-12 w-full">
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
                <Link
                  href="/department/cart"
                  className="pos-icon-btn relative"
                  aria-label="View cart"
                >
                  <ShoppingCart className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#1c6a1e] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </span>
                  )}
                </Link>
              </div>
            </header>

            <PosMobileSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearchSubmit={(e) => e.preventDefault()}
              onSearchKeyDown={() => {}}
              onClear={() => setSearchQuery("")}
              onOpenCamera={() => {}}
              inputRef={mobileSearchInputRef}
              placeholder="Search products..."
            />

            <main className="flex-1 overflow-y-auto no-scrollbar px-3 w-full">
              <ItemGrid
                key={`cat-${selectedCategoryId}`}
                categoryId={debouncedSearchQuery ? null : selectedCategoryId}
                searchQuery={debouncedSearchQuery || undefined}
                {...itemGridProps}
              />
            </main>
          </>
        )}

        {categoryDrawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setCategoryDrawerOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-slate-900 shadow-xl overflow-y-auto safe-area-top"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Categories
                </h2>
              </div>
              <div className="p-2 pb-8">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setCategoryDrawerOpen(false);
                    }}
                    className="w-full text-left px-4 py-3.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl active:scale-[0.99]"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop / tablet — type rail + cart column */}
      <div className="hidden md:block h-full min-h-0">
        <POSLayout
          fillParent
          header={
            <DepartmentDesktopHeader
              businessName={businessName}
              userName={userName}
              deptTypes={assignedTypes}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearchSubmit={(e) => e.preventDefault()}
              onClearSearch={() => setSearchQuery("")}
              searchInputRef={searchInputRef}
              isSearchPending={
                !!searchQuery && searchQuery !== debouncedSearchQuery
              }
              onRefresh={handleRefresh}
              refreshing={refreshing}
              onLogout={() => signOut({ callbackUrl: "/login" })}
            />
          }
        >
          {noTypesBanner}
          <div className="flex flex-1 min-h-0 h-full overflow-hidden">
            <PosDepartmentRail
              allowedTypes={assignedTypes}
              onShopTypeChange={handleShopTypeChange}
            />
            <div className="flex flex-col flex-1 min-w-0 min-h-0">
              {!debouncedSearchQuery && !searchQuery && (
                <div className="flex-shrink-0 border-b border-gray-200 bg-white/50 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/30">
                  <CategoryList
                    onSelectCategory={(id) => setSelectedCategoryId(id)}
                    selectedCategoryId={selectedCategoryId || undefined}
                    shopType={SHOP_TYPE_ALL}
                    categories={filteredCategories}
                  />
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-transparent to-gray-50/50 dark:to-slate-900/20 flex flex-col">
                <div className="min-h-full flex flex-col px-3 sm:px-4 lg:px-6">
                  <ItemGrid
                    key={`grid-${refreshKey}`}
                    {...itemGridProps}
                    categoryId={
                      debouncedSearchQuery ? null : selectedCategoryId
                    }
                    searchQuery={debouncedSearchQuery || undefined}
                    showShopTypeCatalog={
                      !!selectedCategoryId &&
                      !debouncedSearchQuery &&
                      assignedTypes.length > 0
                    }
                  />
                </div>
              </div>
            </div>
            <DepartmentCartColumn
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              onSaveDraft={() => void submitOrder(false)}
              onForward={() => void submitOrder(true)}
              submitting={submitting}
            />
          </div>
        </POSLayout>
      </div>

      <AddToCartDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        allowSellOutOfStock={allowSellOutOfStock}
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
