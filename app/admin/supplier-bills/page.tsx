'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { SupplierBillsList } from '@/components/admin/SupplierBillsList';
import { SupplierBillForm, type SupplierBillInitialData } from '@/components/admin/SupplierBillForm';
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
  // Replicate past order: open new bill form with items from existing bill
  const [replicateInitialData, setReplicateInitialData] = useState<SupplierBillInitialData | null>(null);

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
    setReplicateInitialData(null);
    // Trigger refresh of the list by changing the key
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenNewBill = () => {
    setPreSelectedSupplierId(undefined);
    setPreSelectedSupplierName(undefined);
    setReplicateInitialData(null);
    setDrawerOpen(true);
  };

  const handleReplicateBill = (bill: {
    supplier_id: string | null;
    supplier_name: string;
    supplier_phone: string | null;
    bill_description: string;
    amount: number;
    due_date: number;
    notes: string | null;
    preferred_payment_method: string | null;
    payment_details: string | null;
  }) => {
    const now = Math.floor(Date.now() / 1000);
    const dueDate = bill.due_date > now ? bill.due_date : now + 7 * 86400; // Use original if future, else 7 days from now
    setReplicateInitialData({
      supplierId: bill.supplier_id,
      supplierName: bill.supplier_name,
      supplierPhone: bill.supplier_phone ?? '',
      billDescription: bill.bill_description,
      amount: bill.amount,
      dueDate,
      notes: bill.notes ?? '',
      preferredPaymentMethod: bill.preferred_payment_method,
      paymentDetails: bill.payment_details,
    });
    setPreSelectedSupplierId(bill.supplier_id ?? undefined);
    setPreSelectedSupplierName(bill.supplier_name);
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
      <div className="min-h-screen bg-slate-100/60 dark:bg-[#0a1208]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {/* Page Header */}
          <header className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-md shrink-0">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Supplier Bills
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    Record bills, track payments, and manage supplier orders.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleOpenNewBill}
                size="default"
                className="bg-[#1c6a1e] hover:bg-[#238b26] text-white shrink-0 h-10 px-5 font-medium rounded-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Bill
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="space-y-6">
          <SupplierBillsList
            key={refreshKey}
            onSupplierClick={handleSupplierClick}
            onAddBill={handleOpenNewBill}
            onReplicateBill={handleReplicateBill}
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
                  key={replicateInitialData ? `replicate-${replicateInitialData.supplierName}-${replicateInitialData.amount}` : preSelectedSupplierId || 'default'}
                  onSuccess={handleSuccess}
                  onCancel={() => {
                    setDrawerOpen(false);
                    setReplicateInitialData(null);
                  }}
                  preSelectedSupplierId={preSelectedSupplierId}
                  linkedProductsRefreshKey={linkedProductsRefreshKey}
                  initialData={replicateInitialData ?? undefined}
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
