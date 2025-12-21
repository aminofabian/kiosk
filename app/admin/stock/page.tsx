'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { StockList } from '@/components/admin/StockList';
import { RestockDrawer } from '@/components/admin/RestockDrawer';
import { StockAnalysisDrawer } from '@/components/admin/StockAnalysisDrawer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PackageCheck, ClipboardList, Settings, ShoppingCart, BarChart3 } from 'lucide-react';

export default function StockPage() {
  const [restockDrawerOpen, setRestockDrawerOpen] = useState(false);
  const [analysisDrawerOpen, setAnalysisDrawerOpen] = useState(false);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-[#0a1208] dark:to-[#0f1a0d]">
        {/* Compact Header */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-[#0f1a0d]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="px-3 md:px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#259783] to-[#45d827] flex items-center justify-center shadow-md shadow-[#259783]/20">
                  <PackageCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Stock</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Inventory & Growth</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={() => setAnalysisDrawerOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-[#259783] hover:bg-[#259783]/10"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden lg:inline ml-1.5 text-xs">Analysis</span>
                </Button>
                <Button
                  onClick={() => setRestockDrawerOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden lg:inline ml-1.5 text-xs">Restock</span>
                </Button>
                <Link href="/admin/stock/take">
                  <Button 
                    size="sm"
                    className="h-8 px-2.5 bg-[#259783] hover:bg-[#45d827] text-white text-xs shadow-sm"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline ml-1.5">Take</span>
                  </Button>
                </Link>
                <Link href="/admin/stock/adjust">
                  <Button 
                    size="sm"
                    variant="outline" 
                    className="h-8 px-2.5 text-xs border-slate-200 dark:border-slate-700"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline ml-1.5">Adjust</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 md:p-4 pb-24 md:pb-6">
          <StockList />
        </div>

        <RestockDrawer open={restockDrawerOpen} onOpenChange={setRestockDrawerOpen} />
        <StockAnalysisDrawer open={analysisDrawerOpen} onOpenChange={setAnalysisDrawerOpen} />
      </div>
    </AdminLayout>
  );
}
