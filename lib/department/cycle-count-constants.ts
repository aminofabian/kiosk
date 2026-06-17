/** Client-safe labels for count shift item pool sources (no DB imports). */

export type PoolSource =
  | "pinned"
  | "today_sales"
  | "yesterday_sales"
  | "low_stock"
  | "recent_adjustment"
  | "recent_delivery"
  | "backfill";

export const POOL_SOURCE_LABELS: Record<PoolSource, string> = {
  pinned: "Pinned",
  today_sales: "Sold today",
  yesterday_sales: "Sold yesterday",
  low_stock: "Low stock",
  recent_adjustment: "Recent adjustment",
  recent_delivery: "Recent delivery",
  backfill: "Department catalogue",
};
