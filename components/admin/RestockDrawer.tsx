'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ShoppingCart, AlertTriangle, Package, Loader2 } from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { getShopType, shouldShowCategory, type ShopType } from '@/lib/utils/shop-type';

interface StockItem extends Item {
  category_name?: string;
}

interface RestockItem extends StockItem {
  suggestedRestock: number;
  restockReason: 'out_of_stock' | 'below_min_level';
}

interface RestockDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestockDrawer({ open, onOpenChange }: RestockDrawerProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopType, setShopType] = useState<ShopType>(() => getShopType());

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const shopTypeValue = getShopType();
        setShopType(shopTypeValue);
        
        const [stockResponse, categoriesResponse] = await Promise.all([
          fetch('/api/stock'),
          fetch('/api/categories'),
        ]);

        const stockResult = await stockResponse.json();
        const categoriesResult = await categoriesResponse.json();

        if (categoriesResult.success) {
          setCategories(categoriesResult.data);
        }

        if (stockResult.success) {
          const allItems = stockResult.data;
          
          if (categoriesResult.success) {
            const categoryMap = new Map<string, string>();
            categoriesResult.data.forEach((cat: Category) => {
              categoryMap.set(cat.id, cat.name);
            });

            const filteredItems = allItems.filter((item: StockItem) => {
              const categoryName = categoryMap.get(item.category_id);
              if (!categoryName) return true;
              return shouldShowCategory(categoryName, shopTypeValue);
            });

            setItems(filteredItems);
          } else {
            setItems(allItems);
          }
        } else {
          setError(stockResult.message || 'Failed to load stock');
        }
      } catch (err) {
        setError('Failed to load stock');
        console.error('Error fetching stock:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [open]);

  const restockItems = useMemo(() => {
    const itemsNeedingRestock: RestockItem[] = [];

    for (const item of items) {
      const isOutOfStock = item.current_stock <= 0;
      const isBelowMinLevel = item.min_stock_level !== null && item.current_stock <= item.min_stock_level;

      if (isOutOfStock || isBelowMinLevel) {
        let suggestedRestock = 0;
        let restockReason: 'out_of_stock' | 'below_min_level';

        if (isOutOfStock) {
          restockReason = 'out_of_stock';
          if (item.min_stock_level !== null) {
            suggestedRestock = item.min_stock_level * 1.5;
          } else {
            suggestedRestock = 10;
          }
        } else {
          restockReason = 'below_min_level';
          const deficit = item.min_stock_level! - item.current_stock;
          suggestedRestock = deficit * 1.5;
        }

        itemsNeedingRestock.push({
          ...item,
          suggestedRestock: Math.ceil(suggestedRestock),
          restockReason,
        });
      }
    }

    return itemsNeedingRestock.sort((a, b) => {
      if (a.restockReason === 'out_of_stock' && b.restockReason !== 'out_of_stock') return -1;
      if (a.restockReason !== 'out_of_stock' && b.restockReason === 'out_of_stock') return 1;
      return a.current_stock - b.current_stock;
    });
  }, [items]);

  const formatStock = (stock: number, unitType: UnitType) => {
    if (stock <= 0) return 'Out of stock';
    return `${stock.toFixed(2)} ${unitType}`;
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const calculateRestockValue = (item: RestockItem) => {
    // Estimate buy price from sell price (assuming ~30% margin)
    const estimatedBuyPrice = item.current_sell_price * 0.7;
    return item.suggestedRestock * estimatedBuyPrice;
  };

  const getBuyPricePerUnit = (item: RestockItem) => {
    // Estimate buy price from sell price (assuming ~30% margin)
    return item.current_sell_price * 0.7;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen flex flex-col">
        <DrawerHeader className="border-b bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 relative pr-12">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 h-8 w-8 hover:bg-amber-200 dark:hover:bg-amber-900/40"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <DrawerTitle className="text-xl flex items-center gap-2 text-amber-900 dark:text-amber-100">
                What Needs Restocking
              </DrawerTitle>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {restockItems.length} {restockItems.length === 1 ? 'item' : 'items'} need attention
              </p>
            </div>
          </div>
          <DrawerDescription className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1">
            Items that are out of stock or below minimum levels
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 sm:px-6 pb-6 flex-1 bg-gradient-to-b from-amber-50/30 via-white to-white dark:from-amber-950/10 dark:via-[#0f1a0d] dark:to-[#0f1a0d]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500" />
                <p className="text-muted-foreground">Loading items...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <p className="text-destructive">{error}</p>
                <Button onClick={() => onOpenChange(false)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          ) : restockItems.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                  <Package className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">
                  All items are well stocked!
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No items need restocking at this time.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {/* Summary */}
              <Card className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300 dark:border-amber-800">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">Total Items to Restock</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {restockItems.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">Estimated Total Cost</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {formatCurrency(
                          restockItems.reduce((sum, item) => sum + calculateRestockValue(item), 0)
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {restockItems.map((item) => {
                const isOutOfStock = item.current_stock <= 0;
                const currentVsMin = item.min_stock_level
                  ? ((item.current_stock / item.min_stock_level) * 100).toFixed(0)
                  : null;

                return (
                  <Card
                    key={item.id}
                    className={`border-l-4 ${
                      isOutOfStock
                        ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20'
                        : 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isOutOfStock
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-orange-100 dark:bg-orange-900/30'
                            }`}
                          >
                            {isOutOfStock ? (
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Package className="w-5 h-5 text-orange-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                              {item.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                              {item.category_name || 'Uncategorized'}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOutOfStock ? (
                                <Badge variant="destructive" className="text-xs">
                                  Out of Stock
                                </Badge>
                              ) : (
                                <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">
                                  Below Min Level
                                </Badge>
                              )}
                              {item.min_stock_level && (
                                <Badge variant="outline" className="text-xs">
                                  Min: {item.min_stock_level} {item.unit_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Current Stock
                          </p>
                          <p
                            className={`font-bold text-sm ${
                              isOutOfStock ? 'text-red-500' : 'text-orange-500'
                            }`}
                          >
                            {formatStock(item.current_stock, item.unit_type)}
                          </p>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-2.5 border border-rose-200 dark:border-rose-800">
                          <p className="text-xs text-rose-700 dark:text-rose-300 mb-1 font-semibold">
                            Need to Restock
                          </p>
                          <p className="font-bold text-base text-rose-900 dark:text-rose-100">
                            {item.min_stock_level 
                              ? Math.max(0, item.min_stock_level - item.current_stock).toFixed(1)
                              : item.suggestedRestock.toFixed(1)
                            } {item.unit_type}
                          </p>
                          {item.min_stock_level && item.current_stock < item.min_stock_level && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                              Deficit
                            </p>
                          )}
                        </div>
                        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2.5 border border-amber-300 dark:border-amber-700">
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-1 font-semibold">
                            Suggested
                          </p>
                          <p className="font-bold text-base text-amber-900 dark:text-amber-100">
                            {item.suggestedRestock} {item.unit_type}
                          </p>
                          {item.min_stock_level && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                              {item.min_stock_level} min
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Restock Value */}
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Estimated Cost to Restock:
                          </span>
                          <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                            {formatCurrency(calculateRestockValue(item))}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {item.suggestedRestock} {item.unit_type} × {formatCurrency(getBuyPricePerUnit(item))} per {item.unit_type}
                        </p>
                      </div>

                      {item.min_stock_level && (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">
                              Stock vs Minimum:
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {item.current_stock.toFixed(2)} / {item.min_stock_level} {item.unit_type}
                            </span>
                          </div>
                          {!isOutOfStock && (
                            <div className="mt-2">
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    item.current_stock < item.min_stock_level * 0.5
                                      ? 'bg-red-500'
                                      : 'bg-orange-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      (item.current_stock / item.min_stock_level) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
