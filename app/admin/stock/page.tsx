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
import { PackageCheck, ClipboardList, Settings, ShoppingCart, BarChart3, Plus, Scale } from 'lucide-react';

export default function StockPage() {
  const [restockDrawerOpen, setRestockDrawerOpen] = useState(false);
  const [analysisDrawerOpen, setAnalysisDrawerOpen] = useState(false);
  const [addStockDrawerOpen, setAddStockDrawerOpen] = useState(false);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-[#0a1208] dark:to-[#0f1a0d]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="px-4 md:px-6 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Title Section */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#259783] to-[#45d827] flex items-center justify-center shadow-lg shadow-[#259783]/20">
                  <PackageCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Stock Management</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Monitor inventory levels and growth</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Primary Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setAddStockDrawerOpen(true)}
                    size="sm"
                    className="h-9 px-3 bg-gradient-to-r from-[#259783] to-[#45d827] hover:from-[#45d827] hover:to-[#259783] text-white shadow-md shadow-[#259783]/20"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Add Stock</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                  <Link href="/admin/stock/take">
                    <Button 
                      size="sm"
                      className="h-9 px-3 bg-[#259783] hover:bg-[#45d827] text-white shadow-sm"
                    >
                      <ClipboardList className="w-4 h-4 mr-1.5" />
                      <span className="hidden sm:inline">Stock Take</span>
                      <span className="sm:hidden">Take</span>
                    </Button>
                  </Link>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
                  <Button
                    onClick={() => setRestockDrawerOpen(true)}
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="hidden lg:inline ml-1.5 text-xs">Restock</span>
                  </Button>
                  <Button
                    onClick={() => setAnalysisDrawerOpen(true)}
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2.5 text-[#259783] hover:bg-[#259783]/10"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden lg:inline ml-1.5 text-xs">Analysis</span>
                  </Button>
                  <Link href="/admin/stock/adjust">
                    <Button 
                      size="sm"
                      variant="ghost" 
                      className="h-9 px-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hidden md:flex"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="hidden lg:inline ml-1.5 text-xs">Adjust</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-7xl mx-auto">
          <StockList />
        </div>

        {/* Drawers */}
        <RestockDrawer open={restockDrawerOpen} onOpenChange={setRestockDrawerOpen} />
        <StockAnalysisDrawer open={analysisDrawerOpen} onOpenChange={setAnalysisDrawerOpen} />
        
        {/* Add Stock Drawer */}
        <Drawer open={addStockDrawerOpen} onOpenChange={setAddStockDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
            <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-orange-50 dark:from-[#259783]/20 dark:to-orange-950/20 px-6 py-5">
              <DrawerTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-orange-500 flex items-center justify-center shadow-sm">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                Add Stock
              </DrawerTitle>
              <DrawerDescription className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Update inventory levels for damaged, spoiled, or miscounted items
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
              <StockAdjustForm
                onSuccess={() => setAddStockDrawerOpen(false)}
                onCancel={() => setAddStockDrawerOpen(false)}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
}
