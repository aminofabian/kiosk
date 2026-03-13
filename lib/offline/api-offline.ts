'use client';

import {
  getCategories,
  getItemsByCategory,
  getItemById,
  getItemByBarcode,
  getCurrentShift,
  getCredits,
} from './cache';
import {
  syncCategoriesToCache,
  syncItemsByCategoryToCache,
  syncItemToCache,
  syncShiftToCache,
  syncCreditsToCache,
} from './sync';
import type { ApiResponse } from '@/lib/utils/api-client';

const AUTH_ERROR_MESSAGES = [
  'Unauthorized',
  'Business is suspended or not found',
  'Super admin access required',
] as const;

function isAuthError(status: number, message?: string): boolean {
  if (status === 401) return true;
  if (status === 403 && message) {
    return AUTH_ERROR_MESSAGES.some((msg) => message.includes(msg));
  }
  return false;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const pathname = window.location.pathname;
  const loginUrl = pathname.startsWith('/superadmin')
    ? '/superadmin/login'
    : pathname.startsWith('/pos')
      ? '/pos/login'
      : '/login';
  window.location.href = loginUrl;
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Parse URL to determine cache key for cacheable GET endpoints.
 * Returns null if the URL is not cacheable.
 */
function getCacheKey(url: string): string | null {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://x';
    const parsed = url.startsWith('http') ? new URL(url) : new URL(url, base);
    const path = parsed.pathname;
    const searchParams = parsed.searchParams;

    if (path === '/api/categories' || path.endsWith('/api/categories')) {
      return 'categories';
    }
    if (path === '/api/shifts/current' || path.endsWith('/api/shifts/current')) {
      return 'shift:current';
    }
    if (path === '/api/credits' || path.endsWith('/api/credits')) {
      return 'credits';
    }
    if (path.includes('/api/items/barcode/')) {
      const match = path.match(/\/api\/items\/barcode\/(.+)$/);
      return match ? `barcode:${decodeURIComponent(match[1])}` : null;
    }
    if (path.match(/\/api\/items\/[^/]+$/) && !path.includes('/barcode/')) {
      const match = path.match(/\/api\/items\/([^/]+)$/);
      return match ? `item:${match[1]}` : null;
    }
    if (path === '/api/items' || path.endsWith('/api/items')) {
      const categoryId = searchParams?.get('categoryId');
      if (categoryId) return `items:category:${categoryId}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Offline-aware GET that fetches from API when online (and updates cache)
 * or reads from IndexedDB cache when offline.
 */
export async function apiGetOffline<T = unknown>(url: string): Promise<ApiResponse<T>> {
  const cacheKey = getCacheKey(url);

  if (isOnline()) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const result: ApiResponse<T> = await response.json();

      if (isAuthError(response.status, result.message)) {
        redirectToLogin();
        return { success: false, message: 'Redirecting to login...' };
      }

      if (result.success && result.data !== undefined && cacheKey) {
        if (cacheKey === 'categories') {
          await syncCategoriesToCache(result.data as unknown[]);
        } else if (cacheKey.startsWith('items:category:')) {
          const categoryId = cacheKey.replace('items:category:', '');
          await syncItemsByCategoryToCache(categoryId, result.data as unknown[]);
        } else if (cacheKey.startsWith('item:')) {
          await syncItemToCache(result.data as import('@/lib/db/types').Item);
        } else if (cacheKey.startsWith('barcode:')) {
          const item = result.data as import('@/lib/db/types').Item;
          if (item) await syncItemToCache(item);
        } else if (cacheKey === 'shift:current') {
          await syncShiftToCache(result.data as import('@/lib/db/types').Shift | null);
        } else if (cacheKey === 'credits') {
          await syncCreditsToCache(result.data as import('@/lib/db/types').CreditAccount[]);
        }
      }

      return result;
    } catch (err) {
      console.error('API fetch error:', err);
      if (cacheKey) {
        const cached = await getFromCacheByKey<T>(cacheKey);
        if (cached !== undefined) {
          return { success: true, data: cached };
        }
      }
      return { success: false, message: 'Network error. Please check your connection.' };
    }
  }

  if (cacheKey) {
    const cached = await getFromCacheByKey<T>(cacheKey);
    if (cached !== undefined) {
      return { success: true, data: cached };
    }
  }

  return { success: false, message: 'Offline. No cached data available.' };
}

async function getFromCacheByKey<T>(cacheKey: string): Promise<T | undefined> {
  if (cacheKey === 'categories') {
    return (await getCategories()) as T | undefined;
  }
  if (cacheKey === 'shift:current') {
    return (await getCurrentShift()) as T | undefined;
  }
  if (cacheKey === 'credits') {
    return (await getCredits()) as T | undefined;
  }
  if (cacheKey.startsWith('items:category:')) {
    const categoryId = cacheKey.replace('items:category:', '');
    return (await getItemsByCategory(categoryId)) as T | undefined;
  }
  if (cacheKey.startsWith('item:')) {
    const itemId = cacheKey.replace('item:', '');
    return (await getItemById(itemId)) as T | undefined;
  }
  if (cacheKey.startsWith('barcode:')) {
    const barcode = cacheKey.replace('barcode:', '');
    return (await getItemByBarcode(barcode)) as T | undefined;
  }
  return undefined;
}
