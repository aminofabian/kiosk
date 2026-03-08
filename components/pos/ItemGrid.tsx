'use client';

import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Tag, Package, ShoppingBag, Flame, AlertTriangle, ArrowRight } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { shouldShowCategory } from '@/lib/utils/shop-type';
import { getItemDisplayName } from '@/lib/utils';

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
}

// Stock status helpers
function getStockStatus(stock: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  return 'ok';
}

function formatStock(stock: number, unitType: UnitType): string {
  if (stock <= 0) return 'Out of stock';
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

// Memoized item card component for better performance
const ItemCard = memo(function ItemCard({
  item,
  onSelect,
  onQuickAdd,
}: {
  item: Item;
  onSelect: (item: Item) => void;
  onQuickAdd?: (item: Item, quantity: number) => void;
}) {
  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;
  const stockStatus = getStockStatus(item.current_stock);
  const quickQty = getQuickAddQuantity(item);
  const isOutOfStock = stockStatus === 'out';

  return (
    <Card
      role="button"
      tabIndex={0}
      className={`pos-grid-btn group cursor-pointer touch-target relative overflow-hidden rounded-none outline-none focus-visible:ring-2 focus-visible:ring-[#1c6a1e] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 transition-all duration-200 ${isOutOfStock
        ? 'bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-slate-800/60 dark:to-slate-800/40 border-2 border-slate-300 dark:border-slate-500 opacity-75 hover:opacity-100'
        : 'bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-800/95 dark:to-slate-800/70 border-2 border-slate-300 dark:border-slate-500 hover:border-[#1c6a1e] dark:hover:border-[#1c6a1e]'
        }`}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[4px] rounded-l-none transition-all duration-200 ${isOutOfStock
        ? 'bg-gray-300 dark:bg-gray-600'
        : stockStatus === 'low'
          ? 'bg-amber-400'
          : 'bg-gradient-to-b from-[#1c6a1e] to-[#2a8a30] opacity-0 group-hover:opacity-100'
        }`} />

      <CardContent className="p-2.5 sm:p-3 flex flex-col h-full">
        {/* Top row: Name + Quick Add */}
        <div className="flex items-start justify-between gap-2 mb-auto">
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-[14px] sm:text-[16px] leading-tight transition-colors uppercase tracking-tight break-words ${isOutOfStock
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-800 dark:text-gray-100 group-hover:text-[#1c6a1e] dark:group-hover:text-[#2a8a30]'
              }`}>
              {getItemDisplayName(item.name, item.variant_name)}
            </h3>
          </div>

          {onQuickAdd && !isOutOfStock && (
            <Button
              size="sm"
              variant="default"
              className="h-8 px-2 flex items-center justify-center gap-1.5 flex-shrink-0 transition-all duration-200 rounded-none bg-gradient-to-b from-[#1c6a1e] to-[#1e8a72] hover:from-[#1e8a72] hover:to-[#178266] text-white text-xs font-semibold shadow-md shadow-[#1c6a1e]/25 hover:shadow-lg hover:shadow-[#1c6a1e]/30 active:scale-95 -mt-0.5 -mr-1 focus-visible:ring-2 focus-visible:ring-[#1c6a1e] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(item, quickQty);
              }}
              title={`Quick add ${quickQty} ${item.unit_type}`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>+{quickQty}</span>
            </Button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-2" />

        {/* Price section */}
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-lg sm:text-xl font-bold tracking-tight ${isOutOfStock
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-[#1c6a1e]'
              }`}>
              {formatPrice(item.current_sell_price)}
            </span>
            <span className="text-[11px] sm:text-[12px] text-gray-400 dark:text-gray-500 font-medium">
              /{item.unit_type}
            </span>
          </div>

          {/* Bundle deal */}
          {item.bundle_quantity && item.bundle_price && item.bundle_quantity > 0 && item.bundle_price > 0 && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-none border border-amber-200/60 dark:border-amber-700/40">
                <Tag className="w-2.5 h-2.5" />
                {item.bundle_name || `${item.bundle_quantity} for ${formatPrice(item.bundle_price)}`}
              </span>
            </div>
          )}
        </div>

        {/* Batch number (when available) */}
        {item.batch_number && !isOutOfStock && (
          <div className="mt-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Lot: {item.batch_number}
            </span>
          </div>
        )}

        {/* Stock indicator */}
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/40">
          <div className="flex items-center gap-1.5">
            {stockStatus === 'out' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-none bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                  Out of stock
                </span>
              </>
            ) : stockStatus === 'low' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-none bg-amber-400 animate-pulse flex-shrink-0" />
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {formatStock(item.current_stock, item.unit_type)}
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-none bg-emerald-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  {formatStock(item.current_stock, item.unit_type)}
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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
  shopType = 'grocery',
  itemTypeKeys,
  categories: propCategories,
  featuredItems,
  lowStockItems,
}: ItemGridProps) {
  const [items, setItems] = useState<ItemWithVariants[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [showingOtherShopType, setShowingOtherShopType] = useState(false);

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
      // Skip if same search
      if (lastSearchRef.current === searchQuery) return;
      lastSearchRef.current = searchQuery;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      async function searchItems() {
        try {
          setLoading(true);
          setError(null);

          // Request limited results with sellableOnly for faster response
          const response = await fetch(
            `/api/items?search=${encodeURIComponent(searchQuery || '')}&sellableOnly=true&limit=50`,
            { signal: controller.signal, cache: 'no-store' }
          );

          if (controller.signal.aborted) return;

          const result = await response.json();

          if (result.success) {
            const allItems: Item[] = result.data;

            // When searching, show ALL results - user explicitly searched and wants to find the item
            // (including variants by variant name, even if in a different shop type)
            let filteredItems: Item[];
            let isShowingOtherShopType = false;
            if (searchQuery) {
              filteredItems = allItems;
            } else {
              // Category browse: filter by shop type
              const filteredByShopType = allItems.filter(item => {
                const categoryName = categoryMap.get(item.category_id);
                if (!categoryName) return true;
                return shouldShowCategory(categoryName, shopType);
              });
              if (filteredByShopType.length === 0 && allItems.length > 0) {
                const keys = itemTypeKeys?.length ? itemTypeKeys : ['grocery', 'retail'];
                const otherShopType = keys.find(k => k !== shopType) ?? keys[0];
                filteredItems = allItems.filter(item => {
                  const categoryName = categoryMap.get(item.category_id);
                  if (!categoryName) return true;
                  return shouldShowCategory(categoryName, otherShopType);
                });
                isShowingOtherShopType = filteredItems.length > 0;
              } else {
                filteredItems = filteredByShopType;
              }
            }

            setShowingOtherShopType(isShowingOtherShopType);

            // Use optimized grouping function
            const grouped = groupItemsForDisplay(filteredItems);
            setGroupedItems(grouped);

            // Create flat list for backward compatibility
            const processedItems: ItemWithVariants[] = grouped.flatMap(group => {
              if (group.type === 'parent' && group.children) {
                return group.children.map(child => ({
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
      }

      searchItems();
      return;
    }

    // Reset last search when query is cleared
    lastSearchRef.current = '';
    setShowingOtherShopType(false);

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
          `/api/items?categoryId=${categoryId}`,
          { signal: controller.signal, cache: 'no-store' }
        );

        if (controller.signal.aborted) return;

        const result = await response.json();

        if (result.success) {
          const allItems: Item[] = result.data;

          // Use optimized grouping function
          const grouped = groupItemsForDisplay(allItems);
          setGroupedItems(grouped);

          // Create flat list for backward compatibility
          const processedItems: ItemWithVariants[] = grouped.flatMap(group => {
            if (group.type === 'parent' && group.children) {
              return group.children.map(child => ({
                ...child,
                parentName: group.parent?.name,
              }));
            }
            return group.item ? [group.item] : [];
          });
          setItems(processedItems);
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
  }, [categoryId, searchQuery, shopType, categoryMap]);

  if (!categoryId && !searchQuery) {
    const hasFeatured = featuredItems && featuredItems.length > 0;
    const hasLowStock = lowStockItems && lowStockItems.length > 0;
    const hasContent = hasFeatured || hasLowStock;
    const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

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

        {/* ── 🔥 Quick Sell – First screen only ── */}
        {hasFeatured && (
          <section className="min-h-0 flex flex-col flex-1 rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm pt-3 px-1 sm:px-1.5 pb-1 overflow-visible flex-shrink-0 justify-center">
            {/* Section header - compact */}
            <div className="flex items-center gap-1.5 mb-0.5 flex-shrink-0">
              <div className="w-6 h-6 rounded-none bg-[#1c6a1e] flex items-center justify-center shadow-sm">
                <Flame className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-gray-800 dark:text-gray-100 tracking-tight leading-none">
                  Quick Sell
                </h2>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Tap <span className="text-[#1c6a1e] font-semibold">⚡</span> to add
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold text-[#1c6a1e] dark:text-[#2a8a30] bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/15 px-2 py-1 rounded-none border border-[#1c6a1e]/20 dark:border-[#1c6a1e]/25 shadow-sm">
                  {featuredItems!.length} popular
                </span>
                {(() => {
                  const out = featuredItems!.filter(i => getStockStatus(i.current_stock) === 'out').length;
                  const low = featuredItems!.filter(i => getStockStatus(i.current_stock) === 'low').length;
                  const ok = featuredItems!.filter(i => getStockStatus(i.current_stock) === 'ok').length;
                  return (
                    <span className="flex items-center gap-1">
                      {out > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/50">
                          <span className="w-1 h-1 rounded-none bg-red-500" />
                          {out} out
                        </span>
                      )}
                      {low > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50">
                          <span className="w-1 h-1 rounded-none bg-amber-500" />
                          {low} low
                        </span>
                      )}
                      {ok > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
                          <span className="w-1 h-1 rounded-none bg-emerald-500" />
                          {ok} in stock
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Products grid – sorted alphabetically so related items appear together */}
            <div className="mx-auto max-w-6xl grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-10 xl:grid-cols-10 gap-x-5 gap-y-6 sm:gap-x-6 sm:gap-y-7 overflow-visible pt-3 flex-1 min-h-0" style={{ gridAutoRows: '110px' }}>
              {(() => {
                const top3Ranks = new Map(
                  [...featuredItems!]
                    .filter((i) => ((i as { quantity_sold?: number }).quantity_sold ?? 0) > 0)
                    .sort((a, b) => ((b as { quantity_sold?: number }).quantity_sold ?? 0) - ((a as { quantity_sold?: number }).quantity_sold ?? 0))
                    .slice(0, 3)
                    .map((i, idx) => [i.id, idx + 1])
                );
                return [...featuredItems!]
                  .sort((a, b) => {
                    const nameA = `${a.name} ${a.variant_name || ''}`.trim().toLowerCase();
                    const nameB = `${b.name} ${b.variant_name || ''}`.trim().toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((item) => {
                const rank = top3Ranks.get(item.id);
                const stock = getStockStatus(item.current_stock);
                const isOut = stock === 'out';
                const quickQty = getQuickAddQuantity(item);

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectItem(item);
                      }
                    }}
                    className={`pos-grid-btn group relative rounded-none overflow-visible cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#1c6a1e] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 flex flex-col ${
                      isOut
                        ? 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-500 opacity-60'
                        : 'bg-white dark:bg-slate-800 border border-[#1c6a1e] dark:border-[#1c6a1e]'
                    }`}
                  >
                    {/* Price label layered on top border */}
                    <div className="absolute left-1.5 top-0 -translate-y-1/2 z-20 px-1 py-px rounded-none bg-white dark:bg-slate-900 border border-[#1c6a1e] text-[#1c6a1e] text-[8px] sm:text-[9px] font-semibold tabular-nums leading-none">
                      {formatPrice(item.current_sell_price)}
                    </div>

                    {/* Rank badge for top 3 */}
                    {rank != null && (
                      <div
                        className={`absolute top-0.5 right-0.5 z-10 w-4 h-4 rounded-none flex items-center justify-center text-[8px] font-black shadow ${
                          RANK_STYLES[rank - 1]
                        }`}
                      >
                        {rank}
                      </div>
                    )}

                    {/* Bundle deal badge */}
                    {item.bundle_quantity &&
                      item.bundle_price &&
                      item.bundle_quantity > 0 &&
                      item.bundle_price > 0 && (
                        <div className="absolute top-0.5 right-0.5 z-10">
                          <span className="inline-flex items-center gap-0.5 bg-amber-400/90 text-white text-[6px] font-bold px-0.5 py-px rounded-none shadow-sm">
                            <Tag className="w-1.5 h-1.5" />
                            Deal
                          </span>
                        </div>
                      )}

                    {/* Product name */}
                    <div className="px-1.5 pt-3 flex-1 min-h-0 overflow-hidden">
                      <h3
                        className={`font-semibold text-[9px] sm:text-[10px] leading-tight transition-colors uppercase tracking-tight break-words ${
                          isOut
                            ? 'text-gray-400 dark:text-gray-500'
                            : 'text-gray-800 dark:text-gray-100 group-hover:text-[#1c6a1e] dark:group-hover:text-[#2a8a30]'
                        }`}
                      >
                        {getItemDisplayName(item.name, item.variant_name)}
                      </h3>
                    </div>

                    {/* Bottom row: stock + quick add */}
                    <div className="px-1.5 pb-1 pt-0.5 flex items-center justify-between gap-0.5 flex-shrink-0 mt-auto">
                      <div className="flex items-center gap-0.5 min-w-0">
                        <span
                          className={`w-1 h-1 rounded-none flex-shrink-0 ${
                            isOut
                              ? 'bg-gray-300 dark:bg-gray-600'
                              : stock === 'low'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span
                          className={`text-[7px] sm:text-[8px] font-medium truncate ${
                            isOut
                              ? 'text-gray-400'
                              : stock === 'low'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {isOut ? 'Out' : formatStock(item.current_stock, item.unit_type)}
                        </span>
                      </div>

                      {/* Quick-add button – instantly adds to cart */}
                      {onQuickAdd && !isOut && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickAdd(item, quickQty);
                          }}
                          className="flex items-center justify-center gap-0.5 h-4 sm:h-5 px-1 rounded-none bg-[#1c6a1e] hover:bg-[#1e8a72] text-white text-[8px] sm:text-[9px] font-bold shadow-sm transition-all duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c6a1e] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                          title={`Quick add ${quickQty} ${item.unit_type}`}
                        >
                          <Zap className="w-2 h-2" />
                          <span>+{quickQty}</span>
                        </button>
                      )}
                    </div>
                  </div>
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
                {lowStockItems!.length} items
              </span>
            </div>

            {/* Horizontal scrollable strip */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {lowStockItems!.map((item) => (
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
                      <span className={`text-[8px] font-semibold tabular-nums ${item.current_stock <= 0 ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                        {item.current_stock <= 0 ? 'OUT' : `${item.current_stock} left`}
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
    <div className="mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 py-4 sm:py-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden animate-pulse">
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
          </div>
        ))}
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
  <div className="mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 py-4 sm:py-6 flex items-start justify-center min-h-full">
    <div className="w-full max-w-6xl rounded-none border-2 border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/80 shadow-sm px-4 sm:px-6 py-4 sm:py-5">
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
          {showingOtherShopType && (
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                  {group.children.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onSelect={handleItemClick}
                      onQuickAdd={onQuickAdd}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {groupedItems.filter(g => g.type === 'standalone').map((group) => (
                group.item && (
                  <ItemCard
                    key={group.item.id}
                    item={group.item}
                    onSelect={handleItemClick}
                    onQuickAdd={onQuickAdd}
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

