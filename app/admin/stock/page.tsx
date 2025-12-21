'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { StockList } from '@/components/admin/StockList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PackageCheck, ClipboardList, Settings } from 'lucide-react';

export default function StockPage() {
  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <PackageCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Stock Levels</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Monitor your inventory</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/admin/stock/take">
                  <Button className="bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-lg shadow-[#259783]/20">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Stock Take</span>
                    <span className="sm:hidden">Take</span>
                  </Button>
                </Link>
                <Link href="/admin/stock/adjust">
                  <Button variant="outline" className="border-slate-200 dark:border-slate-700">
                    <Settings className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Adjust Stock</span>
                    <span className="sm:hidden">Adjust</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          <StockList />
        </div>
      </div>
    </AdminLayout>
  );
}
