'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { StockAdjustmentList } from '@/components/admin/StockAdjustmentList';
import { ClipboardList } from 'lucide-react';

export default function StockAdjustmentsPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-md shadow-[#1c6a1e]/30">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Stock Adjustments
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                View and reverse historical stock adjustments
              </p>
            </div>
          </div>

          <StockAdjustmentList />
        </div>
      </div>
    </AdminLayout>
  );
}
