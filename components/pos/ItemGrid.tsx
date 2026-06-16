'use client';

import { useEffect, useState, useMemo, useRef, useCallback, memo, type ReactNode } from 'react';
import { Tag, Package, ShoppingBag, Flame, AlertTriangle, ArrowRight, PackageX } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { itemMatchesShopType, shouldShowCategory, SHOP_TYPE_ALL } from '@/lib/utils/shop-type';
import { getItemDisplayName } from '@/lib/utils';
import { resolveItemImageUrl } from '@/lib/utils/item-images';
import { PosQuickSellPhoto } from '@/components/pos/PosQuickSellPhoto';

interface ItemWithVariants extends Item {
  isParent?: boolean;
  variantCount?: number;
  variants?: Item[];
  parentName?: string; // Parent item name for variants
}

interface GroupedItem {
  type: 'parent' | 'standalone';
  parent?: Item;
  children?: Item[];
  item?: Item;
}

interface ItemGridProps {
  categoryId: string | null;
  searchQuery?: string;
  onSelectItem: (item: Item) => void;
  onSelectParent?: (item: ItemWithVariants) => void;
  onQuickAdd?: (item: Item, quantity: number) => void;
  shopType?: string;
  /** When showing "other" department fallback, pick from these keys (e.g. from useItemTypes) */
  itemTypeKeys?: string[];
  categories?: Category[]; // Pass categories from parent to avoid redundant fetch
  featuredItems?: Item[];
  lowStockItems?: Item[];
  /** Admin/owner: full-catalog lists from /api/pos/insights */
  outStockItems?: Item[];
  lowQuantityItems?: Item[];
  /** Admin: filter home grid to out / low only */
  stockListFilter?: 'all' | 'out' | 'low';
  /** Admin/owner: show low-stock strip below Quick Sell */
  showLowStockStrip?: boolean;
  /** Admin/owner: inline product photo upload on Quick Sell cards */
  canManageItemImages?: boolean;
  onItemImageUpdated?: (itemId: string, imageUrl: string | null) => void;
  /** Restrict API results to these item_type keys (department staff) */
  itemTypesFilter?: string[];
  /** When no category/search, show full sellable catalog for the active shop type */
  showShopTypeCatalog?: boolean;
  /** Business setting: cashiers may sell zero/negative stock items */
  allowSellOutOfStock?: boolean;
}

function itemTypesQueryParam(itemTypesFilter?: string[]): string {
  if (!itemTypesFilter?.length) return '';
  return `&itemTypes=${itemTypesFilter.map(encodeURIComponent).join(',')}`;
}

function catalogTypeQuery(shopType: string, itemTypesFilter?: string[]): string {
  if (shopType !== SHOP_TYPE_ALL) {
    return `&itemType=${encodeURIComponent(shopType)}`;
  }
  return itemTypesQueryParam(itemTypesFilter);
}

function applyItemsToGrid(
  allItems: Item[],
  shopType: string,
  setGroupedItems: (g: GroupedItem[]) => void,
  setItems: (items: ItemWithVariants[]) => void,
) {
  const scoped =
    shopType === SHOP_TYPE_ALL
      ? allItems
      : allItems.filter((item) => itemMatchesShopType(item, shopType));

  const grouped = groupItemsForDisplay(scoped);
  setGroupedItems(grouped);

  const processedItems: ItemWithVariants[] = grouped.flatMap((group) => {
    if (group.type === 'parent' && group.children) {
      return group.children.map((child) => ({
        ...child,
        parentName: group.parent?.name,
      }));
    }
    return group.item ? [group.item] : [];
  });
  setItems(processedItems);
}

/** Debounce POS grid search so rapid typing does not hit /api/items every keystroke */
const ITEM_SEARCH_DEBOUNCE_MS = 280;

/** Square grid: 2 cols phone · 3 cols iPad (md–lg) · dense on desktop (xl+). */
const CATALOG_ITEM_GRID_CLASS =
  'grid w-full gap-1.5 sm:gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-8 2xl:grid-cols-10';

/** Department catalog uses the same responsive column counts as POS. */
const SQUARE_CATALOG_CONTAINER_CLASS = '@container w-full';
const SQUARE_CATALOG_GRID_CLASS = CATALOG_ITEM_GRID_CLASS;

// Stock status helpers
function getStockStatus(stock: number): 'negative' | 'out' | 'low' | 'ok' {
  if (stock < 0) return 'negative';
  if (stock === 0) return 'out';
  if (stock < 10) return 'low';
  return 'ok';
}

