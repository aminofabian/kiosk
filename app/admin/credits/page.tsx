'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { CreditList } from '@/components/admin/CreditList';
import { Wallet, TrendingDown } from 'lucide-react';

export default function CreditsPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 dark:from-[#0a1209] dark:via-[#0f1a0d] dark:to-[#0a1209]">
        {/* Hero header */}
        <header className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#1c6a1e08_0%,transparent_50%),linear-gradient(225deg,#1c6a1e12_0%,transparent_45%)] dark:bg-[linear-gradient(135deg,#1c6a1e15_0%,transparent_50%)]" />
          <div className="relative px-4 md:px-6 lg:px-8 py-8 md:py-10">
            <div className="max-w-5xl lg:max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] text-white shadow-lg shadow-[#1c6a1e]/25 ring-2 ring-white/20 dark:ring-slate-800/50">
                  <Wallet className="h-7 w-7" strokeWidth={2.25} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Outstanding Credits
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md">
                    Track customer debts, collect payments, and keep your books in order.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                    <span>Debts owed to your business</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="relative px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-28 md:pb-10">
          <div className="max-w-5xl lg:max-w-6xl mx-auto">
            <CreditList />
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
