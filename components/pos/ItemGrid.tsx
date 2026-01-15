'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Layers } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';

interface ItemWithVariants extends Item {
  isParent?: boolean;
  variantCount?: number;
  variants?: Item[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  
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

            const filteredItems = allItems.filter(item => {
              const categoryName = categoryMap.get(item.category_id);
              if (!categoryName) return true;
              return shouldShowCategory(categoryName, shopType);
            });

            setItems(filteredItems);
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
          
          const parentItems: ItemWithVariants[] = [];
          const standaloneItems: ItemWithVariants[] = [];
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
              standaloneItems.push(item);
            }
          }

          setItems([...processedItems, ...standaloneItems]);
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
    if (item.isParent && onSelectParent) {
      onSelectParent(item);
    } else if (item.isParent && item.variants && item.variants.length > 0) {
      // Fallback: if no onSelectParent, select first variant
      onSelectItem(item.variants[0]);
    } else {
      onSelectItem(item);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {searchQuery && items.length > 0 && (
        <div className="mb-5 flex items-center justify-between">
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
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {items.map((item) => {
          const canQuickAdd =
            !item.isParent &&
            onQuickAdd &&
            item.current_stock > 0 &&
            item.current_stock >= getQuickAddQuantity(item);
          const quickQty = getQuickAddQuantity(item);

          // For parent items, calculate total stock across variants
          const totalVariantStock = item.isParent && item.variants
            ? item.variants.reduce((sum, v) => sum + v.current_stock, 0)
            : 0;

          return (
            <Card
              key={item.id}
              className={`group cursor-pointer hover-lift transition-smooth touch-target bg-white border-gray-200 hover:border-[#259783] shadow-sm hover:shadow-lg relative overflow-hidden ${
                item.isParent ? 'ring-2 ring-purple-200 dark:ring-purple-800' : ''
              }`}
              onClick={() => handleItemClick(item)}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm sm:text-base line-clamp-2 text-gray-800 min-h-[2.5rem] flex-1">
                    {item.name}
                  </div>
                  {item.isParent && (
                    <Badge className="shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs">
                      <Layers className="w-3 h-3 mr-1" />
                      {item.variantCount}
                    </Badge>
                  )}
                </div>
                
                {item.isParent ? (
                  // Parent item - show variant info
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    Tap to select variant
                  </div>
                ) : (
                  // Regular item or variant
                  <div className="text-lg sm:text-xl font-bold text-[#259783]">
                    {formatPrice(item.current_sell_price)}
                  </div>
                )}
                
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-2">
                    {item.isParent ? (
                      <span className="text-xs text-gray-500 font-medium">
                        {totalVariantStock > 0 
                          ? `${item.variantCount} variants available`
                          : 'No stock'
                        }
                      </span>
                    ) : isLowStock(item.current_stock) ? (
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
              {!item.isParent && item.current_stock <= 0 && (
                <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                  <Badge variant="destructive" className="text-xs">
                    Out of Stock
                  </Badge>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

