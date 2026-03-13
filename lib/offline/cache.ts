'use client';

import { openDB, type IDBPDatabase } from 'idb';
import type { Item } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';
import type { Shift } from '@/lib/db/types';
import type { CreditAccount } from '@/lib/db/types';

const DB_NAME = 'pos-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

export interface CacheEntry<T> {
  data: T;
  lastSyncedAt: number;
}

type CacheKey =
  | 'categories'
  | 'items:all'
  | `items:category:${string}`
  | `items:id:${string}`
  | `items:barcode:${string}`
  | 'shift:current'
  | 'credits'
  | 'lastSyncAt';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function getFromCache<T>(key: CacheKey): Promise<CacheEntry<T> | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, key) as Promise<CacheEntry<T> | undefined>;
}

export async function setCache<T>(key: CacheKey, data: T): Promise<void> {
  const db = await getDB();
  const entry: CacheEntry<T> = {
    data,
    lastSyncedAt: Date.now(),
  };
  await db.put(STORE_NAME, entry, key);
}

export async function getCategories(): Promise<Category[] | undefined> {
  const entry = await getFromCache<Category[]>('categories');
  return entry?.data;
}

export async function setCategories(categories: Category[]): Promise<void> {
  await setCache('categories', categories);
}

export async function getItemsByCategory(categoryId: string): Promise<Item[] | undefined> {
  const entry = await getFromCache<Item[]>(`items:category:${categoryId}` as CacheKey);
  return entry?.data;
}

export async function setItemsByCategory(categoryId: string, items: Item[]): Promise<void> {
  await setCache(`items:category:${categoryId}` as CacheKey, items);
}

export async function getItemById(itemId: string): Promise<Item | undefined> {
  const entry = await getFromCache<Item>(`items:id:${itemId}` as CacheKey);
  return entry?.data;
}

export async function setItem(item: Item): Promise<void> {
  await setCache(`items:id:${item.id}` as CacheKey, item);
}

export async function getItemByBarcode(barcode: string): Promise<Item | undefined> {
  const entry = await getFromCache<Item>(`items:barcode:${barcode}` as CacheKey);
  return entry?.data;
}

export async function setItemByBarcode(barcode: string, item: Item): Promise<void> {
  await setCache(`items:barcode:${barcode}` as CacheKey, item);
}

export async function getAllItems(): Promise<Item[] | undefined> {
  const entry = await getFromCache<Item[]>('items:all');
  return entry?.data;
}

export async function setAllItems(items: Item[]): Promise<void> {
  await setCache('items:all', items);
}

export async function getCurrentShift(): Promise<Shift | null | undefined> {
  const entry = await getFromCache<Shift | null>('shift:current');
  return entry?.data;
}

export async function setCurrentShift(shift: Shift | null): Promise<void> {
  await setCache('shift:current', shift);
}

export async function getCredits(): Promise<CreditAccount[] | undefined> {
  const entry = await getFromCache<CreditAccount[]>('credits');
  return entry?.data;
}

export async function setCredits(credits: CreditAccount[]): Promise<void> {
  await setCache('credits', credits);
}

const LAST_SYNC_KEY: CacheKey = 'lastSyncAt';

export async function getLastSyncAt(): Promise<number | undefined> {
  const entry = await getFromCache<number>(LAST_SYNC_KEY);
  return entry?.data;
}

export async function setLastSyncAt(timestamp: number): Promise<void> {
  await setCache(LAST_SYNC_KEY, timestamp);
}
