'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart, Tag } from 'lucide-react';
import Link from 'next/link';
import { QuantityInput } from './QuantityInput';
import type { UnitType } from '@/lib/constants';

// Generate a unique key for cart items
const getCartItemKey = (item: { itemId: string; isBundle?: boolean }): string => {
  return item.isBundle ? `${item.itemId}:bundle` : item.itemId;
};

// Type guard to check if unitType is a valid UnitType (not 'bundle')
const isValidUnitType = (unitType: UnitType | 'bundle'): unitType is UnitType => {
  return unitType !== 'bundle';
};

export function CartView() {
  const { items, total, updateQuantity, removeItem, clearCart } = useCartStore();

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto bg-[#259783]/10 rounded-2xl flex items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-[#259783]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Your cart is empty</h2>
          <p className="text-gray-500">Add items from the POS to get started</p>
          <Link href="/pos">
            <Button size="touch" className="mt-4 bg-[#259783] hover:bg-[#45d827] text-white">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {items.map((item) => (
            <Card 
              key={getCartItemKey(item)} 
              className={`shadow-sm ${item.isBundle ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      {item.isBundle && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          Bundle
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(item.price)} / {item.isBundle ? 'bundle' : item.unitType}
                      </span>
                      {item.isBundle && item.bundleQuantity && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          ({item.bundleQuantity} items per bundle)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {item.isBundle ? (
                        // Simple +/- for bundles
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon-touch"
                            onClick={() => updateQuantity(item.itemId, item.quantity - 1, true)}
                            disabled={item.quantity <= 1}
                            className="h-10 w-10"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-bold text-lg">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon-touch"
                            onClick={() => updateQuantity(item.itemId, item.quantity + 1, true)}
                            className="h-10 w-10"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : isValidUnitType(item.unitType) ? (
                        <QuantityInput
                          unitType={item.unitType}
                          value={item.quantity}
                          onChange={(newQuantity) =>
                            updateQuantity(item.itemId, newQuantity, false)
                          }
                          min={0}
                        />
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-touch"
                        onClick={() => removeItem(item.itemId, item.isBundle)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold mb-1 ${item.isBundle ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
                      {formatPrice(item.price * item.quantity)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} × {formatPrice(item.price)}
                    </div>
                    {item.isBundle && item.bundleQuantity && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        = {item.quantity * item.bundleQuantity} items total
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="border-t bg-white p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex justify-between items-center text-lg">
            <span className="font-semibold">Total:</span>
            <span className="text-2xl font-bold text-[#259783]">
              {formatPrice(total)}
            </span>
          </div>
          <Separator />
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="touch"
              onClick={clearCart}
              className="flex-1"
            >
              Clear Cart
            </Button>
            <Link href="/pos/checkout" className="flex-1">
              <Button
                size="touch"
                className="w-full bg-[#259783] hover:bg-[#45d827] text-white"
              >
                Checkout
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

