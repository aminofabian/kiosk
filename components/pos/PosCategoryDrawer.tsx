"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Search, Tag, X } from "lucide-react";
import type { Item } from "@/lib/db/types";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getCategoryIcon } from "@/lib/pos/category-display";
import {
  filterGroupedItems,
  flattenGroupedItems,
  groupItemsByParent,
  type GroupedItem,
} from "@/lib/pos/item-groups";
import { apiGetOffline } from "@/lib/offline/api-offline";
import { itemMatchesShopType } from "@/lib/utils/shop-type";
import { resolveItemImageUrl } from "@/lib/utils/item-images";

export interface PosCategoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string | null;
  categoryName: string | null;
  shopType: string;
  refreshKey?: number;
  onSelectItem: (item: Item) => void;
}

function stockLabel(item: Item) {
  if (item.current_stock < 0) {
    const decimals = item.unit_type === "kg" || item.unit_type === "g" ? 2 : 0;
    return `${item.current_stock.toFixed(decimals)} ${item.unit_type}`;
  }
  if (item.current_stock <= 0) return "Out of stock";
  return `${item.current_stock} ${item.unit_type}`;
}

function CategoryProductTile({
  item,
  parentImageItem,
  onClick,
}: {
  item: Item;
  parentImageItem?: Item;
  onClick: () => void;
}) {
  const imageItem = parentImageItem ?? item;

  return (
    <button
      type="button"
      onClick={onClick}
      className="pos-grid-btn group bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-800/95 dark:to-slate-800/70 rounded-none border-2 border-slate-300 dark:border-slate-500 overflow-hidden text-left"
    >
      <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800/50 overflow-hidden relative">
        {resolveItemImageUrl(imageItem) ? (
          <img
            src={resolveItemImageUrl(imageItem)!}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
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
              {stockLabel(item)}
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
            {stockLabel(item)}
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
}

export function PosCategoryDrawer({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  shopType,
  refreshKey = 0,
  onSelectItem,
}: PosCategoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!categoryId || !open) {
      setGroupedItems([]);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await apiGetOffline<Item[]>(
          `/api/items?categoryId=${categoryId}`,
        );
        if (cancelled || !result.success) return;

        const scoped = (result.data ?? []).filter((item) =>
          itemMatchesShopType(item, shopType),
        );
        setGroupedItems(groupItemsByParent(scoped));
      } catch (err) {
        console.error("Error fetching category drawer items:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [categoryId, open, shopType, refreshKey]);

  const itemCount = useMemo(
    () => flattenGroupedItems(groupedItems).length,
    [groupedItems],
  );

  const filteredGroups = useMemo(
    () => filterGroupedItems(groupedItems, searchQuery),
    [groupedItems, searchQuery],
  );

  const parentGroups = filteredGroups.filter((g) => g.type === "parent");
  const standaloneGroups = filteredGroups.filter((g) => g.type === "standalone");

  const selectItem = (item: Item) => {
    onSelectItem(item);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 print:hidden">
        <DrawerHeader className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900 px-4 sm:px-5 py-4">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm shadow-[#1c6a1e]/20 flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:text-white">
                {categoryName ? getCategoryIcon(categoryName) : <Package className="w-5 h-5 text-white" />}
              </div>
              <div className="min-w-0">
                <DrawerTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                  {categoryName || "Category"}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {loading
                    ? "Loading..."
                    : `${itemCount} product${itemCount !== 1 ? "s" : ""}`}
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
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder={`Search ${categoryName?.toLowerCase() || "products"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-none border-gray-200/80 dark:border-gray-700/60 focus:border-[#1c6a1e] focus:ring-2 focus:ring-[#1c6a1e]/20 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-none bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto flex-1 bg-gray-50/50 dark:bg-slate-900/50 px-4 sm:px-5 py-4">
          {loading ? (
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
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-16 h-16 rounded-none bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Package className="w-7 h-7 text-gray-300 dark:text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {searchQuery ? `No results for "${searchQuery}"` : "No products yet"}
                </p>
                {searchQuery && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Try a different search term
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {parentGroups.map((group) => {
                if (!group.parent || !group.children?.length) return null;
                return (
                  <div
                    key={group.parent.id}
                    className="rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/40 overflow-hidden"
                  >
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
                    <div className="p-2.5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {group.children.map((item) => (
                          <CategoryProductTile
                            key={item.id}
                            item={item}
                            parentImageItem={group.parent}
                            onClick={() => selectItem(item)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {standaloneGroups.length > 0 && (
                <div>
                  {parentGroups.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Individual Products
                      </h3>
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {standaloneGroups.map((group) =>
                      group.item ? (
                        <CategoryProductTile
                          key={group.item.id}
                          item={group.item}
                          onClick={() => selectItem(group.item!)}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
