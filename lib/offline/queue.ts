'use client';

import { openDB, type IDBPDatabase } from 'idb';
import { generateUUID } from '@/lib/utils/uuid';
import type { CartItem } from '@/lib/stores/cart-store';
import type { PaymentMethod } from '@/lib/constants';

const DB_NAME = 'pos-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

export interface PendingSale {
  id: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
    unitType?: string;
    inventoryBatchId?: string;
  }>;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  customerName?: string;
  customerPhone?: string;
  creditAccountId?: string;
  splitPayments?: Array<{
    method: 'cash' | 'mpesa' | 'credit';
    amount: number;
    customerName?: string;
    customerPhone?: string;
  }>;
  shiftId: string | null;
  totalAmount: number;
  createdAt: number;
  syncStatus?: 'pending' | 'syncing' | 'failed' | 'needs_review';
  syncError?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('syncStatus', 'syncStatus');
        }
      },
    });
  }
  return dbPromise;
}

export async function addPendingSale(sale: Omit<PendingSale, 'id' | 'createdAt'>): Promise<string> {
  const db = await getDB();
  const id = `local-${generateUUID()}`;
  const pending: PendingSale = {
    ...sale,
    id,
    createdAt: Date.now(),
    syncStatus: 'pending',
  };
  await db.put(STORE_NAME, pending);
  return id;
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPendingSaleById(id: string): Promise<PendingSale | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function removePendingSale(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function updatePendingSaleStatus(
  id: string,
  status: PendingSale['syncStatus'],
  error?: string
): Promise<void> {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (existing) {
    await db.put(STORE_NAME, { ...existing, syncStatus: status, syncError: error });
  }
}

export async function getPendingSalesCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}
