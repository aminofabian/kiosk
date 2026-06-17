import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UnitType } from "@/lib/constants";
import {
  syncPendingSaleToApi,
  abandonPendingSaleOnApi,
  claimDepartmentOrderLoad,
  isOnline,
} from "./cart-sync";
import type { PendingSale, PendingSaleLoadResult } from "@/lib/pos/pending-sales";
import { fetchPendingSales, isDepartmentOrder } from "@/lib/pos/pending-sales";
import { confirmDiscardLinkedPendingSale } from "@/lib/pos/pending-sale-confirm";

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  unitType: UnitType | "bundle";
  // Bundle-specific fields
  isBundle?: boolean;
  bundleQuantity?: number; // Number of items in each bundle
  // Batch selection (when cashier picks specific batch)
  inventoryBatchId?: string;
  batchNumber?: string;
}

export interface Cart {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
  createdAt: number;
  pendingSaleId?: string;
  pendingSaleIsDepartment?: boolean;
  syncStatus: "synced" | "syncing" | "error";
}

// Generate a unique cart key for an item (differentiates bundles, regular, and batch-specific)
const getCartKey = (item: {
  itemId: string;
  isBundle?: boolean;
  inventoryBatchId?: string;
}): string => {
  if (item.isBundle) return `${item.itemId}:bundle`;
  if (item.inventoryBatchId)
    return `${item.itemId}:batch:${item.inventoryBatchId}`;
  return item.itemId;
};

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

