'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShiftCloseForm } from '@/components/pos/ShiftCloseForm';
import type { Shift } from '@/lib/db/types';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import type { PendingOpeningRequest } from '@/lib/hooks/use-current-shift';

interface PosShiftCloseContentProps {
  embedded?: boolean;
  onSuccess?: () => void;
}

export function PosShiftCloseContent({ embedded, onSuccess }: PosShiftCloseContentProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [pendingOpening, setPendingOpening] = useState<PendingOpeningRequest[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiGet<Shift>('/api/shifts/current');
      if (result.success && result.data) {
        setShift(result.data);
        setPendingOpening([]);
        return;
      }

      setShift(null);
      const approvalsResult = await apiGet<PendingOpeningRequest[]>(
        '/api/balance/approvals?status=pending'
      );
      if (approvalsResult.success && approvalsResult.data) {
        setPendingOpening(
          approvalsResult.data.filter((r) => r.balance_type === 'opening')
        );
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
      const result = await apiPost(`/api/balance/approvals/${requestId}/reject`, {});
      if (result.success) {
        await fetchData();
        onSuccess?.();
      } else {
        setError(result.message || 'Failed to withdraw');
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
      <div className={`flex items-center justify-center ${embedded ? 'py-12' : 'h-full'}`}>
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-sm">Loading shift...</p>
        </div>
      </div>
    );
  }

  if (shift) {
    return (
      <ShiftCloseForm
        shift={shift}
        embedded={embedded}
        onSuccess={() => {
          onSuccess?.();
        }}
      />
    );
  }

  if (pendingOpening.length > 0) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              No open shift yet
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              You have a pending opening request waiting for approval. Withdraw it below or wait for
              admin approval.
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
      </div>
    );
  }

  return (
    <div className="text-center space-y-3 py-8">
      <p className="text-destructive text-sm">{error || 'No open shift found'}</p>
      <p className="text-muted-foreground text-sm">Open a shift first to close it.</p>
    </div>
  );
}
