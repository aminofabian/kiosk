'use client';

import { useState, useEffect, Suspense, type ReactNode } from 'react';
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

function SupplierBillsShell({
  children,
  onNewBill,
}: {
  children?: ReactNode;
  onNewBill?: () => void;
}) {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="px-4 md:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1c6a1e] flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  Supplier Bills
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Record bills, track payments & supplier orders
                </p>
              </div>
            </div>
            <Button
              onClick={onNewBill}
              disabled={!onNewBill}
              className="bg-[#1c6a1e] hover:bg-[#238b26] text-white shrink-0 h-9 disabled:opacity-70"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Bill
            </Button>
          </div>
        </div>
        <div className="px-4 md:px-6 py-4 pb-24 md:pb-6">
          {children ?? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#1c6a1e]" />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function SupplierBillsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [preSelectedSupplierId, setPreSelectedSupplierId] = useState<string | undefined>();
  const [preSelectedSupplierName, setPreSelectedSupplierName] = useState<string | undefined>();
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierForDrawer | null>(null);
  const [linkedProductsRefreshKey, setLinkedProductsRefreshKey] = useState(0);
  const [replicateInitialData, setReplicateInitialData] = useState<SupplierBillInitialData | null>(null);

  useEffect(() => {
    const shouldOpen = searchParams.get('new') === 'true';
    if (shouldOpen) {
      setDrawerOpen(true);
      router.replace('/admin/supplier-bills', { scroll: false });
    }
  }, [searchParams, router]);

  const handleSuccess = () => {
    setDrawerOpen(false);
    setPreSelectedSupplierId(undefined);
    setPreSelectedSupplierName(undefined);
    setReplicateInitialData(null);
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
    const dueDate = bill.due_date > now ? bill.due_date : now + 7 * 86400;
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
    <SupplierBillsShell onNewBill={handleOpenNewBill}>
      <SupplierBillsList
        key={refreshKey}
        onSupplierClick={handleSupplierClick}
        onAddBill={handleOpenNewBill}
        onReplicateBill={handleReplicateBill}
      />

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

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[900px] !max-w-none h-full max-h-screen z-[51]">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 relative pr-12 py-3 px-5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
            <DrawerTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white pr-8">
              <Receipt className="w-4 h-4 text-[#1c6a1e]" />
              New Supplier Bill
              {preSelectedSupplierName && (
                <span className="text-sm font-normal text-slate-500">
                  — {preSelectedSupplierName}
                </span>
              )}
            </DrawerTitle>
            <DrawerDescription className="text-sm text-slate-500">
              Record a pending payment to a supplier
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <SupplierBillForm
              key={
                replicateInitialData
                  ? `replicate-${replicateInitialData.supplierName}-${replicateInitialData.amount}`
                  : preSelectedSupplierId || 'default'
              }
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
    </SupplierBillsShell>
  );
}

export default function SupplierBillsPage() {
  return (
    <Suspense fallback={<SupplierBillsShell />}>
      <SupplierBillsPageContent />
    </Suspense>
  );
}
