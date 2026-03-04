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
  const [linkedProductsRefreshKey, setLinkedProductsRefreshKey] = useState(0);

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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 dark:from-[#0f1a0d] dark:to-slate-950/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Page Header */}
          <header className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1c6a1e] via-[#238b26] to-[#2a8a30] flex items-center justify-center shadow-lg shadow-[#1c6a1e]/30 ring-2 ring-[#1c6a1e]/10 shrink-0">
                  <Receipt className="w-6 h-6 text-white drop-shadow-sm" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Supplier Bills
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-md">
                    Track and manage pending payments to suppliers. Record bills, monitor due dates, and maintain cash flow visibility.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleOpenNewBill}
                size="default"
                className="bg-gradient-to-r from-[#1c6a1e] to-[#2a8a30] hover:from-[#238b26] hover:to-[#2d9a33] text-white shrink-0 h-10 px-4 sm:px-5 font-semibold shadow-lg shadow-[#1c6a1e]/25 hover:shadow-xl hover:shadow-[#1c6a1e]/30 transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Bill
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main>
          <SupplierBillsList
            key={refreshKey}
            onSupplierClick={handleSupplierClick}
          />

          {/* Supplier Products Drawer */}
          <SupplierProductsDrawer
            open={supplierDrawerOpen}
            onOpenChange={(open) => {
              if (!open) setLinkedProductsRefreshKey((k) => k + 1);
              setSupplierDrawerOpen(open);
            }}
            supplier={selectedSupplier}
            onCreateBill={handleCreateBillFromSupplier}
            onSupplierDeleted={handleSupplierDeleted}
            onSupplierUpdated={(updated) => setSelectedSupplier(updated)}
          />

          {/* New Supplier Bill Drawer */}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
            <DrawerContent className="!w-full sm:!w-[900px] !max-w-none h-full max-h-screen z-[51] rounded-l-2xl">
              <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-[#1c2e18] relative pr-12">
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
                  linkedProductsRefreshKey={linkedProductsRefreshKey}
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
          </main>
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
          <div className="min-h-screen flex items-center justify-center bg-slate-50/50 dark:bg-[#0f1a0d]">
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#1c6a1e]" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading supplier bills...</p>
            </div>
          </div>
        </AdminLayout>
      }
    >
      <SupplierBillsPageContent />
    </Suspense>
  );
}
