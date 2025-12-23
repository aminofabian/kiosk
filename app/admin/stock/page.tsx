'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { StockList } from '@/components/admin/StockList';
import { RestockDrawer } from '@/components/admin/RestockDrawer';
import { StockAnalysisDrawer } from '@/components/admin/StockAnalysisDrawer';
import { StockAdjustForm } from '@/components/admin/StockAdjustForm';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import Link from 'next/link';
import { PackageCheck, ClipboardList, Settings, ShoppingCart, BarChart3, Plus, Scale, X, ChevronRight } from 'lucide-react';

export default function StockPage() {
  const [restockDrawerOpen, setRestockDrawerOpen] = useState(false);
  const [analysisDrawerOpen, setAnalysisDrawerOpen] = useState(false);
  const [addStockDrawerOpen, setAddStockDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a1208]">
        {/* Mobile Header - App Style */}
        <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-[#0f1a0d] safe-area-top">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#259783] to-[#45d827] flex items-center justify-center shadow-lg shadow-[#259783]/25">
                <PackageCheck className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Stock</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Inventory Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAnalysisDrawerOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <BarChart3 className="w-5 h-5 text-[#259783]" />
              </button>
              <button
                onClick={() => setRestockDrawerOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-amber-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#259783] to-[#45d827] flex items-center justify-center shadow-lg shadow-[#259783]/20">
                  <PackageCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stock Management</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Monitor inventory levels and growth</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setAddStockDrawerOpen(true)}
                  size="sm"
                  className="h-9 px-3 bg-gradient-to-r from-[#259783] to-[#45d827] hover:from-[#45d827] hover:to-[#259783] text-white shadow-md shadow-[#259783]/20"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Stock
                </Button>
                <Link href="/admin/stock/take">
                  <Button size="sm" className="h-9 px-3 bg-[#259783] hover:bg-[#45d827] text-white shadow-sm">
                    <ClipboardList className="w-4 h-4 mr-1.5" />
                    Stock Take
                  </Button>
                </Link>
                <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
                  <Button onClick={() => setRestockDrawerOpen(true)} size="sm" variant="ghost" className="h-9 px-2.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <ShoppingCart className="w-4 h-4" />
                    <span className="ml-1.5 text-xs">Restock</span>
                  </Button>
                  <Button onClick={() => setAnalysisDrawerOpen(true)} size="sm" variant="ghost" className="h-9 px-2.5 text-[#259783] hover:bg-[#259783]/10">
                    <BarChart3 className="w-4 h-4" />
                    <span className="ml-1.5 text-xs">Analysis</span>
                  </Button>
                  <Link href="/admin/stock/adjust">
                    <Button size="sm" variant="ghost" className="h-9 px-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <Settings className="w-4 h-4" />
                      <span className="ml-1.5 text-xs">Adjust</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-3 py-3 md:p-6 pb-28 md:pb-6 max-w-7xl mx-auto">
          <StockList />
        </div>

        {/* Mobile FAB Menu */}
        <div className="md:hidden fixed bottom-20 right-4 z-30 flex flex-col-reverse items-end gap-3">
          {/* FAB Actions - Show when open */}
          {fabOpen && (
            <>
              <button
                onClick={() => { setFabOpen(false); setAddStockDrawerOpen(true); }}
                className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#259783] to-[#45d827] flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Add Stock</span>
              </button>
              <Link
                href="/admin/stock/take"
                onClick={() => setFabOpen(false)}
                className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-150"
              >
                <div className="w-8 h-8 rounded-full bg-[#259783] flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Stock Take</span>
              </Link>
              <Link
                href="/admin/stock/adjust"
                onClick={() => setFabOpen(false)}
                className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-100"
              >
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Adjust</span>
              </Link>
            </>
          )}
          
          {/* Main FAB Button */}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
              fabOpen
                ? 'bg-slate-800 dark:bg-slate-200 rotate-45'
                : 'bg-gradient-to-br from-[#259783] to-[#45d827] shadow-[#259783]/30'
            }`}
          >
            {fabOpen ? (
              <X className="w-6 h-6 text-white dark:text-slate-900" />
            ) : (
              <Plus className="w-7 h-7 text-white" />
            )}
          </button>
        </div>

        {/* FAB Backdrop */}
        {fabOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-20 animate-in fade-in duration-200"
            onClick={() => setFabOpen(false)}
          />
        )}

        {/* Drawers */}
        <RestockDrawer open={restockDrawerOpen} onOpenChange={setRestockDrawerOpen} />
        <StockAnalysisDrawer open={analysisDrawerOpen} onOpenChange={setAnalysisDrawerOpen} />
        
        {/* Add Stock Drawer */}
        <Drawer open={addStockDrawerOpen} onOpenChange={setAddStockDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Header */}
            <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50 px-6 py-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#259783] to-[#45d827] flex items-center justify-center shadow-lg shadow-[#259783]/25 ring-2 ring-[#259783]/10">
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <DrawerTitle className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      Add Stock
                    </DrawerTitle>
                    <DrawerDescription className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Adjust inventory levels
                    </DrawerDescription>
                  </div>
                </div>
                <button
                  onClick={() => setAddStockDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </DrawerHeader>
            
            {/* Content */}
            <div className="overflow-y-auto flex-1 bg-gradient-to-b from-white via-slate-50/30 to-white dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-900">
              <div className="px-4 sm:px-6 py-6 max-w-none">
                <StockAdjustForm
                  onSuccess={() => setAddStockDrawerOpen(false)}
                  onCancel={() => setAddStockDrawerOpen(false)}
                />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
}
