'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCartStore } from '@/lib/stores/cart-store';
import { usePendingSalesStore } from '@/lib/stores/pending-sales-store';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';

export function usePendingSales() {
  const isOnline = useOnlineStatus();
  const linkedIds = useCartStore(
    useShallow((s) =>
      s.carts
        .map((c) => c.pendingSaleId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { sales, loading, error, refresh, removeSale } = usePendingSalesStore(
    useShallow((s) => ({
      sales: s.sales,
      loading: s.loading,
      error: s.error,
      refresh: s.refresh,
      removeSale: s.removeSale,
    })),
  );

  const doRefresh = useCallback(async () => {
    await refresh(isOnline);
  }, [refresh, isOnline]);

  useEffect(() => {
    void doRefresh();
  }, [doRefresh]);

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
    refresh: doRefresh,
    removeSale,
  };
}
