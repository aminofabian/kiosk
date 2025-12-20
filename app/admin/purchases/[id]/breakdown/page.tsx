'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { BreakdownView } from '@/components/admin/BreakdownView';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function BreakdownPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseData, setPurchaseData] = useState<any>(null);

  useEffect(() => {
    async function fetchPurchase() {
      try {
        setLoading(true);
        const response = await fetch(`/api/purchases/${purchaseId}`);
        const result = await response.json();

        if (result.success) {
          setPurchaseData(result.data);
        } else {
          setError(result.message || 'Failed to load purchase');
        }
      } catch (err) {
        setError('Failed to load purchase');
        console.error('Error fetching purchase:', err);
      } finally {
        setLoading(false);
      }
    }

    if (purchaseId) {
      fetchPurchase();
    }
  }, [purchaseId]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading purchase...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !purchaseData) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error || 'Purchase not found'}</p>
            <Button onClick={() => router.push('/admin/purchases')} size="touch">
              Back to Purchases
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
          <Link href="/admin/purchases">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Purchase Breakdown</h1>
        </div>
        <BreakdownView purchase={purchaseData.purchase} items={purchaseData.items} />
      </div>
    </AdminLayout>
  );
}