function formatStock(stock: number, unitType: UnitType): string {
  if (stock < 0) {
    const decimals = unitType === 'kg' || unitType === 'g' ? 2 : 0;
    return `${stock.toFixed(decimals)} ${unitType}`;
  }
  if (stock === 0) return 'Out of stock';
  return `${stock} ${unitType}`;
}

function getQuickAddQuantity(item: Item): number {
  if (item.unit_type === 'kg' || item.unit_type === 'g') return 0.5;
  return 1;
}

// Rank badge colors for top sellers
const RANK_STYLES = [
  'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-amber-400/30',
  'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-slate-300/30',
  'bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-amber-600/30',
  'bg-[#1c6a1e]/15 text-[#1c6a1e] dark:bg-[#1c6a1e]/20 dark:text-[#2a8a30]',
];

function formatTilePrice(price: number) {
  return `KES ${price.toFixed(0)}`;
}

function PosProductTile({
  item,
  isOutOfStock,
  onSelect,
  onQuickAdd,
  imageContent,
  rank,
  showDealBadge = false,
}: {
  item: Item;
  isOutOfStock: boolean;
  onSelect: () => void;
  onQuickAdd?: (quantity: number) => void;
  imageContent: ReactNode;
  rank?: number;
  showDealBadge?: boolean;
}) {
  const quickQty = getQuickAddQuantity(item);
  const displayName = getItemDisplayName(item.name, item.variant_name);
  const hasDeal =
    showDealBadge &&
    item.bundle_quantity &&
    item.bundle_price &&
    item.bundle_quantity > 0 &&
    item.bundle_price > 0;

  return (
    <div
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      aria-disabled={isOutOfStock}
      onClick={() => {
        if (!isOutOfStock) onSelect();
      }}
      onKeyDown={(e) => {
        if (isOutOfStock) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`pos-grid-btn group touch-target relative flex aspect-square w-full min-h-0 flex-col overflow-hidden outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1c6a1e] focus-visible:ring-offset-1 ${
        isOutOfStock
          ? 'cursor-not-allowed border border-slate-200 bg-slate-50 opacity-55 dark:border-slate-600 dark:bg-slate-800/80'
          : 'cursor-pointer border border-[#1c6a1e] bg-white hover:border-[#2a8a30] dark:bg-slate-900 dark:border-[#1c6a1e]'
      }`}
    >
      {/* Image ~ top two-thirds */}
      <div className="relative min-h-0 w-full flex-[3] bg-slate-50 dark:bg-slate-800/50">
        {imageContent}

        {rank != null && (
          <div
            className={`absolute top-1 left-1 z-10 flex h-4 w-4 items-center justify-center text-[7px] font-black shadow ${
              RANK_STYLES[rank - 1]
            }`}
          >
            {rank}
          </div>
        )}

        {hasDeal && rank == null && (
          <div className="absolute top-1 left-1 z-10">
            <span className="inline-flex items-center gap-0.5 bg-amber-500 px-1 py-0.5 text-[7px] font-bold text-white shadow-sm">
              <Tag className="h-2 w-2" />
              Deal
            </span>
          </div>
        )}

        {onQuickAdd && !isOutOfStock && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(quickQty);
            }}
            className="absolute top-1 right-1 z-20 flex h-6 min-w-[1.375rem] items-center justify-center rounded-full bg-[#1c6a1e] px-1 text-[9px] font-bold leading-none text-white shadow-sm transition-colors hover:bg-[#165a18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title={`Quick add ${quickQty} ${item.unit_type}`}
          >
            +{quickQty}
          </button>
        )}
      </div>

      {/* Name + price — bottom strip */}
      <div className="flex min-h-[2.65rem] shrink-0 flex-col justify-center bg-white px-1.5 py-1 text-left dark:bg-slate-900">
        <h3
          className={`line-clamp-2 text-[10px] font-medium leading-tight ${
            isOutOfStock
              ? 'text-slate-400 dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {displayName}
        </h3>
        <p
          className={`mt-0.5 text-[10px] font-bold tabular-nums leading-none ${
            isOutOfStock
              ? 'text-slate-400 dark:text-slate-500'
              : 'text-[#1c6a1e] dark:text-[#3cb043]'
          }`}
        >
          {formatTilePrice(item.current_sell_price)}
          <span className="ml-0.5 font-normal text-slate-500 dark:text-slate-400">
            /{item.unit_type}
          </span>
        </p>
      </div>
    </div>
  );
}

function renderItemImageContent(item: Item, imageUrl: string | null) {
  if (imageUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
      <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
    </div>
  );
}

// Memoized item card component for better performance
const ItemCard = memo(function ItemCard({
  item,
  onSelect,
  onQuickAdd,
  allowSellOutOfStock = false,
}: {
  item: Item;
  onSelect: (item: Item) => void;
  onQuickAdd?: (item: Item, quantity: number) => void;
  allowSellOutOfStock?: boolean;
}) {
  const stockStatus = getStockStatus(item.current_stock);
  const isOutOfStock =
    !allowSellOutOfStock && (stockStatus === 'out' || stockStatus === 'negative');
  const imageUrl = resolveItemImageUrl(item);

  return (
    <PosProductTile
      item={item}
      isOutOfStock={isOutOfStock}
      onSelect={() => onSelect(item)}
      onQuickAdd={
        onQuickAdd ? (qty) => onQuickAdd(item, qty) : undefined
      }
      imageContent={renderItemImageContent(item, imageUrl)}
      showDealBadge
    />
  );
});

// Utility function to group items - memoized outside component
function groupItemsForDisplay(items: Item[]): GroupedItem[] {
  const parentItems = new Map<string, Item>();
  const childrenByParent = new Map<string, Item[]>();
  const standaloneItems: Item[] = [];
  const parentIds = new Set<string>();

  // First pass: identify parents and collect children
  for (const item of items) {
    if (!item.parent_item_id) {
      parentItems.set(item.id, item);
    } else {
      parentIds.add(item.parent_item_id);
      if (!childrenByParent.has(item.parent_item_id)) {
        childrenByParent.set(item.parent_item_id, []);
      }
      childrenByParent.get(item.parent_item_id)!.push(item);
    }
  }

  // Second pass: create grouped items
  const grouped: GroupedItem[] = [];

  // Add parent groups (and orphan variants when parent isn't in results - e.g. search by variant name)
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
    } else {
      // Parent not in results (e.g. searched "explode" - got variant but not parent)
      // Show each variant as standalone so they appear in search results
      for (const child of children.sort((a, b) =>
        (a.variant_name || a.name).localeCompare(b.variant_name || b.name)
      )) {
        grouped.push({ type: 'standalone', item: child });
      }
    }
  }

  // Add standalone items (items without parent and without children)
  for (const [id, item] of parentItems.entries()) {
    if (!parentIds.has(id) && !childrenByParent.has(id)) {
      standaloneItems.push(item);
    }
  }

  for (const item of standaloneItems) {
    grouped.push({ type: 'standalone', item });
  }

  // Sort: parents first (alphabetically), then standalone (alphabetically)
  return grouped.sort((a, b) => {
    if (a.type === 'parent' && b.type === 'parent') {
      return (a.parent?.name || '').localeCompare(b.parent?.name || '');
    }
    if (a.type === 'standalone' && b.type === 'standalone') {
      return (a.item?.name || '').localeCompare(b.item?.name || '');
    }
    return a.type === 'parent' ? -1 : 1;
  });
}

export function ItemGrid({
  categoryId,
  searchQuery,
  onSelectItem,
  onSelectParent,
  onQuickAdd,
  shopType = SHOP_TYPE_ALL,
  itemTypeKeys,
  categories: propCategories,
  featuredItems,
  lowStockItems,
  outStockItems,
  lowQuantityItems,
  stockListFilter = 'all',
  showLowStockStrip = false,
  canManageItemImages = false,
  onItemImageUpdated,
  itemTypesFilter,
  showShopTypeCatalog = false,
  allowSellOutOfStock = false,
}: ItemGridProps) {
  const catalogGridClass = showShopTypeCatalog
    ? SQUARE_CATALOG_GRID_CLASS
    : CATALOG_ITEM_GRID_CLASS;
  const [items, setItems] = useState<ItemWithVariants[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [showingOtherShopType, setShowingOtherShopType] = useState(false);
  /** Quick Sell only: filter featured items by stock band (badges in section header) */
  const [quickSellStockFilter, setQuickSellStockFilter] = useState<
    'all' | 'out' | 'low' | 'ok'
  >('all');

  // Use prop categories if available, otherwise use local state
  const categories = propCategories || localCategories;

  // Track last search to prevent duplicate requests
  const lastSearchRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Only fetch categories if not provided via props
  useEffect(() => {
    if (propCategories && propCategories.length > 0) return;

    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories', { cache: 'no-store' });
        const result = await response.json();
        if (result.success) {
          setLocalCategories(result.data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, [propCategories]);

  // Build category map for filtering - memoized
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat: Category) => {
      map.set(cat.id, cat.name);
    });
    return map;
  }, [categories]);

  const featuredForType = useMemo(
    () => (featuredItems ?? []).filter((i) => itemMatchesShopType(i, shopType)),
    [featuredItems, shopType]
  );
  const lowStockForType = useMemo(
    () => (lowStockItems ?? []).filter((i) => itemMatchesShopType(i, shopType)),
    [lowStockItems, shopType]
  );
  const outPoolForType = useMemo(
    () => (outStockItems ?? []).filter((i) => itemMatchesShopType(i, shopType)),
    [outStockItems, shopType]
  );
  const lowQtyPoolForType = useMemo(
    () => (lowQuantityItems ?? []).filter((i) => itemMatchesShopType(i, shopType)),
    [lowQuantityItems, shopType]
  );

  const adminStockView = stockListFilter === 'out' || stockListFilter === 'low';
  const primaryHomeItems = adminStockView
    ? stockListFilter === 'out'
      ? outPoolForType
      : lowQtyPoolForType
    : featuredForType;

  useEffect(() => {
    setQuickSellStockFilter('all');
  }, [stockListFilter]);

  const featuredStockCounts = useMemo(() => {
    let out = 0;
    let low = 0;
    let ok = 0;
    for (const i of featuredForType) {
      const s = getStockStatus(i.current_stock);
      if (s === 'out' || s === 'negative') out += 1;
      else if (s === 'low') low += 1;
      else ok += 1;
    }
    return { out, low, ok, popular: featuredForType.length };
  }, [featuredForType]);

  const hasHomePool = adminStockView
    ? primaryHomeItems.length > 0
    : featuredForType.length > 0;

  const displayedHomeItems = useMemo(() => {
    if (adminStockView) return primaryHomeItems;
    switch (quickSellStockFilter) {
      case 'all':
        return featuredForType;
      case 'out':
        return featuredForType.filter((i) => {
          const s = getStockStatus(i.current_stock);
          return s === 'out' || s === 'negative';
        });
      case 'low':
        return featuredForType.filter((i) => getStockStatus(i.current_stock) === 'low');
      case 'ok':
        return featuredForType.filter((i) => getStockStatus(i.current_stock) === 'ok');
      default:
        return featuredForType;
    }
  }, [adminStockView, primaryHomeItems, featuredForType, quickSellStockFilter]);

  // Memoized item click handler
  const handleItemClick = useCallback((item: ItemWithVariants) => {
    onSelectItem(item);
  }, [onSelectItem]);

  useEffect(() => {
    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchQuery) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const q = searchQuery;
      const tid = window.setTimeout(() => {
        void (async () => {
          if (controller.signal.aborted) return;

          const searchKey = `${q}\0${shopType}`;
          if (lastSearchRef.current === searchKey) return;
          lastSearchRef.current = searchKey;

          try {
            setLoading(true);
            setError(null);

            const response = await fetch(
              `/api/items?search=${encodeURIComponent(q)}&sellableOnly=true&limit=50${itemTypesQueryParam(itemTypesFilter)}`,
              { signal: controller.signal, cache: 'no-store' }
            );

            if (controller.signal.aborted) return;

            const result = await response.json();

            if (result.success) {
              const allItems: Item[] = result.data;

              let filteredItems: Item[];
              let isShowingOtherShopType = false;

              if (shopType === SHOP_TYPE_ALL) {
                filteredItems = allItems;
              } else {
                const matchesTypeFilter = (items: Item[], type: string) =>
                  items.filter((item) => {
                    const categoryName = categoryMap.get(item.category_id);
                    if (categoryName && !shouldShowCategory(categoryName, type)) return false;
                    return itemMatchesShopType(item, type);
                  });

                filteredItems = matchesTypeFilter(allItems, shopType);

                if (filteredItems.length === 0 && allItems.length > 0) {
                  const keys = itemTypeKeys?.length ? itemTypeKeys : ['grocery', 'retail'];
                  for (const key of keys) {
                    if (key === shopType) continue;
                    const alt = matchesTypeFilter(allItems, key);
                    if (alt.length > 0) {
                      filteredItems = alt;
                      isShowingOtherShopType = true;
                      break;
                    }
                  }
                }
              }

              setShowingOtherShopType(isShowingOtherShopType);

              const grouped = groupItemsForDisplay(filteredItems);
              setGroupedItems(grouped);

              const processedItems: ItemWithVariants[] = grouped.flatMap((group) => {
                if (group.type === 'parent' && group.children) {
                  return group.children.map((child) => ({
                    ...child,
                    parentName: group.parent?.name,
                  }));
                }
                return group.item ? [group.item] : [];
              });
              setItems(processedItems);
            } else {
              setError(result.message || 'Failed to search items');
            }
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setError('Failed to search items');
            console.error('Error searching items:', err);
          } finally {
            if (!controller.signal.aborted) {
              setLoading(false);
            }
          }
        })();
      }, ITEM_SEARCH_DEBOUNCE_MS);

      return () => {
        window.clearTimeout(tid);
        controller.abort();
      };
    }

    // Reset last search when query is cleared
    lastSearchRef.current = '';
    setShowingOtherShopType(false);

    if (!searchQuery && !categoryId && showShopTypeCatalog) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      async function fetchCatalog() {
        try {
          setLoading(true);
          setError(null);

          const response = await fetch(
            `/api/items?all=true&sellableOnly=true${catalogTypeQuery(shopType, itemTypesFilter)}`,
            { signal: controller.signal, cache: 'no-store' },
          );

          if (controller.signal.aborted) return;

          const result = await response.json();

          if (result.success) {
            applyItemsToGrid(result.data ?? [], shopType, setGroupedItems, setItems);
          } else {
            setError(result.message || 'Failed to load items');
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setError('Failed to load items');
          console.error('Error fetching catalog items:', err);
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }

      void fetchCatalog();

      return () => {
        controller.abort();
      };
    }

    if (!categoryId) {
      setItems([]);
      setGroupedItems([]);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function fetchItems() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/items?categoryId=${categoryId}${itemTypesQueryParam(itemTypesFilter)}`,
          { signal: controller.signal, cache: 'no-store' }
        );

        if (controller.signal.aborted) return;

        const result = await response.json();

        if (result.success) {
          const allItems: Item[] = result.data;
          applyItemsToGrid(allItems, shopType, setGroupedItems, setItems);
        } else {
          setError(result.message || 'Failed to load items');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Failed to load items');
        console.error('Error fetching items:', err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchItems();

    return () => {
      controller.abort();
    };
  }, [categoryId, searchQuery, shopType, categoryMap, itemTypeKeys, itemTypesFilter, showShopTypeCatalog]);

  if (!categoryId && !searchQuery && !showShopTypeCatalog) {
    const hasLowStock = showLowStockStrip && !adminStockView && lowStockForType.length > 0;
    const hasContent = hasHomePool || hasLowStock;
    const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

    if (adminStockView && primaryHomeItems.length === 0) {
      return (
        <div className="mx-4 sm:mx-6 lg:mx-8 p-4 sm:p-6 flex items-center justify-center h-full">
          <div className="text-center space-y-3 max-w-md animate-in fade-in duration-500">
            <div
              className={`w-16 h-16 mx-auto rounded-none flex items-center justify-center ${
                stockListFilter === 'out'
                  ? 'bg-red-100 dark:bg-red-950/40'
                  : 'bg-amber-100 dark:bg-amber-950/40'
              }`}
            >
              {stockListFilter === 'out' ? (
                <PackageX className="w-8 h-8 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
              {stockListFilter === 'out'
                ? 'No out-of-stock products here'
                : 'No low-quantity products here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {shopType === SHOP_TYPE_ALL
                ? 'Try another stock filter or department.'
                : 'Try “All” departments or another filter.'}
            </p>
          </div>
        </div>
      );
    }

    if (!hasContent) {
      return (
        <div className="mx-4 sm:mx-6 lg:mx-8 p-4 sm:p-6 flex items-center justify-center h-full">
          <div className="text-center space-y-4 max-w-md animate-in fade-in duration-500">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#1c6a1e]/15 to-[#2a8a30]/10 rounded-none flex items-center justify-center shadow-lg">
              <ShoppingBag className="w-9 h-9 text-[#1c6a1e]" />
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              Ready to sell
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
              Pick a category above or search for products to get started
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-full flex flex-col mx-2 sm:mx-4 lg:mx-6 px-2 sm:px-3 py-1 animate-in fade-in duration-300">

        {/* ── Quick Sell / admin stock views ── */}
        {hasHomePool && (
          <section className="min-h-0 flex flex-col flex-1 rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm pt-3 px-1 sm:px-1.5 pb-1 overflow-visible justify-start">
            {/* Section header - compact */}
            <div className="flex items-center gap-1.5 mb-0.5 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-none flex items-center justify-center shadow-sm ${
                  adminStockView
                    ? stockListFilter === 'out'
                      ? 'bg-red-600'
                      : 'bg-amber-500'
                    : 'bg-[#1c6a1e]'
                }`}
              >
                {adminStockView ? (
                  stockListFilter === 'out' ? (
                    <PackageX className="w-3 h-3 text-white" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-white" />
                  )
                ) : (
                  <Flame className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-gray-800 dark:text-gray-100 tracking-tight leading-none">
                  {adminStockView
                    ? stockListFilter === 'out'
                      ? 'Out of stock'
                      : 'Low stock · under 10'
                    : 'Quick Sell'}
                </h2>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {adminStockView ? (
                    <>Tap a product to open details</>
                  ) : (
                    <>
                      Tap <span className="text-[#1c6a1e] font-semibold">⚡</span> to add
                    </>
                  )}
                </p>
              </div>
              {!adminStockView && (
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <button
                    type="button"
                    aria-pressed={quickSellStockFilter === 'all'}
                    onClick={() => setQuickSellStockFilter('all')}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-none border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c6a1e] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                      quickSellStockFilter === 'all'
                        ? 'text-[#1c6a1e] dark:text-[#2a8a30] bg-[#1c6a1e]/15 dark:bg-[#1c6a1e]/20 border-[#1c6a1e]/40 dark:border-[#1c6a1e]/35 ring-2 ring-[#1c6a1e]/35 ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                        : 'text-[#1c6a1e] dark:text-[#2a8a30] bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/15 border-[#1c6a1e]/20 dark:border-[#1c6a1e]/25 hover:bg-[#1c6a1e]/14'
                    }`}
                  >
                    {featuredStockCounts.popular} popular
                  </button>
                  <button
                    type="button"
                    aria-pressed={quickSellStockFilter === 'out'}
                    onClick={() => setQuickSellStockFilter('out')}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                      quickSellStockFilter === 'out'
                        ? 'bg-red-100/90 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 ring-2 ring-red-400/50 ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                        : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-800/50 hover:bg-red-100/70 dark:hover:bg-red-950/55'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-none bg-red-500" />
                    {featuredStockCounts.out} out
                  </button>
                  <button
                    type="button"
                    aria-pressed={quickSellStockFilter === 'low'}
                    onClick={() => setQuickSellStockFilter('low')}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                      quickSellStockFilter === 'low'
                        ? 'bg-amber-100/90 dark:bg-amber-950/45 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/50 ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/50 hover:bg-amber-100/70 dark:hover:bg-amber-950/50'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-none bg-amber-500" />
                    {featuredStockCounts.low} low
                  </button>
                  <button
                    type="button"
                    aria-pressed={quickSellStockFilter === 'ok'}
                    onClick={() => setQuickSellStockFilter('ok')}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
                      quickSellStockFilter === 'ok'
                        ? 'bg-emerald-100/90 dark:bg-emerald-950/45 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/45 ring-offset-1 ring-offset-white dark:ring-offset-slate-900'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50'
                    }`}
                  >
                    <span className="w-1 h-1 rounded-none bg-emerald-500" />
                    {featuredStockCounts.ok} in stock
                  </button>
                </div>
              )}
              {adminStockView && (
                <span className="text-[10px] font-semibold tabular-nums text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-none border border-slate-200 dark:border-slate-600">
                  {primaryHomeItems.length} items
                </span>
              )}
            </div>

            {/* Products grid – dense square tiles */}
            <div className={`${CATALOG_ITEM_GRID_CLASS} pt-3 flex-1 min-h-0 content-start`}>
              {(() => {
                if (!adminStockView && displayedHomeItems.length === 0) {
                  return (
                    <div className="col-span-full py-10 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                      No Quick Sell products match this filter.
                    </div>
                  );
                }
                const top3Ranks = adminStockView
                  ? new Map<string, number>()
                  : new Map(
                      [...featuredForType]
                        .filter((i) => ((i as { quantity_sold?: number }).quantity_sold ?? 0) > 0)
                        .sort(
                          (a, b) =>
                            ((b as { quantity_sold?: number }).quantity_sold ?? 0) -
                            ((a as { quantity_sold?: number }).quantity_sold ?? 0)
                        )
                        .slice(0, 3)
                        .map((i, idx) => [i.id, idx + 1])
                    );
                return [...displayedHomeItems]
                  .sort((a, b) => {
                    const nameA = `${a.name} ${a.variant_name || ''}`.trim().toLowerCase();
                    const nameB = `${b.name} ${b.variant_name || ''}`.trim().toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((item) => {
                const rank = top3Ranks.get(item.id);
                const stock = getStockStatus(item.current_stock);
                const isOut =
                  !allowSellOutOfStock &&
                  (stock === 'out' || stock === 'negative');
                const imageUrl = resolveItemImageUrl(item);

                const imageContent = canManageItemImages ? (
                  <div className="absolute inset-0">
                    <PosQuickSellPhoto
                      itemId={item.id}
                      itemName={item.name}
                      imageUrl={item.image_url}
                      variantName={item.variant_name}
                      onImageUrlChange={(url) =>
                        onItemImageUpdated?.(item.id, url)
                      }
                      fill
                    />
                  </div>
                ) : (
                  renderItemImageContent(item, imageUrl)
                );

                return (
                  <PosProductTile
                    key={item.id}
                    item={item}
                    isOutOfStock={isOut}
                    onSelect={() => onSelectItem(item)}
                    onQuickAdd={
                      onQuickAdd
                        ? (qty) => onQuickAdd(item, qty)
                        : undefined
                    }
                    imageContent={imageContent}
                    rank={rank}
                    showDealBadge
                  />
                );
                  });
              })()}
            </div>
          </section>
        )}

        {/* ── ⚠️ Low Stock – Below fold, scroll to see ── */}
        {hasLowStock && (
          <section className="flex-shrink-0 rounded-none border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50 p-1.5 mt-2">
            <div className="flex items-center gap-1.5 mb-1">
              <h2 className="text-[9px] font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                Low Stock
              </h2>
              <span className="text-[8px] text-amber-600 dark:text-amber-400">
                {lowStockForType.length} items
              </span>
            </div>

            {/* Horizontal scrollable strip */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {lowStockForType.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="group flex-shrink-0 flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-none border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-800/80 hover:border-amber-400 dark:hover:border-amber-600 min-w-[120px] max-w-[160px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <div className="w-5 h-5 rounded-none bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Package className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[11px] font-medium text-gray-800 dark:text-gray-200 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors uppercase tracking-tight break-words">
                      {getItemDisplayName(item.name, item.variant_name)}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`text-[8px] font-semibold tabular-nums ${
                          item.current_stock < 0
                            ? 'text-red-600 dark:text-red-400'
                            : item.current_stock === 0
                              ? 'text-red-500'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.current_stock < 0
                          ? formatStock(item.current_stock, item.unit_type)
                          : item.current_stock === 0
                            ? 'OUT'
                            : `${item.current_stock} left`}
                      </span>
                      <span className="text-[7px] text-gray-400">·</span>
                      <span className="text-[8px] text-gray-400 font-medium">
                        {formatPrice(item.current_sell_price)}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-2.5 h-2.5 text-gray-300 dark:text-gray-600 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

if (loading) {
  return (
    <div
      className={
        showShopTypeCatalog
          ? 'px-3 sm:px-4 py-3 min-h-full'
          : 'mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 py-4 sm:py-6'
      }
    >
      <div className={showShopTypeCatalog ? SQUARE_CATALOG_CONTAINER_CLASS : undefined}>
      <div className={catalogGridClass}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden animate-pulse ${
              showShopTypeCatalog ? 'aspect-square' : ''
            }`}
          >
            {!showShopTypeCatalog && (
            <div className="p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="space-y-1.5">
                <div className="h-3.5 bg-gray-100 dark:bg-gray-700 rounded-none w-[85%]" />
                <div className="h-3 bg-gray-50 dark:bg-gray-700/50 rounded-none w-[55%]" />
              </div>
              <div className="mt-1">
                <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded-none w-[45%]" />
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/30">
                <div className="h-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-none w-[35%]" />
              </div>
            </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

if (error) {
  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 p-4 flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-none flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <p className="text-destructive font-semibold">Error: {error}</p>
      </div>
    </div>
  );
}

if (items.length === 0 && !loading) {
  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 p-6 flex items-center justify-center h-full min-h-[300px]">
      <div className="text-center space-y-5 max-w-sm">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1c6a1e]/10 to-[#2a8a30]/10 rounded-none rotate-6" />
          <div className="relative w-20 h-20 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-none flex items-center justify-center border-2 border-slate-300 dark:border-slate-500 shadow-sm">
            <svg className="w-9 h-9 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {searchQuery
              ? 'No products found'
              : 'No items in this category'}
          </p>
          {searchQuery && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                We couldn&apos;t find anything matching &quot;<span className="font-medium text-gray-700 dark:text-gray-300">{searchQuery}</span>&quot;
              </p>
              <div className="pt-3 flex flex-col gap-1.5 items-start mx-auto max-w-[200px]">
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className="w-1 h-1 rounded-none bg-gray-300 dark:bg-gray-600" />
                  <span>Check for spelling errors</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className="w-1 h-1 rounded-none bg-gray-300 dark:bg-gray-600" />
                  <span>Try different keywords</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className="w-1 h-1 rounded-none bg-gray-300 dark:bg-gray-600" />
                  <span>Browse by category instead</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

return (
  <div
    className={
      showShopTypeCatalog
        ? 'px-3 sm:px-4 py-3 sm:py-4 min-h-full'
        : 'mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 py-4 sm:py-6 flex items-start justify-center min-h-full'
    }
  >
    <div
      className={
        showShopTypeCatalog
          ? SQUARE_CATALOG_CONTAINER_CLASS
          : 'w-full max-w-6xl rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/80 shadow-sm px-4 sm:px-6 py-4 sm:py-5'
      }
    >
      {searchQuery && items.length > 0 && (
        <div className="mb-6 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm shadow-[#1c6a1e]/20">
                <span className="text-white text-xs font-bold">{items.length}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {items.length} result{items.length !== 1 ? 's' : ''} found
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  for &quot;<span className="text-gray-600 dark:text-gray-300 font-medium">{searchQuery}</span>&quot;
                </p>
              </div>
            </div>
          </div>
          {showingOtherShopType && shopType !== SHOP_TYPE_ALL && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50/80 dark:bg-amber-900/15 border-2 border-amber-300 dark:border-amber-700 rounded-none">
              <div className="w-5 h-5 rounded-none bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 text-[10px] font-bold">i</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-200/80">
                No results in <span className="font-semibold">{shopType}</span> mode. Showing results from another department instead.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="space-y-6">
        {/* Render parent groups */}
        {groupedItems.filter(g => g.type === 'parent').map((group) => {
          if (!group.parent || !group.children || group.children.length === 0) return null;
          return (
            <div key={group.parent.id} className="rounded-none border-2 border-slate-300 dark:border-slate-600 bg-gradient-to-br from-white via-white to-[#1c6a1e]/[0.02] dark:from-slate-800/60 dark:via-slate-800/40 dark:to-[#1c6a1e]/[0.05] overflow-hidden">
              {/* Parent header */}
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="w-8 h-8 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm shadow-[#1c6a1e]/20 flex-shrink-0">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 truncate">
                    {group.parent.name}
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {group.children.length} variant{group.children.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {/* Children Grid */}
              <div className="p-3 sm:p-4">
                <div className={catalogGridClass}>
                  {group.children.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onSelect={handleItemClick}
                      onQuickAdd={onQuickAdd}
                      allowSellOutOfStock={allowSellOutOfStock}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Render standalone items grouped together */}
        {groupedItems.filter(g => g.type === 'standalone').length > 0 && (
          <div>
            {/* Section label if there are also parent groups */}
            {groupedItems.some(g => g.type === 'parent') && (
              <div className="flex items-center gap-2.5 mb-3 px-1">
                <div className="w-6 h-6 rounded-none bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Individual Products
                </h3>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
            )}
            <div className={catalogGridClass}>
              {groupedItems.filter(g => g.type === 'standalone').map((group) => (
                group.item && (
                  <ItemCard
                    key={group.item.id}
                    item={group.item}
                    onSelect={handleItemClick}
                    onQuickAdd={onQuickAdd}
                    allowSellOutOfStock={allowSellOutOfStock}
                  />
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}

