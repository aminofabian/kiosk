'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { POSLayout } from '@/components/layouts/pos-layout';
import { Receipt } from '@/components/pos/Receipt';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * Reprint receipt for a credit (tab) debt transaction — uses linked sale when present,
 * otherwise line items from `debt_line_items_json`.
 */
export default function CreditDebtReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    sale: Parameters<typeof Receipt>[0]['sale'];
    items: Parameters<typeof Receipt>[0]['items'];
    splitPayments?: Parameters<typeof Receipt>[0]['splitPayments'];
  } | null>(null);
  const hasPrintedRef = useRef(false);

  useEffect(() => {
    async function loadReceipt() {
      if (!transactionId) return;
      try {
        setLoading(true);
        const response = await fetch(`/api/credits/transactions/${transactionId}/receipt`);
        const result = await response.json();
        if (result.success) {
          setReceiptData(result.data);
        } else {
          setError(result.message || 'Failed to load receipt');
        }
      } catch (err) {
        setError('Failed to load receipt');
        console.error('Error fetching credit debt receipt:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReceipt();
  }, [transactionId]);

  useEffect(() => {
    if (!loading && receiptData && !hasPrintedRef.current) {
      const shouldAutoPrint = searchParams.get('print') === 'true';
      if (shouldAutoPrint) {
        hasPrintedRef.current = true;
        const printTimer = setTimeout(() => {
          window.print();
        }, 800);
        return () => clearTimeout(printTimer);
      }
    }
  }, [loading, receiptData, transactionId, searchParams]);

  if (loading) {
    return (
      <POSLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading receipt…</p>
          </div>
        </div>
      </POSLayout>
    );
  }

  if (error || !receiptData) {
    return (
      <POSLayout>
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error || 'Receipt not found'}</p>
            <Button onClick={() => router.push('/admin/credits')} size="touch" variant="outline">
              Back to credit list
            </Button>
          </div>
        </div>
      </POSLayout>
    );
  }

  return (
    <POSLayout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Credit receipt</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="touch" onClick={() => window.print()}>
              Print
            </Button>
            <Button
              size="touch"
              onClick={() => router.push('/admin/credits')}
              className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
            >
              Done
            </Button>
          </div>
        </div>
      }
    >
      <Receipt sale={receiptData.sale} items={receiptData.items} splitPayments={receiptData.splitPayments} />
    </POSLayout>
  );
}
