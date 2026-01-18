'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { SupplierBillForm } from '@/components/admin/SupplierBillForm';
import { Receipt, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewSupplierBillPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      router.push('/admin/supplier-bills');
    }, 1500);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/admin/supplier-bills">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-md shadow-[#259783]/30">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  New Supplier Bill
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Record a pending payment to a supplier
                </p>
              </div>
            </div>
          </div>

          {success ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                Bill created successfully!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Redirecting to bills list...
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 rounded-lg p-6">
              <SupplierBillForm onSuccess={handleSuccess} />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
