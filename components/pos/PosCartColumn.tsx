'use client';

import { ShoppingCart } from 'lucide-react';
import { CartView } from '@/components/pos/CartView';
import type { Cart } from '@/lib/stores/cart-store';

interface PosCartColumnProps {
  carts: Cart[];
  activeCart?: Cart;
  cartItemCount: number;
  cartTotal: number;
  onCheckout: () => void;
}

export function PosCartColumn({
  carts,
  activeCart,
  cartItemCount,
  cartTotal,
  onCheckout,
}: PosCartColumnProps) {
  return (
    <aside className="hidden md:flex w-[min(280px,28vw)] max-w-[300px] lg:w-[min(300px,30vw)] lg:max-w-[320px] 2xl:w-[min(360px,32vw)] 2xl:min-w-[320px] 2xl:max-w-[440px] flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 h-full min-h-0">
      <div className="hidden md:block shrink-0 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#1c6a1e]/10 to-blue-50/50 dark:from-[#1c6a1e]/20 dark:to-blue-950/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm flex-shrink-0">
            <ShoppingCart className="w-4 h-4 text-white" />
            {carts.length > 1 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-amber-900 text-[9px] font-bold rounded-none flex items-center justify-center shadow-md">
                {carts.length}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {carts.length > 1 ? 'Shopping Carts' : 'Shopping Cart'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {carts.length > 1
                ? `${carts.length} carts · ${activeCart?.name}: ${cartItemCount} items`
                : `${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} · KES ${cartTotal.toFixed(0)}`}
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CartView layout="column" onCheckout={onCheckout} />
      </div>
    </aside>
  );
}
