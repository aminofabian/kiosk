import type { CartItem } from "./cart-store";
import type { PendingSale } from "@/lib/pos/pending-sales";
import { isDepartmentOrder } from "@/lib/pos/pending-sales";

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

export interface OrderLoadedResult {
  ok: boolean;
  blocked?: boolean;
  message?: string;
}

export async function notifyOrderLoaded(
  pendingSaleId: string,
): Promise<OrderLoadedResult> {
  try {
    const response = await fetch("/api/department/loaded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingSaleId }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };
    if (response.status === 409) {
      return {
        ok: false,
        blocked: true,
        message: data.message || "This order is already open with another cashier.",
      };
    }
    return {
      ok: response.ok && data.success !== false,
      message: data.message,
    };
  } catch {
    return { ok: false, message: "Network error" };
  }
}

export async function claimDepartmentOrderLoad(
  pending: PendingSale,
  currentUserId?: string,
): Promise<{ allowed: boolean; message?: string }> {
  const isDeptForward =
    pending.source === "department_forward" || isDepartmentOrder(pending);
  if (!isDeptForward) return { allowed: true };

  if (
    pending.loaded_by_user_id &&
    currentUserId &&
    pending.loaded_by_user_id !== currentUserId
  ) {
    const who = pending.loaded_by_name ?? "another cashier";
    return { allowed: false, message: `This order is already open with ${who}.` };
  }

  const result = await notifyOrderLoaded(pending.id);
  if (result.blocked) {
    return { allowed: false, message: result.message };
  }
  return { allowed: true };
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
