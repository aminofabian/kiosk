'use client';

import { ShoppingCart, X } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { CartView } from '@/components/pos/CartView';
import type { Cart } from '@/lib/stores/cart-store';

interface PosCartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carts: Cart[];
  activeCart?: Cart;
  cartItemCount: number;
  cartTotal: number;
  onCheckout: () => void;
}

export function PosCartDrawer({
  open,
  onOpenChange,
  carts,
  activeCart,
  cartItemCount,
  cartTotal,
  onCheckout,
}: PosCartDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 print:hidden md:hidden">
        <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#1c6a1e]/10 to-blue-50 dark:from-[#1c6a1e]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm flex-shrink-0">
                <ShoppingCart className="w-5 h-5 text-white" />
                {carts.length > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-400 text-amber-900 text-xs font-bold rounded-none flex items-center justify-center shadow-md">
                    {carts.length}
                  </span>
                )}
              </div>
              <div>
                <DrawerTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {carts.length > 1 ? 'Shopping Carts' : 'Shopping Cart'}
                </DrawerTitle>
                <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {carts.length > 1
                    ? `${carts.length} carts • ${activeCart?.name}: ${cartItemCount} items`
                    : `${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'} • KES ${cartTotal.toFixed(0)}`}
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose asChild>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center rounded-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900">
          <CartView
            layout="drawer"
            onContinueShopping={() => onOpenChange(false)}
            onCheckout={() => {
              onOpenChange(false);
              onCheckout();
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
