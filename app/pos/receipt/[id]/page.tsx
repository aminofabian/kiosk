'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { POSLayout } from '@/components/layouts/pos-layout';
import { Receipt } from '@/components/pos/Receipt';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

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
    async function fetchReceipt() {
      try {
        setLoading(true);
        const response = await fetch(`/api/sales/${saleId}`);
        const result = await response.json();

        if (result.success) {
          setReceiptData(result.data);
        } else {
          setError(result.message || 'Failed to load receipt');
        }
      } catch (err) {
        setError('Failed to load receipt');
        console.error('Error fetching receipt:', err);
      } finally {
        setLoading(false);
      }
    }

    if (saleId) {
      fetchReceipt();
    }
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

  return (
    <POSLayout
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Receipt</h1>
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
              className="bg-[#259783] hover:bg-[#45d827] text-white"
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

