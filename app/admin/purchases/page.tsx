'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { PurchaseList } from '@/components/admin/PurchaseList';
import { PurchaseForm } from '@/components/admin/PurchaseForm';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Plus, ShoppingBag, ListChecks, X } from 'lucide-react';

interface PurchaseItem {
  id: string;
  itemName: string;
  quantityNote: string;
  amount: string;
  itemId: string | null;
  notes: string;
}

interface PurchaseFormData {
  supplierName: string;
  purchaseDate: string;
  totalAmount: string;
  extraCosts: string;
  notes: string;
  items: PurchaseItem[];
}

export default function PurchasesPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState<PurchaseFormData>({
    supplierName: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    totalAmount: '',
    extraCosts: '0',
    notes: '',
    items: [],
  });

  const handleDataChange = useCallback((data: PurchaseFormData) => {
    setFormData(data);
  }, []);

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Purchases</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Track your inventory purchases</p>
                </div>
              </div>
              <Button
                onClick={() => setDrawerOpen(true)}
                className="bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-lg shadow-[#259783]/20"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Purchase</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          <PurchaseList />
        </div>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen flex flex-col">
            <DrawerHeader className="border-b bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 relative pr-12">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-4 top-4 h-8 w-8 hover:bg-amber-200 dark:hover:bg-amber-900/40"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30">
                  <ListChecks className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DrawerTitle className="text-xl flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    Purchase List
                  </DrawerTitle>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <DrawerDescription className="text-xs text-amber-800/70 dark:text-amber-200/70 mt-1">
                Add items and track your purchase
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 sm:px-6 pb-24 flex-1 bg-gradient-to-b from-amber-50/30 via-white to-white dark:from-amber-950/10 dark:via-[#0f1a0d] dark:to-[#0f1a0d]">
              <PurchaseForm
                initialData={formData}
                onDataChange={handleDataChange}
                onSuccess={(purchaseId) => {
                  setFormData({
                    supplierName: '',
                    purchaseDate: new Date().toISOString().split('T')[0],
                    totalAmount: '',
                    extraCosts: '0',
                    notes: '',
                    items: [],
                  });
                  setDrawerOpen(false);
                  router.push(`/admin/purchases/${purchaseId}/breakdown`);
                }}
                onCancel={() => {
                  setDrawerOpen(false);
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
}
