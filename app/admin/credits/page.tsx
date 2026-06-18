'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { CreditList } from '@/components/admin/CreditList';
import { Wallet } from 'lucide-react';

export default function CreditsPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="px-4 md:px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1c6a1e] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                Credits
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Customer tabs, collect payments & track balances
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 py-4 pb-24 md:pb-6 max-w-6xl">
          <CreditList />
        </div>
      </div>
    </AdminLayout>
  );
}
