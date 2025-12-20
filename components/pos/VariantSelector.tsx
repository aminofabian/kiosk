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
  const availableVariants = variants.filter((v) => v.current_stock > 0);
  const outOfStockVariants = variants.filter((v) => v.current_stock <= 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b bg-gradient-to-r from-purple-500/10 to-[#4bee2b]/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Layers className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <DrawerTitle className="text-xl">{parentItem.name}</DrawerTitle>
              <DrawerDescription>
                Select a variant to add to cart
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto">
          {variants.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No variants available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Available variants */}
              {availableVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    onSelectVariant(variant);
                    onOpenChange(false);
                  }}
                  className="w-full p-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 hover:border-[#4bee2b] transition-all text-left group"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {variant.variant_name || variant.name}
                        </h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {variant.unit_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-[#4bee2b]">
                          {formatPrice(variant.current_sell_price)}
                        </span>
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
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[#4bee2b]/10 flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-[#4bee2b]" />
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {/* Out of stock variants */}
              {outOfStockVariants.length > 0 && (
                <>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-4">
                    Out of Stock
                  </div>
                  {outOfStockVariants.map((variant) => (
                    <div
                      key={variant.id}
                      className="w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border-2 border-gray-100 dark:border-slate-700 opacity-60"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-500 dark:text-gray-400">
                              {variant.variant_name || variant.name}
                            </h3>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {variant.unit_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-400">
                              {formatPrice(variant.current_sell_price)}
                            </span>
                          </div>
                        </div>
                        <Badge variant="destructive" className="shrink-0">
                          Out of Stock
                        </Badge>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 dark:bg-slate-900">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
