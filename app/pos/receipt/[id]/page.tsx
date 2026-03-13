'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { POSLayout } from '@/components/layouts/pos-layout';
import { Receipt } from '@/components/pos/Receipt';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getPendingSaleById } from '@/lib/offline/queue';

const isOfflineSaleId = (id: string) => id.startsWith('local-');

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const hasPrintedRef = useRef(false);

  useEffect(() => {
    async function loadReceipt() {
      if (!saleId) return;
      try {
        setLoading(true);

        if (isOfflineSaleId(saleId)) {
          const pending = await getPendingSaleById(saleId);
          if (pending) {
            const saleDate = Math.floor(pending.createdAt / 1000);
            setReceiptData({
              sale: {
                id: pending.id,
                sale_date: saleDate,
                payment_method: pending.paymentMethod,
                total_amount: pending.totalAmount,
                business_name: 'POS',
                user_name: null,
              },
              items: pending.items.map((item, i) => ({
                id: `${item.itemId}-${i}`,
                item_id: item.itemId,
                item_name: item.name,
                quantity_sold: item.quantity,
                sell_price_per_unit: item.price,
                item_unit_type: item.unitType || 'piece',
              })),
              splitPayments: [],
            });
          } else {
            setError('Offline receipt not found');
          }
        } else {
          const response = await fetch(`/api/sales/${saleId}`);
          const result = await response.json();
          if (result.success) {
            setReceiptData(result.data);
          } else {
            setError(result.message || 'Failed to load receipt');
          }
        }
      } catch (err) {
        setError('Failed to load receipt');
        console.error('Error fetching receipt:', err);
      } finally {
        setLoading(false);
      }
    }

    loadReceipt();
  }, [saleId]);

  // Auto-print receipt after successful payment
  useEffect(() => {
    // Only auto-print if:
    // 1. Receipt data is loaded
    // 2. Not already printed in this session
    // 3. Has print=true in URL (indicates coming from successful payment)
    if (!loading && receiptData && !hasPrintedRef.current) {
      const shouldAutoPrint = searchParams.get('print') === 'true';
      
      if (shouldAutoPrint) {
        // Mark as printed to prevent re-printing on refresh
        hasPrintedRef.current = true;
        
        // Small delay to ensure page is fully rendered and images are loaded
        const printTimer = setTimeout(() => {
          window.print();
        }, 800);

        return () => clearTimeout(printTimer);
      }
    }
  }, [loading, receiptData, saleId, searchParams]);

  if (loading) {
    return (
      <POSLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading receipt...</p>
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
            <Button onClick={() => router.push('/pos')} size="touch">
              Back to POS
            </Button>
          </div>
        </div>
      </POSLayout>
    );
  }

  const isOfflineReceipt = isOfflineSaleId(saleId);

  return (
    <POSLayout
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Receipt</h1>
            {isOfflineReceipt && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                Offline — will sync when connected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="touch"
              onClick={() => window.print()}
            >
              Print
            </Button>
            <Button
              size="touch"
              onClick={() => router.push('/pos')}
              className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
            >
              New Sale
            </Button>
          </div>
        </div>
      }
    >
      <Receipt sale={receiptData.sale} items={receiptData.items} splitPayments={receiptData.splitPayments} />
    </POSLayout>
  );
}

