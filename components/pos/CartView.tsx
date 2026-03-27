'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, Trash2, ShoppingCart, Tag, PlusCircle, X } from 'lucide-react';
import Link from 'next/link';
import { QuantityInput } from './QuantityInput';
import type { UnitType } from '@/lib/constants';
import { useEffect } from 'react';

const getCartItemKey = (item: { itemId: string; isBundle?: boolean; inventoryBatchId?: string }): string => {
  if (item.isBundle) return `${item.itemId}:bundle`;
  if (item.inventoryBatchId) return `${item.itemId}:batch:${item.inventoryBatchId}`;
  return item.itemId;
};

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
      <div className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
          {carts.map((cart) => (
            <div key={cart.id} className="flex items-center gap-1 min-w-fit">
              <button
                type="button"
                onClick={() => switchCart(cart.id)}
                className={`
                  relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                  transition-all whitespace-nowrap
                  ${cart.id === activeCartId
                    ? 'bg-[#1c6a1e] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }
                `}
              >
                <span>{cart.name}</span>
                {cart.items.length > 0 && (
                  <span
                    className={`
                      inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-bold rounded-full
                      ${cart.id === activeCartId
                        ? 'bg-white/25 text-white'
                        : 'bg-[#1c6a1e]/10 text-[#1c6a1e]'
                      }
                    `}
                  >
                    {cart.items.length}
                  </span>
                )}
              </button>
              {carts.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCart(cart.id, e)}
                  className={`
                    p-1 rounded-full transition-colors
                    ${cart.id === activeCartId
                      ? 'hover:bg-[#1c6a1e]/20 text-[#1c6a1e]/70 hover:text-[#1c6a1e]'
                      : 'hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600'
                    }
                  `}
                  aria-label={`Delete ${cart.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleNewCart}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#1c6a1e] hover:bg-[#1c6a1e]/10 transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {/* Cart Items */}
      {cartItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
              {activeCart?.name || 'Cart'} is empty
            </h2>
            <p className="text-sm text-slate-400 mb-5">Add items from the POS to get started</p>
            {onContinueShopping ? (
              <Button
                size="sm"
                className="bg-[#1c6a1e] hover:bg-[#155a17] text-white rounded-xl px-6 h-10"
                onClick={onContinueShopping}
              >
                Continue Shopping
              </Button>
            ) : (
              <Link href="/pos">
                <Button size="sm" className="bg-[#1c6a1e] hover:bg-[#155a17] text-white rounded-xl px-6 h-10">
                  Continue Shopping
                </Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto p-3">
            <div className="space-y-2">
              {cartItems.map((item) => (
                <div
                  key={getCartItemKey(item)}
                  className={`rounded-xl border p-3 transition-colors ${
                    item.isBundle
                      ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* Row 1: Name + Price */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white uppercase truncate">{item.name}</h3>
                        {item.isBundle && (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[9px] px-1.5 py-0 h-4 shrink-0">
                            <Tag className="w-2.5 h-2.5 mr-0.5" />
                            Bundle
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex-wrap">
                        <span>{formatPrice(item.price)} / {item.isBundle ? 'bundle' : item.unitType}</span>
                        {item.isBundle && item.bundleQuantity && (
                          <span className="text-amber-600 dark:text-amber-400">
                            ({item.bundleQuantity}/bundle)
                          </span>
                        )}
                        {item.batchNumber && (
                          <span className="font-mono text-slate-400">
                            Lot: {item.batchNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${item.isBundle ? 'text-amber-600 dark:text-amber-400' : 'text-[#1c6a1e]'}`}>
                        {formatPrice(item.price * item.quantity)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.quantity} × {formatPrice(item.price)}
                      </div>
                      {item.isBundle && item.bundleQuantity && (
                        <div className="text-[10px] text-amber-500">
                          = {item.quantity * item.bundleQuantity} items
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Controls */}
                  <div className="flex items-end justify-between gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                    <div className="flex-1 min-w-0">
                      {item.isBundle ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.itemId, item.quantity - 1, true)}
                            disabled={item.quantity <= 1}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-10 text-center font-bold text-sm text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.itemId, item.quantity + 1, true)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : isValidUnitType(item.unitType) ? (
                        <QuantityInput
                          unitType={item.unitType}
                          value={item.quantity}
                          onChange={(newQuantity) =>
                            updateQuantity(item.itemId, newQuantity, false, item.inventoryBatchId)
                          }
                          min={0}
                        />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.itemId, item.isBundle, item.inventoryBatchId)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">{activeCart?.name} &middot; {cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {formatPrice(cartTotal)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                Clear
              </button>
              {onCheckout ? (
                <Button
                  onClick={onCheckout}
                  className="flex-1 h-12 rounded-xl text-sm font-bold bg-[#1c6a1e] hover:bg-[#155a17] text-white shadow-lg shadow-[#1c6a1e]/20 transition-all"
                >
                  <span className="flex items-center justify-between w-full px-1">
                    <span>Checkout</span>
                    <span className="bg-white/20 px-3 py-0.5 rounded-lg text-xs font-semibold">{formatPrice(cartTotal)}</span>
                  </span>
                </Button>
              ) : (
                <Link href="/pos/checkout" className="flex-1">
                  <Button
                    className="w-full h-12 rounded-xl text-sm font-bold bg-[#1c6a1e] hover:bg-[#155a17] text-white shadow-lg shadow-[#1c6a1e]/20 transition-all"
                  >
                    <span className="flex items-center justify-between w-full px-1">
                      <span>Checkout</span>
                      <span className="bg-white/20 px-3 py-0.5 rounded-lg text-xs font-semibold">{formatPrice(cartTotal)}</span>
                    </span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
