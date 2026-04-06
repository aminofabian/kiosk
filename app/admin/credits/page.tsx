'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { CreditList } from '@/components/admin/CreditList';
import { Wallet, TrendingDown } from 'lucide-react';

export default function CreditsPage() {
  return (
    <AdminLayout>
      <div className="min-h-[100dvh] md:min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100/90 dark:from-[#0a1209] dark:via-[#0f1a0d] dark:to-[#0a1209]">
        {/* Mobile: native-style top bar */}
        <header className="md:hidden z-30 border-b border-slate-200/70 dark:border-slate-800/80 bg-white/85 dark:bg-[#0f1a0d]/90 backdrop-blur-xl backdrop-saturate-150 safe-area-top sticky top-0">
          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] text-white shadow-md shadow-[#1c6a1e]/30 ring-1 ring-white/25 dark:ring-slate-900/40">
                <Wallet className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[1.375rem] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
                  Credits
                </h1>
                <p className="mt-0.5 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
                  Collect balances &amp; track debt
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Desktop hero */}
        <header className="hidden md:block relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800/80">
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

        {/* Content: mobile “sheet” over gradient; desktop flat */}
        <main className="relative px-0 md:px-6 lg:px-8 py-0 md:py-8 md:pb-10">
          <div className="mx-auto max-w-5xl lg:max-w-6xl">
            <div
              className="
              rounded-t-[1.35rem] md:rounded-none
              -mt-1 md:mt-0
              bg-[#f4f7f5] dark:bg-[#0b1309]
              border-t border-x border-slate-200/80 dark:border-slate-800/90
              shadow-[0_-10px_40px_-12px_rgba(15,23,42,0.14)] dark:shadow-[0_-12px_48px_-8px_rgba(0,0,0,0.55)]
              md:border-0 md:bg-transparent md:shadow-none
              overflow-hidden md:overflow-visible
            "
            >
              <div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-slate-600/70 mx-auto mt-2.5 mb-0.5 md:hidden shrink-0" aria-hidden />
              <div className="px-4 pt-1 pb-4 md:p-0 md:pt-0">
                <CreditList />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
