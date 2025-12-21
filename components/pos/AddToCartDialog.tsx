'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart, X, Package } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart-store';
import type { Item } from '@/lib/db/types';
import { getItemImage } from '@/lib/utils/item-images';

interface AddToCartDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToCartDialog({
  item,
  open,
  onOpenChange,
}: AddToCartDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const { addItem, items: cartItems } = useCartStore();

  useEffect(() => {
    if (open && item) {
      const existingItem = cartItems.find((i) => i.itemId === item.id);
      if (existingItem) {
        setQuantity(existingItem.quantity);
      } else {
        setQuantity(item.unit_type === 'kg' || item.unit_type === 'g' ? 0.5 : 1);
      }
    }
  }, [open, item, cartItems]);

  if (!item) return null;

  const handleAddToCart = () => {
    if (quantity > 0) {
      addItem(
        {
          itemId: item.id,
          name: item.name,
          price: item.current_sell_price,
          unitType: item.unit_type,
        },
        quantity
      );
      onOpenChange(false);
    }
  };

  const subtotal = item.current_sell_price * quantity;
  const formatPrice = (price: number) => `KES ${price.toFixed(2)}`;
  const isOutOfStock = item.current_stock <= 0;
  const maxQuantity = isOutOfStock ? 0 : item.current_stock;
  const isWeight = item.unit_type === 'kg' || item.unit_type === 'g';
  const step = isWeight ? 0.1 : 1;

  const handleIncrement = () => {
    const newValue = quantity + step;
    if (maxQuantity === 0 || newValue <= maxQuantity) {
      setQuantity(Number(newValue.toFixed(isWeight ? 1 : 0)));
    }
  };

  const handleDecrement = () => {
    const newValue = quantity - step;
    if (newValue >= 0) {
      setQuantity(Number(newValue.toFixed(isWeight ? 1 : 0)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="bg-white dark:bg-gray-900 rounded-3xl pb-6">
          <div className="relative px-6 pt-6">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>

            <div className="flex flex-col items-center pt-8 pb-6">
              <div className="w-20 h-20 rounded-full bg-[#259783]/20 dark:bg-[#259783]/10 flex items-center justify-center mb-4 overflow-hidden">
                {getItemImage(item.name) ? (
                  <img
                    src={getItemImage(item.name)!}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-full"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<svg class="w-10 h-10 text-[#259783]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
                      }
                    }}
                  />
                ) : (
                  <Package className="w-10 h-10 text-[#259783]" />
                )}
              </div>
              <h2 className="text-2xl font-bold uppercase text-gray-900 dark:text-gray-100 mb-3">
                {item.name}
              </h2>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {formatPrice(item.current_sell_price)} / {item.unit_type}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 mb-8">
              <button
                onClick={handleDecrement}
                disabled={quantity <= 0}
                className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Minus className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {quantity.toFixed(isWeight ? 1 : 0)}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 uppercase mt-1">
                  {item.unit_type}
                </span>
              </div>
              <button
                onClick={handleIncrement}
                disabled={isOutOfStock || (maxQuantity > 0 && quantity >= maxQuantity)}
                className="w-12 h-12 rounded-full bg-[#259783] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#45d827] transition-colors"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="mb-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Subtotal
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatPrice(subtotal)}
                </p>
              </div>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={quantity <= 0 || isOutOfStock}
              className="w-full h-14 bg-[#259783] hover:bg-[#45d827] text-white font-bold text-lg rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>ADD TO CART</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

