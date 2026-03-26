'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { apiGet } from '@/lib/utils/api-client';

interface ExpiringBatch {
  id: string;
  batch_number: string | null;
  item_name: string;
  unit_type: string;
  supplier_name: string | null;
  quantity_remaining: number;
  expiry_date: number;
  received_at: number;
}

interface ExpiryData {
  expired: ExpiringBatch[];
  expiringSoon: ExpiringBatch[];
  totalCount: number;
}

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const NOTIFIED_KEY_PREFIX = 'expiry-notified-';

function getNotifiedKey(batchId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${NOTIFIED_KEY_PREFIX}${batchId}-${today}`;
}

function wasNotifiedToday(batchId: string): boolean {
  try {
    return localStorage.getItem(getNotifiedKey(batchId)) === '1';
  } catch {
    return false;
  }
}

function markNotified(batchId: string): void {
  try {
    localStorage.setItem(getNotifiedKey(batchId), '1');
  } catch {}
}

function cleanupOldKeys(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(NOTIFIED_KEY_PREFIX) && !key.endsWith(today)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function useExpiryNotifications(enabled: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [permission, setPermission] = useState<NotificationPermissionState>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
    return result;
  }, []);

  const showNotifications = useCallback((data: ExpiryData) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const now = Date.now() / 1000;

    for (const batch of data.expired) {
      if (wasNotifiedToday(batch.id)) continue;
      const daysAgo = Math.ceil((now - batch.expiry_date) / 86400);
      new Notification('Stock Expired', {
        body: `${batch.item_name}${batch.batch_number ? ` (${batch.batch_number})` : ''} expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago — ${batch.quantity_remaining} ${batch.unit_type} remaining`,
        icon: '/icons/icon-192x192.png',
        tag: `expiry-${batch.id}`,
      });
      markNotified(batch.id);
    }

    for (const batch of data.expiringSoon) {
      if (wasNotifiedToday(batch.id)) continue;
      const daysLeft = Math.ceil((batch.expiry_date - now) / 86400);
      new Notification('Stock Expiring Soon', {
        body: `${batch.item_name}${batch.batch_number ? ` (${batch.batch_number})` : ''} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${batch.quantity_remaining} ${batch.unit_type} remaining`,
        icon: '/icons/icon-192x192.png',
        tag: `expiry-${batch.id}`,
      });
      markNotified(batch.id);
    }
  }, []);

  const checkExpiring = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const result = await apiGet<ExpiryData>('/api/batches/expiring');
      if (result.success && result.data && result.data.totalCount > 0) {
        showNotifications(result.data);
      }
    } catch {}
  }, [showNotifications]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    cleanupOldKeys();

    // Initial check after a short delay to let the page settle
    const initialTimeout = setTimeout(() => {
      checkExpiring();
    }, 5000);

    intervalRef.current = setInterval(checkExpiring, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, checkExpiring]);

  return { permission, requestPermission };
}
