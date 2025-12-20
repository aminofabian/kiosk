'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { CreditList } from '@/components/admin/CreditList';
import { CreditCard } from 'lucide-react';

export default function CreditsPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Outstanding Credits</h1>
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
