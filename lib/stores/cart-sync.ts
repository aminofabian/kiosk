import type { CartItem } from "./cart-store";

interface PendingSyncPayload {
  pendingSaleId?: string;
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
}

interface SyncResult {
  success: boolean;
  pendingSaleId?: string;
  error?: string;
}

export async function syncPendingSaleToApi(
  payload: PendingSyncPayload,
): Promise<SyncResult> {
  try {
    const response = await fetch("/api/sales/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pendingSaleId: payload.pendingSaleId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        items: payload.items.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          inventoryBatchId: item.inventoryBatchId,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      pendingSaleId: data.data.pendingSaleId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function abandonPendingSaleOnApi(
  pendingSaleId: string,
): Promise<boolean> {
  try {
    const response = await fetch(`/api/sales/${pendingSaleId}/pending`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function notifyOrderLoaded(pendingSaleId: string): Promise<void> {
  try {
    await fetch("/api/department/loaded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingSaleId }),
    });
  } catch {
    /* non-critical — department notification only */
  }
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
