import { apiGet, apiDelete } from "@/lib/utils/api-client";

export interface PendingSaleItem {
  id: string;
  sale_id: string;
  item_id: string;
  name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
  inventory_batch_id: string | null;
  batch_number: string | null;
}

export type PendingSaleSource = "cashier" | "department";

export interface PendingSale {
  id: string;
  user_id: string;
  user_name?: string;
  user_role?: string | null;
  status: "pending" | "discarded" | "completed";
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: number;
  updated_at: number;
  discarded_by_name?: string | null;
  originated_by_user_id?: string | null;
  originated_by_name?: string | null;
  items: PendingSaleItem[];
}

/** Pending sale created by department staff (forwarded order or dept draft). */
export function isDepartmentOrder(sale: PendingSale): boolean {
  return (
    sale.user_role === "department_staff" || Boolean(sale.originated_by_user_id)
  );
}

export function getPendingSaleSource(sale: PendingSale): PendingSaleSource {
  return isDepartmentOrder(sale) ? "department" : "cashier";
}

export async function fetchPendingSales(options?: {
  includeDiscarded?: boolean;
  includeCompleted?: boolean;
}): Promise<PendingSale[]> {
  const params = new URLSearchParams();
  if (options?.includeDiscarded) params.set("includeDiscarded", "1");
  if (options?.includeCompleted) params.set("includeCompleted", "1");
  const qs = params.toString();
  const result = await apiGet<PendingSale[]>(
    `/api/sales/pending${qs ? "?" + qs : ""}`,
  );
  if (!result.success || !result.data) {
    throw new Error(result.message || "Failed to load saved sales");
  }
  return result.data;
}

export function formatPendingSaleAge(updatedAt: number): string {
  const seconds = Math.floor(Date.now() / 1000) - updatedAt;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatPendingSaleDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-KE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function isPendingSaleStale(
  updatedAt: number,
  staleMinutes = 60,
): boolean {
  const seconds = Math.floor(Date.now() / 1000) - updatedAt;
  return seconds >= staleMinutes * 60;
}

export async function abandonPendingSale(pendingSaleId: string): Promise<void> {
  const result = await apiDelete(`/api/sales/${pendingSaleId}/pending`);
  if (!result.success) {
    throw new Error(result.message || "Failed to discard pending cart");
  }
}
