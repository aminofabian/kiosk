"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Inbox,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import {
  fetchPendingSales,
  formatPendingSaleAge,
  formatPendingSaleDateTime,
  type PendingSale,
} from "@/lib/pos/pending-sales";

const formatPrice = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const REFRESH_MS = 30_000;

type FilterKey = "all" | "pending" | "paid" | "cancelled";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "cancelled", label: "Cancelled" },
];

interface StatusStyle {
  label: string;
  classes: string;
  dot: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  pending: {
    label: "Pending",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Paid",
    classes: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    dot: "bg-green-500",
  },
  discarded: {
    label: "Cancelled",
    classes: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    dot: "bg-red-500",
  },
};

function displayStatus(sale: PendingSale): string {
  return sale.status;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export default function DepartmentRequestsPage() {
  const { userId } = useDepartmentApp();

  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const data = await fetchPendingSales({
          includeDiscarded: true,
          includeCompleted: true,
        });
        const mine = data.filter(
          (s) => s.originated_by_user_id === userId || s.user_id === userId,
        );
        setSales(mine);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load requests";
        setError(message);
        if (!silent) setSales([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const filteredSales = useMemo(() => {
    if (filterStatus === "all") return sales;
    return sales.filter((s) => s.status === filterStatus);
  }, [sales, filterStatus]);

  const summary = useMemo(() => {
    const pending = sales.filter((s) => s.status === "pending");
    const paid = sales.filter((s) => s.status === "completed");
    const cancelled = sales.filter((s) => s.status === "discarded");
    return {
      total: sales.length,
      pendingCount: pending.length,
      paidCount: paid.length,
      cancelledCount: cancelled.length,
    };
  }, [sales]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f8f6] dark:bg-[#132210] text-[#101b0d] dark:text-[#f0fdf4]">
      <header className="shrink-0 safe-area-top bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center justify-between px-4 h-12 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-5 h-5 text-[#1c6a1e] shrink-0" />
            <h1 className="text-[17px] font-bold text-slate-900 dark:text-white truncate">
              My Orders
            </h1>
          </div>
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-4 max-w-3xl mx-auto w-full space-y-4">
        {!loading && sales.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total", value: summary.total, color: "text-slate-900 dark:text-white" },
              { label: "Pending", value: summary.pendingCount, color: "text-amber-600" },
              { label: "Paid", value: summary.paidCount, color: "text-green-600" },
              { label: "Cancelled", value: summary.cancelledCount, color: "text-red-500" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-3 shadow-sm"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const active = filterStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#1c6a1e] text-white shadow-sm"
                    : "bg-white dark:bg-[#1c2e18] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading orders...</p>
            </div>
          ) : error ? (
            <div className="py-16 px-6 text-center">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              <button
                onClick={() => void load()}
                className="mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-[#1c6a1e] text-white"
              >
                Try again
              </button>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <Inbox className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-600 mb-3" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {filterStatus === "all" ? "No orders yet" : `No ${filterStatus} orders`}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Orders you create and forward will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSales.map((sale) => {
                const expanded = expandedId === sale.id;
                const status = displayStatus(sale);
                const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
                const stale =
                  sale.status === "pending" &&
                  Math.floor(Date.now() / 1000) - sale.updated_at >= 3600;

                return (
                  <div
                    key={sale.id}
                    className={sale.status === "discarded" ? "opacity-70" : ""}
                  >
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : sale.id)}
                        className="mt-1 p-0.5 text-slate-400 hover:text-slate-600"
                        aria-label={expanded ? "Collapse" : "Expand"}
                      >
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono">
                            #{shortId(sale.id)}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style.classes}`}
                          >
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${style.dot}`}
                            />
                            {style.label}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatPrice(sale.total_amount)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                          </span>
                          {stale && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                              Idle {formatPendingSaleAge(sale.updated_at)}
                            </span>
                          )}
                        </div>

                        {sale.originated_by_name && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                            <User className="w-3 h-3" />
                            {sale.originated_by_name}
                          </p>
                        )}

                        {sale.customer_name && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            Customer: {sale.customer_name}
                          </p>
                        )}

                        <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wide">
                          {sale.status === "completed"
                            ? "Paid "
                            : formatPendingSaleDateTime(
                                sale.status === "discarded"
                                  ? sale.updated_at
                                  : sale.created_at,
                              )}
                        </p>

                        {!expanded && (
                          <p className="mt-1.5 text-xs text-slate-400 line-clamp-1">
                            {sale.items
                              .map((i) => `${i.name} ×${i.quantity_sold}`)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 sm:pl-12">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                              <th className="pb-2 font-semibold">Item</th>
                              <th className="pb-2 font-semibold text-right">Qty</th>
                              <th className="pb-2 font-semibold text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((item) => (
                              <tr
                                key={item.id}
                                className="border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                              >
                                <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">
                                  {item.name}
                                </td>
                                <td className="py-2 text-right text-slate-500">
                                  {item.quantity_sold}
                                </td>
                                <td className="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
                                  {formatPrice(
                                    item.quantity_sold * item.sell_price_per_unit,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center pb-2">
          Auto-refreshes every 30 seconds
        </p>
      </main>
    </div>
  );
}
