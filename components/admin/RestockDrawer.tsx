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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/stock');
        const result = await response.json();

        if (result.success) {
          setItems(result.data);
        } else {
          setError(result.message || 'Failed to load stock');
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

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
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
                          {currentVsMin && !isOutOfStock && (
                            <p className="text-xs text-slate-400 mt-1">
                              {currentVsMin}% of minimum
                            </p>
                          )}
                        </div>
                        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
                          <p className="text-xs text-amber-700 dark:text-amber-300 mb-1 font-semibold">
                            Suggested Restock
                          </p>
                          <p className="font-bold text-base text-amber-900 dark:text-amber-100">
                            {item.suggestedRestock} {item.unit_type}
                          </p>
                          {item.min_stock_level && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              Target: {item.min_stock_level} {item.unit_type}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.min_stock_level && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
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
