'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { QuantityInput } from './QuantityInput';

export function CartView() {
  const { items, total, updateQuantity, removeItem, clearCart } = useCartStore();

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto bg-[#4bee2b]/10 rounded-2xl flex items-center justify-center">
            <ShoppingCart className="w-12 h-12 text-[#4bee2b]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Your cart is empty</h2>
          <p className="text-gray-500">Add items from the POS to get started</p>
          <Link href="/pos">
            <Button size="touch" className="mt-4 bg-[#4bee2b] hover:bg-[#45d827] text-[#101b0d]">
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
            <Card key={item.itemId} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(item.price)} / {item.unitType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <QuantityInput
                        unitType={item.unitType}
                        value={item.quantity}
                        onChange={(newQuantity) =>
                          updateQuantity(item.itemId, newQuantity)
                        }
                        min={0}
                      />
                      <Button
                        variant="ghost"
                        size="icon-touch"
                        onClick={() => removeItem(item.itemId)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary mb-1">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} × {formatPrice(item.price)}
                    </div>
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
            <span className="text-2xl font-bold text-[#4bee2b]">
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
                className="w-full bg-[#4bee2b] hover:bg-[#45d827] text-[#101b0d]"
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

