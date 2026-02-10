'use client';

import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Tag } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';

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
  shopType?: ShopType;
  categories?: Category[]; // Pass categories from parent to avoid redundant fetch
}

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
  const formatStock = (stock: number, unitType: UnitType) => {
    if (stock <= 0) return 'Out of stock';
    if (stock < 10) return `Low (${stock} ${unitType})`;
    return `${stock} ${unitType}`;
  };
  const isLowStock = (stock: number) => stock > 0 && stock < 10;
  const getQuickAddQuantity = (item: Item): number => {
    if (item.unit_type === 'kg' || item.unit_type === 'g') return 0.5;
    return 1;
  };

  const quickQty = getQuickAddQuantity(item);

  return (
    <Card
      className="group cursor-pointer hover:-translate-y-0.5 transition-all duration-200 ease-out touch-target bg-white dark:bg-slate-800/80 border-gray-200/80 dark:border-gray-700/40 hover:border-[#259783]/50 dark:hover:border-[#259783]/40 shadow-sm hover:shadow-lg hover:shadow-[#259783]/[0.06] relative overflow-hidden"
      onClick={() => onSelect(item)}
    >
      {/* Subtle top accent on hover */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#259783] to-[#3bd522] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-sm sm:text-base line-clamp-2 text-gray-800 dark:text-gray-200 min-h-[2.5rem] leading-tight group-hover:text-[#259783] dark:group-hover:text-[#3bd522] transition-colors">
            {item.name}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-lg sm:text-xl font-bold text-[#259783]" style={{ background: 'linear-gradient(to right, #259783, #3bd522)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {formatPrice(item.current_sell_price)}
          </div>
          {item.bundle_quantity && item.bundle_price && item.bundle_quantity > 0 && item.bundle_price > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-2 py-0.5 h-5 flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                <span className="font-semibold">
                  {item.bundle_name || `${item.bundle_quantity} for ${formatPrice(item.bundle_price)}`}
                </span>
              </Badge>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-auto">
          <div className="flex items-center gap-2">
            {isLowStock(item.current_stock) ? (
              <Badge variant="destructive" className="text-xs font-semibold animate-pulse">
                {formatStock(item.current_stock, item.unit_type)}
              </Badge>
            ) : (
              <span className="text-xs text-gray-500 font-medium">
                {formatStock(item.current_stock, item.unit_type)}
              </span>
            )}
          </div>
          {onQuickAdd && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-[#259783]/15 hover:text-[#259783] hover:scale-110 active:scale-95 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(item, quickQty);
              }}
              title={`Quick add ${quickQty} ${item.unit_type}`}
            >
              <Zap className="w-4 h-4" />
            </Button>
          )}
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
  categories: propCategories,
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
        const response = await fetch('/api/categories');
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
            { signal: controller.signal }
          );
          
          if (controller.signal.aborted) return;

          const result = await response.json();

          if (result.success) {
            const allItems: Item[] = result.data;

            // Filter by shop type (client-side for now - could be moved to API)
            const filteredByShopType = allItems.filter(item => {
              const categoryName = categoryMap.get(item.category_id);
              if (!categoryName) return true;
              return shouldShowCategory(categoryName, shopType);
            });

            // If no results in current shop type, show from other shop type
            let filteredItems = filteredByShopType;
            let isShowingOtherShopType = false;
            
            if (filteredByShopType.length === 0 && allItems.length > 0) {
              const otherShopType: ShopType = shopType === 'grocery' ? 'retail' : 'grocery';
              filteredItems = allItems.filter(item => {
                const categoryName = categoryMap.get(item.category_id);
                if (!categoryName) return true;
                return shouldShowCategory(categoryName, otherShopType);
              });
              isShowingOtherShopType = filteredItems.length > 0;
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
          { signal: controller.signal }
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
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-[#259783]/10 rounded-2xl flex items-center justify-center shadow-lg">
            <p className="text-4xl">👆</p>
          </div>
          <p className="text-lg font-semibold text-gray-600">
            Select a category to view items
          </p>
          <p className="text-sm text-gray-400">
            Choose from the categories above to browse products, or use search to
            find items quickly
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading items...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-destructive font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center space-y-5 max-w-sm">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-gradient-to-br from-[#259783]/10 to-[#3bd522]/10 rounded-2xl rotate-6" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl flex items-center justify-center border border-gray-200/60 dark:border-gray-700/40 shadow-sm">
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
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span>Check for spelling errors</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span>Try different keywords</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
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

  // Format helpers for the parent group header
  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

  return (
    <div className="p-4 sm:p-6">
      {searchQuery && items.length > 0 && (
        <div className="mb-6 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-sm shadow-[#259783]/20">
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
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50/80 dark:bg-amber-900/15 border border-amber-200/80 dark:border-amber-800/50 rounded-xl">
              <div className="w-5 h-5 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 text-[10px] font-bold">i</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-200/80">
                No results in <span className="font-semibold">{shopType}</span> mode. Showing results from <span className="font-semibold">{shopType === 'grocery' ? 'retail' : 'grocery'}</span> instead.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="space-y-8">
        {groupedItems.map((group) => {
          if (group.type === 'parent' && group.parent && group.children && group.children.length > 0) {
            return (
              <div key={group.parent.id} className="space-y-5 bg-gradient-to-br from-[#259783]/5 via-transparent to-[#3bd522]/5 dark:from-[#259783]/10 dark:via-transparent dark:to-[#3bd522]/10 rounded-2xl p-5 sm:p-6 border border-[#259783]/10 dark:border-[#259783]/20">
                {/* Parent Label */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#259783]/20 dark:border-[#259783]/30"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <div className="px-6 py-3 bg-gradient-to-r from-[#259783] to-[#3bd522] rounded-full shadow-lg shadow-[#259783]/30 border-2 border-white dark:border-gray-50">
                      <h2 className="text-base font-extrabold text-white uppercase tracking-wider whitespace-nowrap drop-shadow-sm">
                        {group.parent.name}
                      </h2>
                    </div>
                  </div>
                </div>
                {/* Children Grid - using memoized ItemCard */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
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
            );
          } else if (group.type === 'standalone' && group.item) {
            return (
              <div key={group.item.id} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                <ItemCard
                  item={group.item}
                  onSelect={handleItemClick}
                  onQuickAdd={onQuickAdd}
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

