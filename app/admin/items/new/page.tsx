'use client';

import { AdminLayout } from '@/components/layouts/admin-layout';
import { ItemForm } from '@/components/admin/ItemForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewItemPage() {
  return (
    <AdminLayout
      sidebar={
        <div className="p-4 space-y-2">
          <Link href="/admin">
            <Button variant="ghost" className="w-full justify-start">
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/purchases">
            <Button variant="ghost" className="w-full justify-start">
              Purchases
            </Button>
          </Link>
          <Link href="/admin/items">
            <Button variant="default" className="w-full justify-start">
              Items
            </Button>
          </Link>
          <Link href="/admin/stock">
            <Button variant="ghost" className="w-full justify-start">
              Stock
            </Button>
          </Link>
        </div>
      }
    >
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/items">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Add New Item</h1>
        </div>
        <ItemForm />
      </div>
    </AdminLayout>
  );
}

