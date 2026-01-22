'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface CartViewProps {
  onContinueShopping?: () => void;
  onCheckout?: () => void;
}

export function CartView({ onContinueShopping, onCheckout }: CartViewProps = {}) {
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
          {onContinueShopping ? (
            <Button
              size="touch"
              className="mt-4 bg-[#259783] hover:bg-[#45d827] text-white"
              onClick={onContinueShopping}
            >
              Continue Shopping
            </Button>
          ) : (
            <Link href="/pos">
              <Button size="touch" className="mt-4 bg-[#259783] hover:bg-[#45d827] text-white">
                Continue Shopping
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <div className="max-w-4xl mx-auto space-y-2">
          {items.map((item) => (
            <Card
              key={getCartItemKey(item)}
              className={`shadow-sm ${item.isBundle ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
            >
              <CardContent className="p-2.5 sm:p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                      {item.isBundle && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                          <Tag className="w-2.5 h-2.5 mr-0.5" />
                          Bundle
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatPrice(item.price)} / {item.isBundle ? 'bundle' : item.unitType}</span>
                      {item.isBundle && item.bundleQuantity && (
                        <span className="text-amber-600 dark:text-amber-400">
                          ({item.bundleQuantity}/bundle)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.isBundle ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.itemId, item.quantity - 1, true)}
                          disabled={item.quantity <= 1}
                          className="h-7 w-7"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-bold text-sm">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.itemId, item.quantity + 1, true)}
                          className="h-7 w-7"
                        >
                          <Plus className="h-3 w-3" />
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
                      size="icon"
                      onClick={() => removeItem(item.itemId, item.isBundle)}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <div className={`text-sm font-bold ${item.isBundle ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`}>
                      {formatPrice(item.price * item.quantity)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.quantity} × {formatPrice(item.price)}
                    </div>
                    {item.isBundle && item.bundleQuantity && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400">
                        = {item.quantity * item.bundleQuantity} items
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="border-t bg-white p-3 sm:p-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">Total:</span>
            <span className="text-xl font-bold text-[#259783]">
              {formatPrice(total)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCart}
              className="flex-1 h-9"
            >
              Clear Cart
            </Button>
            {onCheckout ? (
              <Button
                size="sm"
                onClick={onCheckout}
                className="flex-1 h-9 bg-[#259783] hover:bg-[#45d827] text-white"
              >
                Checkout
              </Button>
            ) : (
              <Link href="/pos/checkout" className="flex-1">
                <Button
                  size="sm"
                  className="w-full h-9 bg-[#259783] hover:bg-[#45d827] text-white"
                >
                  Checkout
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

