'use client';

import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Package, ShoppingCart } from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';

interface VariantSelectorProps {
  parentItem: {
    id: string;
    name: string;
    variants?: Item[];
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVariant: (variant: Item) => void;
}

export function VariantSelector({
  parentItem,
  open,
  onOpenChange,
  onSelectVariant,
}: VariantSelectorProps) {
  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

  const formatStock = (stock: number, unitType: UnitType) => {
    if (stock <= 0) return 'Out of stock';
    if (stock < 10) return `Low (${stock.toFixed(1)} ${unitType})`;
    return `${stock.toFixed(1)} ${unitType}`;
  };

  const isLowStock = (stock: number) => stock > 0 && stock < 10;

  if (!parentItem) return null;

  const variants = parentItem.variants || [];
  // Show all variants, sorted by stock status (in stock first, then out of stock)
  const sortedVariants = [...variants].sort((a, b) => {
    if (a.current_stock > 0 && b.current_stock <= 0) return -1;
    if (a.current_stock <= 0 && b.current_stock > 0) return 1;
    return 0;
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen">
        <DrawerHeader className="border-b bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center">
              <Layers className="w-6 h-6 text-[#1c6a1e]" />
            </div>
            <div>
              <DrawerTitle className="text-xl text-slate-900 dark:text-white">{parentItem.name}</DrawerTitle>
              <DrawerDescription>
                Select a variant to add to cart
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 sm:px-6 pb-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
          {variants.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No variants available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* All variants - both in stock and out of stock are selectable */}
              {sortedVariants.map((variant) => {
                const isOutOfStock = variant.current_stock <= 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      onSelectVariant(variant);
                      onOpenChange(false);
                    }}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left group ${
                      isOutOfStock
                        ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-[#1c6a1e]'
                        : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-[#1c6a1e]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold ${
                            isOutOfStock
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {variant.variant_name || variant.name}
                          </h3>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {variant.unit_type}
                          </Badge>
                          {isOutOfStock && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${
                            isOutOfStock
                              ? 'text-gray-500 dark:text-gray-400'
                              : 'text-[#1c6a1e]'
                          }`}>
                            {formatPrice(variant.current_sell_price)}
                          </span>
                          {!isOutOfStock && (
                            <>
                              <span className="text-xs text-gray-400">•</span>
                              <span
                                className={`text-sm ${
                                  isLowStock(variant.current_stock)
                                    ? 'text-orange-500 font-medium'
                                    : 'text-gray-500'
                                }`}
                              >
                                {formatStock(variant.current_stock, variant.unit_type)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-[#1c6a1e]/10 flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-[#1c6a1e]" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
