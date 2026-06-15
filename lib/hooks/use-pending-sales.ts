'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '@/lib/stores/cart-store';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import {
  fetchPendingSales,
  type PendingSale,
} from '@/lib/pos/pending-sales';

export function usePendingSales() {
  const isOnline = useOnlineStatus();
  const linkedIds = useCartStore(
    useShallow((s) =>
      s.carts
        .map((c) => c.pendingSaleId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isOnline) {
      setSales([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingSales();
      setSales(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved sales');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkedSet = useMemo(() => new Set(linkedIds), [linkedIds]);
  const orphaned = useMemo(
    () => sales.filter((s) => s.status === 'pending' && !linkedSet.has(s.id)),
    [sales, linkedSet],
  );

  return {
    sales,
    loading,
    error,
    orphaned,
    orphanedCount: orphaned.length,
    totalCount: sales.length,
    refresh,
  };
}
