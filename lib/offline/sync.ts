'use client';

import {
  setCategories,
  setItemsByCategory,
  setItem,
  setItemByBarcode,
  setCurrentShift,
  setCredits,
  setLastSyncAt,
} from './cache';
import {
  getPendingSales,
  removePendingSale,
  updatePendingSaleStatus,
} from './queue';
import { apiPost, apiFetch } from '@/lib/utils/api-client';

/**
 * Sync pending offline sales to the server when back online.
 * Call on 'online' event or when app detects connectivity restored.
 */
export async function syncPendingSales(): Promise<{
  synced: number;
  failed: number;
  authError: boolean;
}> {
  const pending = await getPendingSales();
  let synced = 0;
  let failed = 0;
  let authError = false;

  for (const sale of pending) {
    if (sale.syncStatus === 'needs_review') continue;

    try {
      await updatePendingSaleStatus(sale.id, 'syncing');

      const body: Record<string, unknown> = {
        items: sale.items.map(({ itemId, quantity, price, inventoryBatchId }) => ({
          itemId,
          quantity,
          price,
          inventoryBatchId,
        })),
        paymentMethod: sale.paymentMethod,
      };
      if (sale.paymentMethod === 'cash' && sale.cashReceived != null) {
        body.cashReceived = sale.cashReceived;
      }
      if (sale.paymentMethod === 'credit') {
        if (sale.creditAccountId) body.creditAccountId = sale.creditAccountId;
        else {
          body.customerName = sale.customerName;
          body.customerPhone = sale.customerPhone;
        }
      }
      if (sale.paymentMethod === 'split' && sale.splitPayments?.length) {
        body.splitPayments = sale.splitPayments;
      }

      const result = await apiPost<{ saleId: string }>('/api/sales', body);

      if (result.success) {
        await removePendingSale(sale.id);
        synced++;
      } else {
        const isAuth = result.message?.includes('Unauthorized') || result.message?.includes('Redirecting');
        if (isAuth) {
          authError = true;
          break;
        }
        await updatePendingSaleStatus(sale.id, 'needs_review', result.message || 'Sync failed');
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      await updatePendingSaleStatus(sale.id, 'failed', msg);
      failed++;
    }
  }

  return { synced, failed, authError };
}

/**
 * Populate cache with categories when online.
 * Call after successful fetch from /api/categories.
 */
export async function syncCategoriesToCache(categories: unknown[]): Promise<void> {
  await setCategories(categories as import('@/lib/db/types').Category[]);
}

/**
 * Populate cache with items by category when online.
 * Call after successful fetch from /api/items?categoryId=xxx.
 */
export async function syncItemsByCategoryToCache(
  categoryId: string,
  items: unknown[]
): Promise<void> {
  await setItemsByCategory(categoryId, items as import('@/lib/db/types').Item[]);
}

/**
 * Populate cache with a single item when online.
 * Call after successful fetch from /api/items/[id] or /api/items/barcode/[code].
 */
export async function syncItemToCache(item: import('@/lib/db/types').Item): Promise<void> {
  await setItem(item);
  if (item.barcode?.trim()) {
    await setItemByBarcode(item.barcode.trim(), item);
  }
}

/**
 * Populate cache with current shift when online.
 * Call after successful fetch from /api/shifts/current.
 */
export async function syncShiftToCache(
  shift: import('@/lib/db/types').Shift | null
): Promise<void> {
  await setCurrentShift(shift);
}

/**
 * Populate cache with credit accounts when online.
 * Call after successful fetch from /api/credits.
 */
export async function syncCreditsToCache(
  credits: import('@/lib/db/types').CreditAccount[]
): Promise<void> {
  await setCredits(credits);
}

export interface PreloadResult {
  success: boolean;
  categories?: number;
  items?: number;
  error?: string;
}

/**
 * Preload all offline data when online: categories, items (by category), current shift, credits.
 * Creates a full local backup in IndexedDB for offline use.
 */
export async function preloadOfflineData(): Promise<PreloadResult> {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return { success: false, error: 'Offline' };
  }

  try {
    // 1. Fetch all categories
    const catRes = await apiFetch<import('@/lib/db/types').Category[]>('/api/categories');
    if (!catRes.success || !catRes.data) {
      return { success: false, error: catRes.message || 'Failed to load categories' };
    }
    const categories = catRes.data;
    await setCategories(categories);

    // 2. Fetch all sellable items and cache by category
    const itemsRes = await apiFetch<import('@/lib/db/types').Item[]>(
      '/api/items?all=true&sellableOnly=true'
    );
    let itemCount = 0;
    if (itemsRes.success && itemsRes.data) {
      const items = itemsRes.data;
      itemCount = items.length;
      const byCategory = new Map<string, import('@/lib/db/types').Item[]>();
      for (const item of items) {
        const cid = item.category_id;
        if (!byCategory.has(cid)) byCategory.set(cid, []);
        byCategory.get(cid)!.push(item);
      }
      for (const [categoryId, catItems] of byCategory) {
        await setItemsByCategory(categoryId, catItems);
      }
      for (const item of items) {
        await setItem(item);
        if (item.barcode?.trim()) {
          await setItemByBarcode(item.barcode.trim(), item);
        }
      }
    }

    // 3. Fetch current shift
    const shiftRes = await apiFetch<import('@/lib/db/types').Shift | null>('/api/shifts/current');
    if (shiftRes.success && shiftRes.data !== undefined) {
      await setCurrentShift(shiftRes.data);
    }

    // 4. Fetch credit accounts
    const creditsRes = await apiFetch<import('@/lib/db/types').CreditAccount[]>('/api/credits');
    if (creditsRes.success && creditsRes.data) {
      await setCredits(creditsRes.data);
    }

    await setLastSyncAt(Date.now());
    return { success: true, categories: categories.length, items: itemCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('preloadOfflineData error:', err);
    return { success: false, error: msg };
  }
}
