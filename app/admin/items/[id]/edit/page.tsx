'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { ItemForm } from '@/components/admin/ItemForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Item } from '@/lib/db/types';

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    async function fetchItem() {
      try {
        setLoading(true);
        const response = await fetch(`/api/items/${itemId}`);
        const result = await response.json();

        if (result.success) {
          setItem(result.data);
        } else {
          setError(result.message || 'Failed to load item');
        }
      } catch (err) {
        setError('Failed to load item');
        console.error('Error fetching item:', err);
      } finally {
        setLoading(false);
      }
    }

    if (itemId) {
      fetchItem();
    }
  }, [itemId]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading item...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !item) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error || 'Item not found'}</p>
            <Button onClick={() => router.push('/admin/items')} size="touch">
              Back to Items
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/items">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Edit Item: {item.name}</h1>
        </div>
        <ItemForm
          itemId={item.id}
          initialData={{
            name: item.name,
            category_id: item.category_id,
            unit_type: item.unit_type,
            current_stock: item.current_stock,
            current_sell_price: item.current_sell_price,
            min_stock_level: item.min_stock_level,
          }}
        />
      </div>
    </AdminLayout>
  );
}

