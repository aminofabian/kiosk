'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { SupplierBillsList } from '@/components/admin/SupplierBillsList';
import { SupplierBillForm } from '@/components/admin/SupplierBillForm';
import { SupplierProductsDrawer } from '@/components/admin/SupplierProductsDrawer';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Receipt, Plus, X, Loader2 } from 'lucide-react';

interface SupplierForDrawer {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  notes: string | null;
  supplier_type?: string | null;
}

function SupplierBillsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Pre-selected supplier for the new bill form
  const [preSelectedSupplierId, setPreSelectedSupplierId] = useState<string | undefined>();
  const [preSelectedSupplierName, setPreSelectedSupplierName] = useState<string | undefined>();
  // Supplier products drawer
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierForDrawer | null>(null);

  // Check if we should open the drawer from URL query parameter
  useEffect(() => {
    const shouldOpen = searchParams.get('new') === 'true';
    if (shouldOpen) {
      setDrawerOpen(true);
      // Clean up the URL
      router.replace('/admin/supplier-bills', { scroll: false });
    }
  }, [searchParams, router]);

  const handleSuccess = () => {
    setDrawerOpen(false);
    setPreSelectedSupplierId(undefined);
    setPreSelectedSupplierName(undefined);
    // Trigger refresh of the list by changing the key
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenNewBill = () => {
    setPreSelectedSupplierId(undefined);
    setPreSelectedSupplierName(undefined);
    setDrawerOpen(true);
  };

  const handleSupplierClick = (supplier: SupplierForDrawer) => {
    setSelectedSupplier(supplier);
    setSupplierDrawerOpen(true);
  };

  const handleCreateBillFromSupplier = (supplierId: string, supplierName: string) => {
    // Close supplier drawer, open bill drawer with pre-selected supplier
    setSupplierDrawerOpen(false);
    setPreSelectedSupplierId(supplierId);
    setPreSelectedSupplierName(supplierName);
    setDrawerOpen(true);
  };

  const handleSupplierDeleted = () => {
    setSelectedSupplier(null);
    setSupplierDrawerOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen px-3 py-4 sm:px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-md shadow-[#1c6a1e]/30 shrink-0">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                  Supplier Bills
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
                  Manage pending payments to suppliers
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenNewBill}
              size="sm"
              className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white shrink-0 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Bill</span>
            </Button>
          </div>

          <SupplierBillsList
            key={refreshKey}
            onSupplierClick={handleSupplierClick}
          />

          {/* Supplier Products Drawer */}
          <SupplierProductsDrawer
            open={supplierDrawerOpen}
            onOpenChange={setSupplierDrawerOpen}
            supplier={selectedSupplier}
            onCreateBill={handleCreateBillFromSupplier}
            onSupplierDeleted={handleSupplierDeleted}
            onSupplierUpdated={(updated) => setSelectedSupplier(updated)}
          />

          {/* New Supplier Bill Drawer */}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
            <DrawerContent className="!w-full sm:!w-[900px] !max-w-none h-full max-h-screen z-[51]">
              <DrawerHeader className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative pr-12">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDrawerOpen(false)}
                  className="absolute right-4 top-4 h-10 w-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-2 border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm hover:shadow-md rounded-lg"
                >
                  <X className="h-5 w-5" />
                </Button>
                <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
                  <Receipt className="w-5 h-5 text-[#1c6a1e]" />
                  New Supplier Bill
                  {preSelectedSupplierName && (
                    <span className="text-sm font-normal text-slate-500">
                      — {preSelectedSupplierName}
                    </span>
                  )}
                </DrawerTitle>
                <DrawerDescription className="text-slate-600 dark:text-slate-400">
                  Record a pending payment to a supplier
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <SupplierBillForm
                  key={preSelectedSupplierId || 'default'}
                  onSuccess={handleSuccess}
                  onCancel={() => setDrawerOpen(false)}
                  preSelectedSupplierId={preSelectedSupplierId}
                  onOpenManageLinkProducts={(supplier) => {
                    setSelectedSupplier({
                      ...supplier,
                      location: supplier.location ?? null,
                      notes: supplier.notes ?? null,
                    });
                    setSupplierDrawerOpen(true);
                  }}
                />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </AdminLayout>
  );
}

export default function SupplierBillsPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="min-h-screen px-3 py-4 sm:px-4 md:px-6 lg:px-8 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
              <p className="text-sm text-slate-500">Loading...</p>
            </div>
          </div>
        </AdminLayout>
      }
    >
      <SupplierBillsPageContent />
    </Suspense>
  );
}