const generateCartId = (): string => {
  return `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateCartName = (carts: Cart[]): string => {
  const cartNumbers = carts
    .map((c) => {
      const match = c.name.match(/^Cart (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const maxNumber = cartNumbers.length > 0 ? Math.max(...cartNumbers) : 0;
  return `Cart ${maxNumber + 1}`;
};

function formatSavedSaleTime(updatedAt: number): string {
  const d = new Date(updatedAt * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pendingSaleCartName(pending: PendingSale): string {
  return pending.customer_name
    ? `Saved: ${pending.customer_name}`
    : `Saved ${formatSavedSaleTime(pending.updated_at)}`;
}

function pendingLinkMeta(pending: PendingSale) {
  return {
    pendingSaleId: pending.id,
    pendingSaleIsDepartment: isDepartmentOrder(pending),
  };
}

function pendingItemsToCartItems(pending: PendingSale): CartItem[] {
  return pending.items.map((pi) => ({
    itemId: pi.item_id,
    name: pi.name,
    price: pi.sell_price_per_unit,
    quantity: pi.quantity_sold,
    unitType: "piece",
    inventoryBatchId: pi.inventory_batch_id || undefined,
    batchNumber: pi.batch_number || undefined,
  }));
}

function mergeCartItems(
  existing: CartItem[],
  incoming: CartItem[],
): CartItem[] {
  const result = existing.map((item) => ({ ...item }));
  for (const item of incoming) {
    const idx = result.findIndex(
      (i) =>
        i.itemId === item.itemId &&
        Boolean(i.isBundle) === Boolean(item.isBundle) &&
        (i.inventoryBatchId || null) === (item.inventoryBatchId || null),
    );
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        quantity: result[idx].quantity + item.quantity,
      };
    } else {
      result.push({ ...item });
    }
  }
  return result;
}

function detachPendingFromOtherCarts(
  carts: Cart[],
  pendingSaleId: string,
  keepCartId: string,
): Cart[] {
  return carts.map((c) =>
    c.id !== keepCartId && c.pendingSaleId === pendingSaleId
      ? {
          ...c,
          items: [],
          total: 0,
          pendingSaleId: undefined,
          pendingSaleIsDepartment: undefined,
          syncStatus: "synced" as const,
        }
      : c,
  );
}

const createEmptyCart = (name: string): Cart => ({
  id: generateCartId(),
  name,
  items: [],
  total: 0,
  createdAt: Date.now(),
  syncStatus: "synced",
});

// Helper to get active cart items
const getActiveCartItems = (state: {
  carts: Cart[];
  activeCartId: string | null;
}): CartItem[] => {
  const activeCart = state.carts.find((c) => c.id === state.activeCartId);
  if (!activeCart && state.carts.length > 0) {
    return state.carts[0].items;
  }
  return activeCart?.items || [];
};

// Helper to get active cart total
const getActiveCartTotal = (state: {
  carts: Cart[];
  activeCartId: string | null;
}): number => {
  const activeCart = state.carts.find((c) => c.id === state.activeCartId);
  if (!activeCart && state.carts.length > 0) {
    return state.carts[0].total;
  }
  return activeCart?.total || 0;
};

// In-memory debounce timers per cart to avoid excessive API calls.
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 800;

// Set of cart IDs waiting to sync when the device comes back online.
const offlineSyncQueue = new Set<string>();

function scheduleCartSync(cartId: string, syncFn: () => Promise<void>) {
  const existing = syncTimers.get(cartId);
  if (existing) {
    clearTimeout(existing);
  }

  syncTimers.set(
    cartId,
    setTimeout(() => {
      syncTimers.delete(cartId);
      if (isOnline()) {
        syncFn();
      } else {
        offlineSyncQueue.add(cartId);
      }
    }, SYNC_DEBOUNCE_MS),
  );
}

function markCartForSync(get: () => CartStore, cartId: string) {
  const state = get();
  state.setCartSyncStatus(cartId, "error");
  offlineSyncQueue.add(cartId);
}

interface CartStore {
  // Multi-cart state
  carts: Cart[];
  activeCartId: string | null;

  // Computed getters for backward compatibility
  items: CartItem[];
  total: number;

  // Cart management
  createCart: () => string;
  switchCart: (cartId: string) => void;
  deleteCart: (cartId: string, options?: { confirmed?: boolean }) => void;
  renameCart: (cartId: string, name: string) => void;

  // Item operations (operate on active cart)
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => void;
  updateQuantity: (
    itemId: string,
    quantity: number,
    isBundle?: boolean,
    inventoryBatchId?: string,
  ) => void;
  removeItem: (
    itemId: string,
    isBundle?: boolean,
    inventoryBatchId?: string,
  ) => void;
  clearCart: (options?: { skipAbandon?: boolean; confirmed?: boolean }) => void;

  // Pending sale sync
  syncPendingSale: (cartId: string) => Promise<void>;
  setCartSyncStatus: (cartId: string, status: Cart["syncStatus"]) => void;
  processOfflineSyncQueue: () => void;

  // For checkout completion
  getActiveCartPendingSaleId: () => string | undefined;
  clearActiveCartPendingSaleId: () => void;
  getLinkedPendingSaleIds: () => string[];
  restorePendingSale: (
    pending: PendingSale,
    currentUserId?: string,
  ) => Promise<PendingSaleLoadResult>;
  mergePendingSaleIntoActiveCart: (
    pending: PendingSale,
    currentUserId?: string,
  ) => Promise<PendingSaleLoadResult>;
  mergeActiveCartIntoPendingSale: (
    pending: PendingSale,
    currentUserId?: string,
  ) => Promise<PendingSaleLoadResult>;
  clearCartByPendingSaleId: (pendingSaleId: string) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      carts: [createEmptyCart("Cart 1")],
      activeCartId: null, // Will be set on first access

      // Computed items - returns active cart's items (reactive)
      get items() {
        return getActiveCartItems(get());
      },

      // Computed total - returns active cart's total (reactive)
      get total() {
        return getActiveCartTotal(get());
      },

      createCart: () => {
        const state = get();
        const newCart = createEmptyCart(generateCartName(state.carts));
        set({
          carts: [...state.carts, newCart],
          activeCartId: newCart.id,
        });
        return newCart.id;
      },

      switchCart: (cartId) => {
        const state = get();
        if (state.carts.some((c) => c.id === cartId)) {
          set({ activeCartId: cartId });
        }
      },

      deleteCart: (cartId, options) => {
        const state = get();
        const cart = state.carts.find((c) => c.id === cartId);

        if (cart?.pendingSaleId && !options?.confirmed) {
          const isDept = cart.pendingSaleIsDepartment ?? false;
          if (
            !confirmDiscardLinkedPendingSale(
              isDept,
              "Closing this cart tab",
            )
          ) {
            return;
          }
        }

        if (cart?.pendingSaleId) {
          abandonPendingSaleOnApi(cart.pendingSaleId);
        }

        const remainingCarts = state.carts.filter((c) => c.id !== cartId);

        // Ensure at least one cart exists
        if (remainingCarts.length === 0) {
          const newCart = createEmptyCart("Cart 1");
          set({
            carts: [newCart],
            activeCartId: newCart.id,
          });
          return;
        }

        // If deleting active cart, switch to another
        let newActiveId = state.activeCartId;
        if (state.activeCartId === cartId) {
          newActiveId = remainingCarts[0].id;
        }

        set({
          carts: remainingCarts,
          activeCartId: newActiveId,
        });
      },

      renameCart: (cartId, name) => {
        set((state) => ({
          carts: state.carts.map((c) => (c.id === cartId ? { ...c, name } : c)),
        }));
      },

      addItem: (item, quantity) => {
        set((state) => {
          let activeCartId = state.activeCartId;

          // Ensure we have an active cart
          if (!activeCartId && state.carts.length > 0) {
            activeCartId = state.carts[0].id;
          }

          if (!activeCartId) {
            // Create a new cart if none exists
            const newCart = createEmptyCart("Cart 1");
            activeCartId = newCart.id;
            return {
              carts: [
                {
                  ...newCart,
                  items: [{ ...item, quantity }],
                  total: item.price * quantity,
                  syncStatus: "syncing" as const,
                },
              ],
              activeCartId,
            };
          }

          const updatedCarts = state.carts.map((cart) => {
            if (cart.id !== activeCartId) return cart;

            // Find existing item with same itemId, type (bundle vs regular), and batch
            const existingItemIndex = cart.items.findIndex(
              (i) =>
                i.itemId === item.itemId &&
                Boolean(i.isBundle) === Boolean(item.isBundle) &&
                (i.inventoryBatchId || null) ===
                  (item.inventoryBatchId || null),
            );

            let newItems: CartItem[];
            if (existingItemIndex >= 0) {
              // Update existing item quantity
              newItems = cart.items.map((i, idx) =>
                idx === existingItemIndex
                  ? { ...i, quantity: i.quantity + quantity }
                  : i,
              );
            } else {
              // Add new item
              newItems = [...cart.items, { ...item, quantity }];
            }

            return {
              ...cart,
              items: newItems,
              total: calculateTotal(newItems),
              syncStatus: "syncing" as const,
            };
          });

          return { carts: updatedCarts, activeCartId };
        });

        scheduleCartSync(get().activeCartId || get().carts[0].id, () =>
          get().syncPendingSale(get().activeCartId || get().carts[0].id),
        );
      },

      updateQuantity: (
        itemId,
        quantity,
        isBundle = false,
        inventoryBatchId?: string,
      ) => {
        set((state) => {
          const activeCartId = state.activeCartId || state.carts[0]?.id;
          if (!activeCartId) return state;

          const matchesItem = (i: CartItem) =>
            i.itemId === itemId &&
            Boolean(i.isBundle) === isBundle &&
            (i.inventoryBatchId || null) === (inventoryBatchId || null);

          const updatedCarts = state.carts.map((cart) => {
            if (cart.id !== activeCartId) return cart;

            if (quantity <= 0) {
              const newItems = cart.items.filter((i) => !matchesItem(i));
              return {
                ...cart,
                items: newItems,
                total: calculateTotal(newItems),
                syncStatus: "syncing" as const,
              };
            }

            const newItems = cart.items.map((i) =>
              matchesItem(i) ? { ...i, quantity } : i,
            );

            return {
              ...cart,
              items: newItems,
              total: calculateTotal(newItems),
              syncStatus: "syncing" as const,
            };
          });

          return { carts: updatedCarts };
        });

        scheduleCartSync(get().activeCartId || get().carts[0].id, () =>
          get().syncPendingSale(get().activeCartId || get().carts[0].id),
        );
      },

      removeItem: (itemId, isBundle = false, inventoryBatchId?: string) => {
        set((state) => {
          const activeCartId = state.activeCartId || state.carts[0]?.id;
          if (!activeCartId) return state;

          const matchesItem = (i: CartItem) =>
            i.itemId === itemId &&
            Boolean(i.isBundle) === isBundle &&
            (i.inventoryBatchId || null) === (inventoryBatchId || null);

          const updatedCarts = state.carts.map((cart) => {
            if (cart.id !== activeCartId) return cart;

            const newItems = cart.items.filter((i) => !matchesItem(i));
            return {
              ...cart,
              items: newItems,
              total: calculateTotal(newItems),
              syncStatus: "syncing" as const,
            };
          });

          return { carts: updatedCarts };
        });

        scheduleCartSync(get().activeCartId || get().carts[0].id, () =>
          get().syncPendingSale(get().activeCartId || get().carts[0].id),
        );
      },

      clearCart: (options) => {
        const state = get();
        const activeCartId = state.activeCartId || state.carts[0]?.id;
        if (!activeCartId) return;

        const cart = state.carts.find((c) => c.id === activeCartId);
        if (!options?.skipAbandon && cart?.pendingSaleId) {
          if (!options?.confirmed) {
            const isDept = cart.pendingSaleIsDepartment ?? false;
            if (
              !confirmDiscardLinkedPendingSale(isDept, "Clearing the cart")
            ) {
              return;
            }
          }
          abandonPendingSaleOnApi(cart.pendingSaleId);
        }

        set({
          carts: state.carts.map((cart) => {
            if (cart.id !== activeCartId) return cart;
            return {
              ...cart,
              items: [],
              total: 0,
              pendingSaleId: undefined,
              pendingSaleIsDepartment: undefined,
              syncStatus: "synced" as const,
            };
          }),
        });
      },

      syncPendingSale: async (cartId) => {
        const state = get();
        const cart = state.carts.find((c) => c.id === cartId);
        if (!cart) return;

        // Nothing to sync if cart is empty.
        if (cart.items.length === 0) {
          if (cart.pendingSaleId) {
            await abandonPendingSaleOnApi(cart.pendingSaleId);
            set((state) => ({
              carts: state.carts.map((c) =>
                c.id === cartId
                  ? { ...c, pendingSaleId: undefined, syncStatus: "synced" }
                  : c,
              ),
            }));
          }
          return;
        }

        state.setCartSyncStatus(cartId, "syncing");

        const result = await syncPendingSaleToApi({
          pendingSaleId: cart.pendingSaleId,
          items: cart.items,
        });

        if (result.success) {
          set((state) => ({
            carts: state.carts.map((c) =>
              c.id === cartId
                ? {
                    ...c,
                    pendingSaleId: result.pendingSaleId,
                    syncStatus: "synced",
                  }
                : c,
            ),
          }));
          offlineSyncQueue.delete(cartId);
        } else {
          state.setCartSyncStatus(cartId, "error");
          offlineSyncQueue.add(cartId);
        }
      },

      setCartSyncStatus: (cartId, status) => {
        set((state) => ({
          carts: state.carts.map((c) =>
            c.id === cartId ? { ...c, syncStatus: status } : c,
          ),
        }));
      },

      processOfflineSyncQueue: () => {
        const state = get();
        for (const cartId of offlineSyncQueue) {
          state.syncPendingSale(cartId);
        }
      },

      getActiveCartPendingSaleId: () => {
        const state = get();
        const activeCart =
          state.carts.find((c) => c.id === state.activeCartId) ||
          state.carts[0];
        return activeCart?.pendingSaleId;
      },

      clearActiveCartPendingSaleId: () => {
        set((state) => {
          const activeCartId = state.activeCartId || state.carts[0]?.id;
          if (!activeCartId) return state;
          return {
            carts: state.carts.map((c) =>
              c.id === activeCartId
                ? { ...c, pendingSaleId: undefined, syncStatus: "synced" }
                : c,
            ),
          };
        });
      },

      getLinkedPendingSaleIds: () => {
        return get()
          .carts.map((c) => c.pendingSaleId)
          .filter((id): id is string => Boolean(id));
      },

      restorePendingSale: async (pending, currentUserId) => {
        const state = get();
        const existing = state.carts.find(
          (c) => c.pendingSaleId === pending.id,
        );
        if (existing) {
          set({ activeCartId: existing.id });
          return { cartId: existing.id };
        }

        const claim = await claimDepartmentOrderLoad(pending, currentUserId);
        if (!claim.allowed) {
          return { cartId: null, error: claim.message };
        }

        // Refresh from server before restoring, in case pending sale changed
        fetchPendingSales()
          .then((latest) => {
            const fresh = latest.find((s) => s.id === pending.id);
            if (fresh && fresh.status === "pending") {
              const freshItems = pendingItemsToCartItems(fresh);
              const freshTotal = calculateTotal(freshItems);
              const freshName = pendingSaleCartName(fresh);
              set((state) => {
                const target = state.carts.find(
                  (c) => c.pendingSaleId === pending.id,
                );
                if (!target) return state;
                return {
                  carts: state.carts.map((c) =>
                    c.id === target.id
                      ? {
                          ...c,
                          name: freshName,
                          items: freshItems,
                          total: freshTotal,
                          syncStatus: "synced" as const,
                        }
                      : c,
                  ),
                };
              });
            }
          })
          .catch(() => {
            /* non-critical — use local data if refresh fails */
          });

        const items = pendingItemsToCartItems(pending);
        const total = calculateTotal(items);
        const cartName = pendingSaleCartName(pending);
        const link = pendingLinkMeta(pending);

        const emptyCart = state.carts.find(
          (c) => c.items.length === 0 && !c.pendingSaleId,
        );

        if (emptyCart) {
          set({
            activeCartId: emptyCart.id,
            carts: state.carts.map((c) =>
              c.id === emptyCart.id
                ? {
                    ...c,
                    name: cartName,
                    items,
                    total,
                    ...link,
                    syncStatus: "synced" as const,
                  }
                : c,
            ),
          });
          return { cartId: emptyCart.id };
        }

        const newCart: Cart = {
          ...createEmptyCart(generateCartName(state.carts)),
          name: cartName,
          items,
          total,
          ...link,
          syncStatus: "synced",
        };
        set({
          carts: [...state.carts, newCart],
          activeCartId: newCart.id,
        });
        return { cartId: newCart.id };
      },

      mergePendingSaleIntoActiveCart: async (pending, currentUserId) => {
        const state = get();
        let activeCartId = state.activeCartId || state.carts[0]?.id;
        if (!activeCartId) {
          return get().restorePendingSale(pending, currentUserId);
        }

        const activeCart = state.carts.find((c) => c.id === activeCartId);
        if (!activeCart) {
          return get().restorePendingSale(pending, currentUserId);
        }

        if (activeCart.pendingSaleId === pending.id) {
          return { cartId: activeCartId };
        }

        const claim = await claimDepartmentOrderLoad(pending, currentUserId);
        if (!claim.allowed) {
          return { cartId: null, error: claim.message };
        }

        const invoiceItems = pendingItemsToCartItems(pending);
        const mergedItems = mergeCartItems(activeCart.items, invoiceItems);
        const oldPendingId = activeCart.pendingSaleId;
        const cartName =
          activeCart.items.length === 0
            ? pendingSaleCartName(pending)
            : activeCart.name;

        if (oldPendingId && oldPendingId !== pending.id) {
          const isDept = activeCart.pendingSaleIsDepartment ?? false;
          if (
            !confirmDiscardLinkedPendingSale(
              isDept,
              "Your active cart is linked to another saved sale. Adding this order will replace it",
            )
          ) {
            return { cartId: null };
          }
        }

        const link = pendingLinkMeta(pending);

        set({
          activeCartId,
          carts: detachPendingFromOtherCarts(
            state.carts.map((c) =>
              c.id === activeCartId
                ? {
                    ...c,
                    name: cartName,
                    items: mergedItems,
                    total: calculateTotal(mergedItems),
                    ...link,
                    syncStatus: "syncing" as const,
                  }
                : c,
            ),
            pending.id,
            activeCartId,
          ),
        });

        if (oldPendingId && oldPendingId !== pending.id) {
          abandonPendingSaleOnApi(oldPendingId);
        }

        scheduleCartSync(activeCartId, () =>
          get().syncPendingSale(activeCartId!),
        );
        return { cartId: activeCartId };
      },

      mergeActiveCartIntoPendingSale: async (pending, currentUserId) => {
        const state = get();
        const activeCartId = state.activeCartId || state.carts[0]?.id;
        if (!activeCartId) {
          return get().restorePendingSale(pending, currentUserId);
        }

        const activeCart = state.carts.find((c) => c.id === activeCartId);
        if (!activeCart) {
          return get().restorePendingSale(pending, currentUserId);
        }

        const linkedCart = state.carts.find(
          (c) => c.pendingSaleId === pending.id,
        );
        const invoiceItems = pendingItemsToCartItems(pending);
        const cartName = pendingSaleCartName(pending);
        const link = pendingLinkMeta(pending);

        if (linkedCart) {
          if (linkedCart.id === activeCartId) {
            return { cartId: activeCartId };
          }

          const claim = await claimDepartmentOrderLoad(pending, currentUserId);
          if (!claim.allowed) {
            return { cartId: null, error: claim.message };
          }

          const mergedItems = mergeCartItems(
            linkedCart.items.length > 0 ? linkedCart.items : invoiceItems,
            activeCart.items,
          );
          const activeOldPending = activeCart.pendingSaleId;

          if (activeOldPending && activeOldPending !== pending.id) {
            const isDept = activeCart.pendingSaleIsDepartment ?? false;
            if (
              !confirmDiscardLinkedPendingSale(
                isDept,
                "Merging will discard the saved sale linked to your active cart",
              )
            ) {
              return { cartId: null };
            }
          }

          set({
            activeCartId: linkedCart.id,
            carts: detachPendingFromOtherCarts(
              state.carts.map((c) => {
                if (c.id === linkedCart.id) {
                  return {
                    ...c,
                    name: cartName,
                    items: mergedItems,
                    total: calculateTotal(mergedItems),
                    ...link,
                    syncStatus: "syncing" as const,
                  };
                }
                if (c.id === activeCartId) {
                  return {
                    ...c,
                    items: [],
                    total: 0,
                    pendingSaleId: undefined,
                    pendingSaleIsDepartment: undefined,
                    syncStatus: "synced" as const,
                  };
                }
                return c;
              }),
              pending.id,
              linkedCart.id,
            ),
          });

          if (activeOldPending && activeOldPending !== pending.id) {
            abandonPendingSaleOnApi(activeOldPending);
          }

          scheduleCartSync(linkedCart.id, () =>
            get().syncPendingSale(linkedCart.id),
          );
          return { cartId: linkedCart.id };
        }

        if (activeCart.items.length === 0) {
          return get().restorePendingSale(pending, currentUserId);
        }

        const claim = await claimDepartmentOrderLoad(pending, currentUserId);
        if (!claim.allowed) {
          return { cartId: null, error: claim.message };
        }

        const mergedItems = mergeCartItems(invoiceItems, activeCart.items);
        const oldPendingId = activeCart.pendingSaleId;

        if (oldPendingId && oldPendingId !== pending.id) {
          const isDept = activeCart.pendingSaleIsDepartment ?? false;
          if (
            !confirmDiscardLinkedPendingSale(
              isDept,
              "Your active cart is linked to another saved sale. Merging will replace it",
            )
          ) {
            return { cartId: null };
          }
        }

        set({
          activeCartId,
          carts: state.carts.map((c) =>
            c.id === activeCartId
              ? {
                  ...c,
                  name: cartName,
                  items: mergedItems,
                  total: calculateTotal(mergedItems),
                  ...link,
                  syncStatus: "syncing" as const,
                }
              : c,
          ),
        });

        if (oldPendingId && oldPendingId !== pending.id) {
          abandonPendingSaleOnApi(oldPendingId);
        }

        scheduleCartSync(activeCartId, () =>
          get().syncPendingSale(activeCartId),
        );
        return { cartId: activeCartId };
      },

      clearCartByPendingSaleId: (pendingSaleId) => {
        set((state) => {
          const cart = state.carts.find(
            (c) => c.pendingSaleId === pendingSaleId,
          );
          if (!cart) return state;

          const updatedCarts = state.carts.map((c) =>
            c.id === cart.id
              ? {
                  ...c,
                  items: [],
                  total: 0,
                  pendingSaleId: undefined,
                  pendingSaleIsDepartment: undefined,
                  syncStatus: "synced" as const,
                }
              : c,
          );

          return { carts: updatedCarts };
        });
      },
    }),
    {
      name: "cart-storage",
      // Migration to handle existing single-cart data and add syncStatus/pendingSaleId
      migrate: (persistedState: any, version: number) => {
        if (persistedState && !persistedState.carts) {
          // Migrate from old single-cart format
          const oldItems = persistedState.items || [];
          const oldTotal = persistedState.total || 0;
          const newCart: Cart = {
            id: generateCartId(),
            name: "Cart 1",
            items: oldItems,
            total: oldTotal,
            createdAt: Date.now(),
            syncStatus: "synced",
          };
          return {
            carts: [newCart],
            activeCartId: newCart.id,
          };
        }

        if (persistedState?.carts) {
          persistedState.carts = persistedState.carts.map((c: Cart) => ({
            ...c,
            syncStatus: c.syncStatus || "synced",
          }));
        }

        return persistedState;
      },
      version: 2,
    },
  ),
);

// Set up online/offline listeners in browser environments.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    useCartStore.getState().processOfflineSyncQueue();
  });
}

// Selector hooks for reactive access to computed values
export const useCartItems = () =>
  useCartStore((state) => {
    const activeCart =
      state.carts.find((c) => c.id === state.activeCartId) || state.carts[0];
    return activeCart?.items || [];
  });

export const useCartTotal = () =>
  useCartStore((state) => {
    const activeCart =
      state.carts.find((c) => c.id === state.activeCartId) || state.carts[0];
    return activeCart?.total || 0;
  });

export const useActiveCart = () =>
  useCartStore((state) => {
    return (
      state.carts.find((c) => c.id === state.activeCartId) || state.carts[0]
    );
  });

export const useActiveCartPendingSaleId = () =>
  useCartStore((state) => {
    const activeCart =
      state.carts.find((c) => c.id === state.activeCartId) || state.carts[0];
    return activeCart?.pendingSaleId;
  });

export const useCartSyncStatus = () =>
  useCartStore((state) => {
    const activeCart =
      state.carts.find((c) => c.id === state.activeCartId) || state.carts[0];
    return activeCart?.syncStatus || "synced";
  });
