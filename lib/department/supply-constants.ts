import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileText,
  Package,
  Truck,
  CheckCircle2,
  Send,
} from "lucide-react";

export const DEPT_LABELS: Record<string, string> = {
  grocery: "Grocery",
  retail: "Retail",
  bakery: "Bakery",
  butcher: "Butcher",
  dairy: "Dairy",
  produce: "Produce",
  beverages: "Beverages",
  household: "Household",
  electronics: "Electronics",
  pharmacy: "Pharmacy",
};

export function deptLabel(key: string): string {
  return DEPT_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

/** Title-case supplier names for consistent listing display */
export function formatSupplierName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function supplierInitial(name: string): string {
  const formatted = formatSupplierName(name);
  return formatted.charAt(0).toUpperCase() || "?";
}

/** Stable hue for avatar chips from supplier name */
export function supplierAccentHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export const APPROVAL_STATUS: Record<
  string,
  { label: string; classes: string; dot: string }
> = {
  draft: {
    label: "Draft",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  pending_approval: {
    label: "Pending approval",
    classes:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    classes: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  rejected: {
    label: "Rejected",
    classes: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export const FULFILLMENT_STATUS: Record<string, { label: string; classes: string }> =
  {
    pending: {
      label: "Awaiting delivery",
      classes: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    },
    partial: {
      label: "Partially received",
      classes: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    },
    complete: {
      label: "Fully received",
      classes:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    },
  };

export type StaffFilter =
  | "all"
  | "needs_action"
  | "waiting"
  | "in_progress"
  | "done";

export const STAFF_FILTERS: { key: StaffFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "waiting", label: "With admin" },
  { key: "in_progress", label: "To receive" },
  { key: "done", label: "Complete" },
];

export function matchesStaffFilter(
  approval: string,
  fulfillment: string,
  filter: StaffFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "needs_action")
    return approval === "draft" || approval === "rejected";
  if (filter === "waiting") return approval === "pending_approval";
  if (filter === "in_progress")
    return approval === "approved" && fulfillment !== "complete";
  if (filter === "done")
    return approval === "approved" && fulfillment === "complete";
  return true;
}

export const WORKFLOW_STEPS: {
  key: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "draft", label: "Draft", icon: FileText },
  { key: "pending_approval", label: "Submitted", icon: Send },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "delivered", label: "Delivered", icon: Package },
];

export function workflowStepIndex(
  approval: string,
  fulfillment: string,
): number {
  if (approval === "draft" || approval === "rejected") return 0;
  if (approval === "pending_approval") return 1;
  if (approval === "approved" && fulfillment !== "complete") return 2;
  if (approval === "approved" && fulfillment === "complete") return 3;
  return 0;
}

export function formatSupplyPrice(n: number): string {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatSupplyDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative label for product last-updated (cost, stock, or link) */
export function formatProductLastUpdated(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function sortProductsByLatest<T extends { lastUpdatedAt?: number | null }>(
  products: T[],
): T[] {
  return [...products].sort(
    (a, b) => (b.lastUpdatedAt ?? 0) - (a.lastUpdatedAt ?? 0),
  );
}

export type AdminTab = "setup" | "approvals" | "deliveries";

export const ADMIN_TABS: { key: AdminTab; label: string; icon: LucideIcon }[] = [
  { key: "setup", label: "Suppliers", icon: Truck },
  { key: "approvals", label: "Approvals", icon: ClipboardList },
  { key: "deliveries", label: "Deliveries", icon: Package },
];
