'use client';

import { DepartmentOrderPanel } from '@/components/department/DepartmentOrderPanel';
import { useCartStore } from '@/lib/stores/cart-store';

interface DepartmentMobileCartTabProps {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  onSaveDraft: () => void;
  onForward: () => void;
  submitting?: boolean;
}

export function DepartmentMobileCartTab({
  customerName,
  onCustomerNameChange,
  onSaveDraft,
  onForward,
  submitting,
}: DepartmentMobileCartTabProps) {
  const { carts, activeCartId } = useCartStore();
  const activeCart = carts.find((c) => c.id === activeCartId) || carts[0];
  const cartCount = (activeCart?.items || []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <header className="shrink-0 z-20 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center justify-between px-4 h-12">
          <h1 className="text-[17px] font-bold text-slate-900 dark:text-white">Order</h1>
          {cartCount > 0 && (
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))]">
        <DepartmentOrderPanel
          layout="mobile"
          customerName={customerName}
          onCustomerNameChange={onCustomerNameChange}
          onSaveDraft={onSaveDraft}
          onForward={onForward}
          submitting={submitting}
        />
      </main>
    </>
  );
}
