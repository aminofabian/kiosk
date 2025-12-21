'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { CreditList } from '@/components/admin/CreditList';
import { CreditCard } from 'lucide-react';

export default function CreditsPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#259783] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Outstanding Credits</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Track customer debts and payments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          <CreditList />
        </div>
      </div>
    </AdminLayout>
  );
}
