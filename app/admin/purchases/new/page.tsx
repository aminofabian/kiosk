'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { PurchaseForm } from '@/components/admin/PurchaseForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPurchasePage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/purchases">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">New Purchase</h1>
        </div>
        <PurchaseForm />
      </div>
    </AdminLayout>
  );
}

