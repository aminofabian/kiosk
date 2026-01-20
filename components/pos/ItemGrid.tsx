'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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

  // Build category map for filtering
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat: Category) => {
      map.set(cat.id, cat.name);
    });
    return map;
  }, [categories]);

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
          
          const response = await fetch(
            `/api/items?search=${encodeURIComponent(searchQuery || '')}&sellableOnly=true`,
            { signal: controller.signal }
          );
          
          if (controller.signal.aborted) return;

          const result = await response.json();

          if (result.success) {
            const allItems: Item[] = result.data;

            // First, try to filter by current shop type
            const filteredByShopType = allItems.filter(item => {
              const categoryName = categoryMap.get(item.category_id);
              if (!categoryName) return true;
              return shouldShowCategory(categoryName, shopType);
            });

            // If no results found in current shop type, also include items from the other shop type
            let filteredItems = filteredByShopType;
            let isShowingOtherShopType = false;
            
            if (filteredByShopType.length === 0 && allItems.length > 0) {
              // Fallback: show items from the other shop type
              const otherShopType: ShopType = shopType === 'grocery' ? 'retail' : 'grocery';
              filteredItems = allItems.filter(item => {
                const categoryName = categoryMap.get(item.category_id);
                if (!categoryName) return true;
                return shouldShowCategory(categoryName, otherShopType);
              });
              isShowingOtherShopType = filteredItems.length > 0;
            }

            setShowingOtherShopType(isShowingOtherShopType);
            
            // For search results, also group items by parent
            const parentNames = new Map<string, string>();
            const parentIds = new Set<string>();
            const parentItems = new Map<string, Item>();
            
            for (const item of filteredItems) {
              if (!item.parent_item_id) {
                parentNames.set(item.id, item.name);
                parentItems.set(item.id, item);
              }
            }
            
            for (const item of filteredItems) {
              if (item.parent_item_id) {
                parentIds.add(item.parent_item_id);
              }
            }

            // Group items by parent
            const grouped: GroupedItem[] = [];
            const childrenByParent = new Map<string, Item[]>();
            const standaloneItems: Item[] = [];

            // Group children by parent
            for (const item of filteredItems) {
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

            setGroupedItems(grouped);

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

          setGroupedItems(grouped);

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
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center shadow-inner">
            <span className="text-4xl opacity-60">🔍</span>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-700">
              {searchQuery
                ? 'No products found'
                : 'No items in this category'}
            </p>
            {searchQuery && (
              <>
                <p className="text-sm text-gray-500">
                  We couldn't find any products matching "{searchQuery}"
                </p>
                <div className="pt-2 space-y-1.5">
                  <p className="text-xs text-gray-400 font-medium">Try:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Check for spelling errors</li>
                    <li>• Use fewer or different keywords</li>
                    <li>• Browse by category instead</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatStock = (stock: number, unitType: UnitType) => {
    if (stock <= 0) {
      return 'Out of stock';
    }
    if (stock < 10) {
      return `Low (${stock} ${unitType})`;
    }
    return `${stock} ${unitType}`;
  };

  const isLowStock = (stock: number) => stock > 0 && stock < 10;

  const getQuickAddQuantity = (item: Item): number => {
    if (item.unit_type === 'kg' || item.unit_type === 'g') return 0.5;
    return 1;
  };

  const handleItemClick = (item: ItemWithVariants) => {
    // All items shown are now directly selectable (variants or standalone)
    onSelectItem(item);
  };

  return (
    <div className="p-4 sm:p-6">
      {searchQuery && items.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 bg-gradient-to-b from-[#259783] to-[#3bd522] rounded-full"></div>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {items.length} result{items.length !== 1 ? 's' : ''} found
                </p>
                <p className="text-xs text-gray-500">
                  for "{searchQuery}"
                </p>
              </div>
            </div>
          </div>
          {showingOtherShopType && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px]">ℹ</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                No results in <span className="font-semibold">{shopType}</span> mode. Showing results from <span className="font-semibold">{shopType === 'grocery' ? 'retail' : 'grocery'}</span> instead.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="space-y-6">
        {groupedItems.map((group) => {
          if (group.type === 'parent' && group.parent && group.children && group.children.length > 0) {
            return (
              <div key={group.parent.id} className="space-y-4">
                {/* Parent Label */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#259783]/30 to-transparent"></div>
                  <div className="px-5 py-2.5 bg-gradient-to-r from-[#259783]/10 to-[#3bd522]/10 dark:from-[#259783]/20 dark:to-[#3bd522]/20 rounded-full border border-[#259783]/30 dark:border-[#259783]/40 shadow-sm">
                    <h2 className="text-base font-bold text-[#259783] dark:text-[#3bd522] uppercase tracking-wide whitespace-nowrap">
                      {group.parent.name}
                    </h2>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#259783]/30 to-transparent"></div>
                </div>
                {/* Children Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {group.children.map((item) => {
                    const canQuickAdd = onQuickAdd;
                    const quickQty = getQuickAddQuantity(item);

                    return (
                      <Card
                        key={item.id}
                        className="group cursor-pointer hover-lift transition-smooth touch-target bg-white border-gray-200 hover:border-[#259783] shadow-sm hover:shadow-lg relative overflow-hidden"
                        onClick={() => handleItemClick(item)}
                      >
                        <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="font-semibold text-sm sm:text-base line-clamp-2 text-gray-800 min-h-[2.5rem]">
                              {item.variant_name || item.name}
                            </div>
                          </div>
                          
                          {/* Price and Bundle Info */}
                          <div className="space-y-1.5">
                            <div className="text-lg sm:text-xl font-bold text-[#259783]">
                              {formatPrice(item.current_sell_price)}
                            </div>
                            {/* Bundle Pricing Badge */}
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
                                <Badge
                                  variant="destructive"
                                  className="text-xs font-semibold animate-pulse"
                                >
                                  {formatStock(item.current_stock, item.unit_type)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-500 font-medium">
                                  {formatStock(item.current_stock, item.unit_type)}
                                </span>
                              )}
                            </div>
                            {canQuickAdd && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#259783]/10 hover:text-[#259783]"
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
                  })}
                </div>
              </div>
            );
          } else if (group.type === 'standalone' && group.item) {
            const canQuickAdd = onQuickAdd;
            const quickQty = getQuickAddQuantity(group.item);

            return (
              <Card
                key={group.item.id}
                className="group cursor-pointer hover-lift transition-smooth touch-target bg-white border-gray-200 hover:border-[#259783] shadow-sm hover:shadow-lg relative overflow-hidden max-w-xs mx-auto"
                onClick={() => handleItemClick(group.item!)}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold text-sm sm:text-base line-clamp-2 text-gray-800 min-h-[2.5rem]">
                      {group.item.name}
                    </div>
                  </div>
                  
                  {/* Price and Bundle Info */}
                  <div className="space-y-1.5">
                    <div className="text-lg sm:text-xl font-bold text-[#259783]">
                      {formatPrice(group.item.current_sell_price)}
                    </div>
                    {/* Bundle Pricing Badge */}
                    {group.item.bundle_quantity && group.item.bundle_price && group.item.bundle_quantity > 0 && group.item.bundle_price > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-2 py-0.5 h-5 flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />
                          <span className="font-semibold">
                            {group.item.bundle_name || `${group.item.bundle_quantity} for ${formatPrice(group.item.bundle_price)}`}
                          </span>
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <div className="flex items-center gap-2">
                      {isLowStock(group.item.current_stock) ? (
                        <Badge
                          variant="destructive"
                          className="text-xs font-semibold animate-pulse"
                        >
                          {formatStock(group.item.current_stock, group.item.unit_type)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-500 font-medium">
                          {formatStock(group.item.current_stock, group.item.unit_type)}
                        </span>
                      )}
                    </div>
                    {canQuickAdd && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#259783]/10 hover:text-[#259783]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAdd(group.item!, quickQty);
                        }}
                        title={`Quick add ${quickQty} ${group.item.unit_type}`}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

