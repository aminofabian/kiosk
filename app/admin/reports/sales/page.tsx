'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { SalesReport } from '@/components/admin/SalesReport';
import { FileText } from 'lucide-react';

export default function SalesReportPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Sales Report</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Analyze your sales performance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          <SalesReport />
        </div>
      </div>
    </AdminLayout>
  );
}
