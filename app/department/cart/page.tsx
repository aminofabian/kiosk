'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DepartmentOrderPanel } from '@/components/department/DepartmentOrderPanel';
import { useDepartmentApp } from '@/components/department/DepartmentAppProvider';

export default function DepartmentCartPage() {
  const {
    customerName,
    setCustomerName,
    submitOrder,
    submitting,
    cartItemCount,
  } = useDepartmentApp();

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f8f6] dark:bg-[#132210]">
      <header className="shrink-0 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center gap-2 px-3 h-12 max-w-3xl mx-auto w-full">
          <Link
            href="/department"
            className="pos-icon-btn flex-shrink-0"
            aria-label="Back to sell"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <h1 className="text-[17px] font-bold text-slate-900 dark:text-white">
            Order{cartItemCount > 0 ? ` (${cartItemCount})` : ''}
          </h1>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden max-w-3xl mx-auto w-full">
        <DepartmentOrderPanel
          layout="mobile"
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          onSaveDraft={() => void submitOrder(false)}
          onForward={() => void submitOrder(true)}
          submitting={submitting}
        />
      </div>
    </div>
  );
}
