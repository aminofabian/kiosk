'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Shift } from '@/lib/db/types';
import { apiGet } from '@/lib/utils/api-client';
import { apiGetOffline } from '@/lib/offline/api-offline';

export type PendingOpeningRequest = {
  id: string;
  amount: number;
  balance_type: string;
};

export function useCurrentShift() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [pendingOpening, setPendingOpening] = useState<PendingOpeningRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const currentResult = await apiGetOffline<Shift | null>('/api/shifts/current');
      if (currentResult.success && currentResult.data) {
        setShift(currentResult.data);
        setPendingOpening([]);
        return;
      }

      setShift(null);
      const pendingResult = await apiGet<PendingOpeningRequest[]>(
        '/api/balance/approvals?status=pending'
      );
      if (pendingResult.success && pendingResult.data) {
        setPendingOpening(
          pendingResult.data.filter((r) => r.balance_type === 'opening')
        );
      } else {
        setPendingOpening([]);
      }
    } catch (err) {
      console.error('Error loading current shift:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    shift,
    pendingOpening,
    loading,
    hasOpenShift: Boolean(shift),
    refresh,
  };
}
