'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { syncPendingSales } from '@/lib/offline/sync';
import { getPendingSalesCount } from '@/lib/offline/queue';

/**
 * Listens for 'online' event and syncs pending offline sales.
 * Runs when the app is loaded and when connectivity is restored.
 */
export function SyncOnReconnect() {
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const runSync = async () => {
      const count = await getPendingSalesCount();
      if (count === 0) return;

      const { synced, failed } = await syncPendingSales();
      if (synced > 0) toast.success(`${synced} offline sale(s) synced`);
      if (failed > 0) toast.error(`${failed} sale(s) need review — check pending`);
    };

    const handleOnline = async () => {
      wasOfflineRef.current = false;
      await runSync();
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
    };

    wasOfflineRef.current = !navigator.onLine;

    // Sync on mount if online and we have pending sales (e.g. from previous session)
    if (navigator.onLine) runSync();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}
