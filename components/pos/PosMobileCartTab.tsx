'use client';

import { CartView } from '@/components/pos/CartView';

interface PosMobileCartTabProps {
  cartItemCount: number;
  onClearCart: () => void;
  onCheckout: () => void;
}

export function PosMobileCartTab({
  cartItemCount,
  onClearCart,
  onCheckout,
}: PosMobileCartTabProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center justify-between px-4 h-12">
          <h1 className="text-[17px] font-bold text-slate-900 dark:text-white">Cart</h1>
          {cartItemCount > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs font-semibold text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Clear
            </button>
          )}
        </div>
      </header>
      <main className="flex flex-col flex-1 min-h-0 overflow-hidden pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))]">
        <CartView layout="column" onCheckout={onCheckout} />
      </main>
    </div>
  );
}
