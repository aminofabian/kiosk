'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { StockTakeForm } from '@/components/admin/StockTakeForm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';

export default function StockTakePage() {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <Link href="/admin/stock">
            <Button variant="outline" size="sm" className="w-full md:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Stock
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 md:h-7 md:w-7" />
              Stock Taking
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Count physical inventory and record actual stock levels
            </p>
          </div>
        </div>
        <StockTakeForm />
      </div>
    </AdminLayout>
  );
}

