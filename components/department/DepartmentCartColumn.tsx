'use client';

import { ClipboardList } from 'lucide-react';
import { DepartmentOrderPanel } from '@/components/department/DepartmentOrderPanel';
import { useCartStore } from '@/lib/stores/cart-store';

interface DepartmentCartColumnProps {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  onSaveDraft: () => void;
  onForward: () => void;
  submitting?: boolean;
}

export function DepartmentCartColumn({
  customerName,
  onCustomerNameChange,
  onSaveDraft,
  onForward,
  submitting,
}: DepartmentCartColumnProps) {
  const { carts, activeCartId } = useCartStore();
  const activeCart = carts.find((c) => c.id === activeCartId) || carts[0];
  const cartItems = activeCart?.items || [];
  const cartTotal = activeCart?.total || 0;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside className="hidden md:flex w-[min(280px,28vw)] max-w-[300px] lg:w-[min(300px,30vw)] lg:max-w-[320px] 2xl:w-[min(360px,32vw)] 2xl:min-w-[320px] 2xl:max-w-[440px] flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 h-full min-h-0">
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#1c6a1e]/10 to-blue-50/50 dark:from-[#1c6a1e]/20 dark:to-blue-950/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-none bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-sm flex-shrink-0">
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Department Order
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {cartCount} {cartCount === 1 ? 'item' : 'items'} · KES {cartTotal.toFixed(0)}
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <DepartmentOrderPanel
          layout="column"
          customerName={customerName}
          onCustomerNameChange={onCustomerNameChange}
          onSaveDraft={onSaveDraft}
          onForward={onForward}
          submitting={submitting}
        />
      </div>
    </aside>
  );
}
