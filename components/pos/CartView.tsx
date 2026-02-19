'use client';

import { useCartStore, type Cart } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, Trash2, ShoppingCart, Tag, PlusCircle, X } from 'lucide-react';
import Link from 'next/link';
import { QuantityInput } from './QuantityInput';
import type { UnitType } from '@/lib/constants';
import { useEffect } from 'react';

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
  const { 
    updateQuantity, 
    removeItem, 
    clearCart,
    carts,
    activeCartId,
    createCart,
    switchCart,
    deleteCart,
  } = useCartStore();

  // Auto-select first cart if none is active
  useEffect(() => {
    if (!activeCartId && carts.length > 0) {
      switchCart(carts[0].id);
    }
  }, [activeCartId, carts, switchCart]);

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const handleNewCart = () => {
    createCart();
  };

  const handleDeleteCart = (cartId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCart(cartId);
  };

  const activeCart = carts.find(c => c.id === activeCartId) || carts[0];
  const cartItems = activeCart?.items || [];
  const cartTotal = activeCart?.total || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Cart Tabs */}
      <div className="border-b bg-slate-50/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {carts.map((cart) => (
            <button
              key={cart.id}
              onClick={() => switchCart(cart.id)}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                transition-all duration-200 whitespace-nowrap min-w-fit
                ${cart.id === activeCartId
                  ? 'bg-gradient-to-r from-[#1c6a1e] to-[#1e8a72] text-white shadow-lg shadow-[#1c6a1e]/25'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
                }
              `}
            >
              <span>{cart.name}</span>
              {cart.items.length > 0 && (
                <Badge 
                  variant="secondary" 
                  className={`
                    h-5 min-w-5 px-1.5 text-xs
                    ${cart.id === activeCartId
                      ? 'bg-white/20 text-white'
                      : 'bg-[#1c6a1e]/10 text-[#1c6a1e]'
                    }
                  `}
                >
                  {cart.items.length}
                </Badge>
              )}
              {carts.length > 1 && (
                <button
                  onClick={(e) => handleDeleteCart(cart.id, e)}
                  className={`
                    ml-1 p-0.5 rounded-full transition-colors
                    ${cart.id === activeCartId
                      ? 'hover:bg-white/20 text-white/80 hover:text-white'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                    }
                  `}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewCart}
            className="h-9 px-3 gap-2 rounded-xl text-[#1c6a1e] border-[#1c6a1e]/40 hover:bg-[#1c6a1e]/10 hover:border-[#1c6a1e]/50 whitespace-nowrap font-medium transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Cart</span>
          </Button>
        </div>
      </div>

      {/* Cart Items */}
      {cartItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto bg-[#1c6a1e]/10 rounded-2xl flex items-center justify-center">
              <ShoppingCart className="w-12 h-12 text-[#1c6a1e]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              {activeCart?.name || 'Cart'} is empty
            </h2>
            <p className="text-gray-500">Add items from the POS to get started</p>
            {onContinueShopping ? (
              <Button
                size="touch"
                className="mt-4 pos-btn-primary rounded-xl px-8"
                onClick={onContinueShopping}
              >
                Continue Shopping
              </Button>
            ) : (
              <Link href="/pos">
                <Button size="touch" className="mt-4 pos-btn-primary rounded-xl px-8">
                  Continue Shopping
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto p-3 sm:p-4">
            <div className="max-w-4xl mx-auto space-y-2">
              {cartItems.map((item) => (
                <Card
                  key={getCartItemKey(item)}
                  className={`shadow-sm ${item.isBundle ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
                >
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-semibold text-sm uppercase break-words">{item.name}</h3>
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

          <div className="border-t bg-white dark:bg-gray-900 p-3 sm:p-4">
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Total ({activeCart?.name}):</span>
                <span className="text-xl font-bold text-[#1c6a1e]">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCart}
                  className="flex-1 h-10 pos-btn-outline rounded-xl font-medium"
                >
                  Clear Cart
                </Button>
                {onCheckout ? (
                  <Button
                    size="sm"
                    onClick={onCheckout}
                    className="flex-1 h-10 pos-btn-primary rounded-xl font-semibold"
                  >
                    Checkout
                  </Button>
                ) : (
                  <Link href="/pos/checkout" className="flex-1">
                    <Button
                      size="sm"
                      className="w-full h-10 pos-btn-primary rounded-xl font-semibold"
                    >
                      Checkout
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
