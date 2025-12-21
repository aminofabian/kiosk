'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { ProfitView } from '@/components/admin/ProfitView';
import { ProfitViewMobile } from '@/components/admin/ProfitViewMobile';
import { TrendingUp } from 'lucide-react';

export default function ProfitPage() {
  return (
    <AdminLayout>
      {/* Desktop View */}
      <div className="hidden md:block min-h-screen">
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#259783] flex items-center justify-center shadow-lg shadow-[#259783]/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Profit Analysis</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Track revenue, costs, and margins</p>
              </div>
            </div>
          </div>
        </div>
        <ProfitView />
      </div>
      
      {/* Mobile View */}
      <div className="md:hidden min-h-screen">
        <ProfitViewMobile />
      </div>
    </AdminLayout>
  );
}
