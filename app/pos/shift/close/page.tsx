'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { POSLayout } from '@/components/layouts/pos-layout';
import { ShiftCloseForm } from '@/components/pos/ShiftCloseForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Shift } from '@/lib/db/types';

type PendingOpeningItem = { id: string; amount: number; balance_type: string };

export default function ShiftClosePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [pendingOpening, setPendingOpening] = useState<PendingOpeningItem[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/shifts/current');
      const result = await response.json();

      if (result.success && result.data) {
        setShift(result.data);
        setPendingOpening([]);
        return;
      }

      setShift(null);
      const approvalsRes = await fetch('/api/balance/approvals?status=pending');
      const approvalsData = await approvalsRes.json();
      if (approvalsData.success && Array.isArray(approvalsData.data)) {
        const opening = approvalsData.data.filter(
          (r: { balance_type: string }) => r.balance_type === 'opening'
        );
        setPendingOpening(opening);
      } else {
        setPendingOpening([]);
      }
    } catch (err) {
      setError('Failed to load shift');
      console.error('Error fetching shift:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWithdraw = async (requestId: string) => {
    try {
      setWithdrawingId(requestId);
      const res = await fetch(`/api/balance/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.message || 'Failed to withdraw');
      }
    } catch (err) {
      setError('Failed to withdraw');
      console.error('Error withdrawing:', err);
    } finally {
      setWithdrawingId(null);
    }
  };

  const formatPrice = (n: number) => `KES ${n.toLocaleString('en-US')}`;

  if (loading) {
    return (
      <POSLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading shift...</p>
          </div>
        </div>
      </POSLayout>
    );
  }

  if (shift) {
    return (
      <POSLayout
        header={
          <div className="flex items-center justify-between">
            <Link href="/pos">
              <Button variant="ghost" size="touch" className="gap-2">
                <ArrowLeft className="h-5 w-5" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Close Shift</h1>
            <div className="w-24" />
          </div>
        }
      >
        <ShiftCloseForm shift={shift} />
      </POSLayout>
    );
  }

  if (pendingOpening.length > 0) {
    return (
      <POSLayout
        header={
          <div className="flex items-center justify-between">
            <Link href="/pos">
              <Button variant="ghost" size="touch" className="gap-2">
                <ArrowLeft className="h-5 w-5" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Close Shift</h1>
            <div className="w-24" />
          </div>
        }
      >
        <div className="p-6 space-y-4 max-w-md mx-auto">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                No open shift yet
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                You have a pending opening request waiting for admin approval. You can withdraw it below to close it, or wait for approval.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {pendingOpening.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <span className="font-medium">{formatPrice(req.amount)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withdrawingId === req.id}
                  onClick={() => handleWithdraw(req.id)}
                >
                  {withdrawingId === req.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Withdraw'
                  )}
                </Button>
              </li>
            ))}
          </ul>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button onClick={() => router.push('/pos')} size="touch" variant="secondary" className="w-full">
            Back to POS
          </Button>
        </div>
      </POSLayout>
    );
  }

  return (
    <POSLayout>
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'No open shift found'}</p>
          <Button onClick={() => router.push('/pos')} size="touch">
            Back to POS
          </Button>
        </div>
      </div>
    </POSLayout>
  );
}

