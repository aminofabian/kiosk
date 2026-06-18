"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Cloud,
  Check,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Trash2,
  AlertTriangle,
  Clock,
  Archive,
  Calendar,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { toast } from "sonner";
import {
  abandonPendingSale,
  fetchPendingSales,
  formatPendingSaleAge,
  formatPendingSaleDateTime,
  isDepartmentOrder,
  isPendingSaleStale,
  type PendingSale,
} from "@/lib/pos/pending-sales";
import {
  formatLocalDate,
  getLocalTodayDateString,
  getProfitPresetDateRange,
  localDateStringsToTimestamps,
} from "@/lib/utils/local-date-range";

const formatPrice = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const REFRESH_MS = 30_000;

type CartTab = "open" | "stale" | "discarded";

type DatePreset = "today" | "yesterday" | "last7days" | "all" | "custom";

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7days", label: "Last 7 days" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
];

const TABS: { id: CartTab; label: string; icon: typeof Cloud }[] = [
  { id: "open", label: "Open", icon: ShoppingCart },
  { id: "stale", label: "Idle 1h+", icon: Clock },
  { id: "discarded", label: "Discarded", icon: Archive },
];

function sortByLatest(carts: PendingSale[]): PendingSale[] {
  return [...carts].sort((a, b) => b.updated_at - a.updated_at);
}

function filterCartsByDateRange(
  carts: PendingSale[],
  preset: DatePreset,
  range: { start: string; end: string },
): PendingSale[] {
  if (preset === "all") return carts;
  const { start, end } = localDateStringsToTimestamps(range.start, range.end);
  return carts.filter((s) => s.updated_at >= start && s.updated_at <= end);
}

function formatFilterPeriodLabel(
  preset: DatePreset,
  range: { start: string; end: string },
): string {
  if (preset === "all") return "all time";
  if (preset === "today") return "today";
  if (preset === "yesterday") return "yesterday";
  if (preset === "last7days") return "the last 7 days";
  if (range.start === range.end) {
    const d = new Date(range.start + "T12:00:00");
    return d.toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return `${range.start} – ${range.end}`;
}

export default function PendingCartsPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CartTab>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDiscarding, setBulkDiscarding] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateRange, setDateRange] = useState(() => {
    const today = getLocalTodayDateString();
    return { start: today, end: today };
  });

  useEffect(() => {
    if (datePreset === "all" || datePreset === "custom") return;
    if (datePreset === "last7days") {
      const range = getProfitPresetDateRange("last7days");
      if (range) setDateRange(range);
      return;
    }
    const range = getProfitPresetDateRange(
      datePreset === "today" ? "today" : "yesterday",
    );
    if (range) setDateRange(range);
  }, [datePreset]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await fetchPendingSales({ includeDiscarded: true });
      setSales(data);
      setSelectedIds((prev) => {
        const openIds = new Set(
          data.filter((s) => s.status === "pending").map((s) => s.id),
        );
        const next = new Set<string>();
        for (const id of prev) {
          if (openIds.has(id)) next.add(id);
        }
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load pending carts";
      setError(message);
      if (!silent) setSales([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const filteredSales = useMemo(
    () => filterCartsByDateRange(sales, datePreset, dateRange),
    [sales, datePreset, dateRange],
  );

  const openCarts = useMemo(
    () => filteredSales.filter((s) => s.status === "pending"),
    [filteredSales],
  );
  const discardedCarts = useMemo(
    () => sortByLatest(filteredSales.filter((s) => s.status === "discarded")),
    [filteredSales],
  );
  const staleCarts = useMemo(
    () => openCarts.filter((s) => isPendingSaleStale(s.updated_at)),
    [openCarts],
  );

  const summary = useMemo(() => {
    const totalValue = openCarts.reduce((sum, s) => sum + s.total_amount, 0);
    const cashierIds = new Set(openCarts.map((s) => s.user_id));
    return {
      count: openCarts.length,
      discardedCount: discardedCarts.length,
      totalValue,
      staleCount: staleCarts.length,
      cashierCount: cashierIds.size,
    };
  }, [openCarts, discardedCarts.length, staleCarts.length]);

  const visibleCarts = useMemo(() => {
    switch (activeTab) {
      case "stale":
        return sortByLatest(staleCarts);
      case "discarded":
        return discardedCarts;
      default:
        return sortByLatest(openCarts);
    }
  }, [activeTab, openCarts, staleCarts, discardedCarts]);

  const tabCounts: Record<CartTab, number> = {
    open: summary.count,
    stale: summary.staleCount,
    discarded: summary.discardedCount,
  };

  const selectedOpenCount = useMemo(
    () => openCarts.filter((s) => selectedIds.has(s.id)).length,
    [openCarts, selectedIds],
  );

  const allOpenSelected =
    openCarts.length > 0 && selectedOpenCount === openCarts.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOpen = () => {
    if (allOpenSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(openCarts.map((s) => s.id)));
    }
  };

  const markDiscardedLocally = (ids: string[]) => {
    const idSet = new Set(ids);
    const now = Math.floor(Date.now() / 1000);
    setSales((prev) =>
      prev.map((s) =>
        idSet.has(s.id)
          ? {
              ...s,
              status: "discarded" as const,
              discarded_by_name: user?.name ?? null,
              updated_at: now,
            }
          : s,
      ),
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const handleDiscard = async (sale: PendingSale) => {
    if (
      !window.confirm(
        `Discard this open cart?\n\n${sale.items.length} items · ${formatPrice(sale.total_amount)}${
          isAdmin && sale.user_name ? `\nCashier: ${sale.user_name}` : ""
        }`,
      )
    ) {
      return;
    }

    setDiscardingId(sale.id);
    try {
      await abandonPendingSale(sale.id);
      markDiscardedLocally([sale.id]);
      toast.success("Cart marked as discarded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to discard cart",
      );
    } finally {
      setDiscardingId(null);
    }
  };

  const handleBulkDiscard = async () => {
    const toDiscard = openCarts.filter((s) => selectedIds.has(s.id));
    if (toDiscard.length === 0) return;

    const totalValue = toDiscard.reduce((sum, s) => sum + s.total_amount, 0);
    if (
      !window.confirm(
        `Discard ${toDiscard.length} open cart${toDiscard.length !== 1 ? "s" : ""}?\n\nTotal value: ${formatPrice(totalValue)}`,
      )
    ) {
      return;
    }

    setBulkDiscarding(true);
    try {
      const results = await Promise.allSettled(
        toDiscard.map((s) => abandonPendingSale(s.id)),
      );
      const succeeded = toDiscard.filter(
        (_, i) => results[i].status === "fulfilled",
      );
      const failed = results.length - succeeded.length;

      if (succeeded.length > 0) {
        markDiscardedLocally(succeeded.map((s) => s.id));
      }

      if (failed === 0) {
        toast.success(
          `Discarded ${succeeded.length} cart${succeeded.length !== 1 ? "s" : ""}`,
        );
      } else if (succeeded.length > 0) {
        toast.warning(
          `Discarded ${succeeded.length}; ${failed} failed. Refresh and retry.`,
        );
      } else {
        toast.error("Failed to discard selected carts");
      }
    } finally {
      setBulkDiscarding(false);
    }
  };

  const renderCartTable = () => {
    if (visibleCarts.length === 0) {
      const emptyCopy: Record<CartTab, { title: string; body: string }> = {
        open: {
          title: "No open carts",
          body:
            datePreset !== "all"
              ? `No open carts were updated ${formatFilterPeriodLabel(datePreset, dateRange)}. Try a wider date range or All.`
              : "When cashiers add items on the POS without checking out, carts appear here.",
        },
        stale: {
          title: "No idle carts",
          body:
            datePreset !== "all"
              ? `No idle carts in this period. Try a wider date range or All.`
              : "Carts untouched for over an hour show up here so you can follow up.",
        },
        discarded: {
          title: "No discarded carts",
          body:
            datePreset !== "all"
              ? `No discarded carts in this period. Try a wider date range or All.`
              : "Discarded carts are kept for reference but no longer block the register.",
        },
      };
      const copy = emptyCopy[activeTab];
      return (
        <div className="py-14 px-6 text-center">
          <Cloud className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-medium text-slate-900 dark:text-white">
            {copy.title}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {copy.body}
          </p>
        </div>
      );
    }

    const showSelect = activeTab !== "discarded";
    const showActions = activeTab !== "discarded";
    const colCount = 6 + (isAdmin ? 1 : 0) + (showSelect ? 1 : 0);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
              {showSelect && (
                <th className="w-10 px-3 py-3">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th className="w-8 px-1 py-3" />
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Updated
              </th>
              {isAdmin && (
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Cashier
                </th>
              )}
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Items
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Contents
              </th>
              {showActions ? (
                <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              ) : (
                <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Discarded by
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleCarts.map((sale) => {
              const expanded = expandedId === sale.id;
              const isDiscarded = sale.status === "discarded";
              const stale =
                !isDiscarded && isPendingSaleStale(sale.updated_at);
              const busy = discardingId === sale.id;
              const cashierLabel = isDepartmentOrder(sale)
                ? sale.originated_by_name || sale.user_name || "—"
                : sale.user_name || "—";

              return (
                <Fragment key={sale.id}>
                  <tr
                    className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors ${
                      selectedIds.has(sale.id)
                        ? "bg-[#1c6a1e]/5"
                        : stale
                          ? "bg-amber-50/40 dark:bg-amber-950/10"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                    }`}
                  >
                    {showSelect && (
                      <td className="px-3 py-3 align-middle">
                        {!isDiscarded ? (
                          <button
                            type="button"
                            onClick={() => toggleSelect(sale.id)}
                            disabled={bulkDiscarding}
                            className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors hover:border-[#1c6a1e] disabled:opacity-50 ${
                              selectedIds.has(sale.id)
                                ? "border-[#1c6a1e] bg-[#1c6a1e]/10"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                            aria-label={
                              selectedIds.has(sale.id)
                                ? "Deselect"
                                : "Select"
                            }
                          >
                            {selectedIds.has(sale.id) ? (
                              <Check className="h-2.5 w-2.5 text-[#1c6a1e]" />
                            ) : null}
                          </button>
                        ) : null}
                      </td>
                    )}
                    <td className="px-1 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : sale.id)
                        }
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label={expanded ? "Collapse" : "Expand"}
                      >
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <p className="font-medium text-slate-900 dark:text-white text-xs">
                        {formatPendingSaleDateTime(sale.updated_at)}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isDiscarded ? "Discarded" : "Updated"}{" "}
                        {formatPendingSaleAge(sale.updated_at)}
                      </p>
                      {stale && (
                        <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          Idle
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3 align-middle">
                        <p className="text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                          {cashierLabel}
                        </p>
                        {isDepartmentOrder(sale) && (
                          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            Dept order
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                      <span className="font-bold text-[#1c6a1e] tabular-nums">
                        {formatPrice(sale.total_amount)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-center tabular-nums text-slate-600 dark:text-slate-400">
                      {sale.items.length}
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[200px]">
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {sale.items
                          .map((i) => `${i.name} ×${i.quantity_sold}`)
                          .join(", ")}
                      </p>
                      {(sale.customer_name || sale.customer_phone) && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {sale.customer_name}
                          {sale.customer_phone
                            ? ` · ${sale.customer_phone}`
                            : ""}
                        </p>
                      )}
                    </td>
                    {!isDiscarded && showActions && (
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                          >
                            <Link href="/pos">Resume</Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            disabled={busy || bulkDiscarding}
                            onClick={() => void handleDiscard(sale)}
                            aria-label="Discard cart"
                          >
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    )}
                    {isDiscarded && (
                      <td className="px-3 py-3 align-middle text-right text-[11px] text-slate-500">
                        {sale.discarded_by_name || "—"}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                      <td colSpan={colCount} className="px-4 py-3">
                        <table className="w-full text-xs max-w-2xl">
                          <thead>
                            <tr className="text-slate-500 dark:text-slate-400">
                              <th className="pb-2 text-left font-medium">
                                Item
                              </th>
                              <th className="pb-2 text-right font-medium">
                                Qty
                              </th>
                              <th className="pb-2 text-right font-medium">
                                Price
                              </th>
                              <th className="pb-2 text-right font-medium">
                                Subtotal
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((item) => (
                              <tr
                                key={item.id}
                                className="border-t border-slate-200/60 dark:border-slate-700/60"
                              >
                                <td className="py-1.5 pr-2 text-slate-900 dark:text-white">
                                  {item.name}
                                </td>
                                <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">
                                  {item.quantity_sold}
                                </td>
                                <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">
                                  {formatPrice(item.sell_price_per_unit)}
                                </td>
                                <td className="py-1.5 text-right font-medium text-slate-900 dark:text-white">
                                  {formatPrice(
                                    item.quantity_sold *
                                      item.sell_price_per_unit,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] p-3 sm:p-4 pb-24 md:pb-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Open carts
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                {isAdmin
                  ? "Saved POS carts across your team — resume checkout or discard abandoned sales."
                  : "Your saved POS carts until checkout or discard."}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-[#1c6a1e] hover:bg-[#2a8a30]"
              >
                <Link href="/pos">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Open POS
                </Link>
              </Button>
            </div>
          </div>

          {/* Summary strip */}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-[#1c6a1e]/20 dark:border-[#1c6a1e]/30 bg-gradient-to-br from-[#1c6a1e]/8 to-transparent bg-white dark:bg-[#1c2e18] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Open
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {summary.count}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Open value
                </p>
                <p className="text-2xl font-bold text-[#1c6a1e] mt-0.5">
                  {formatPrice(summary.totalValue)}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Idle 1h+
                </p>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">
                  {summary.staleCount}
                </p>
              </div>
              {isAdmin ? (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Cashiers
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {summary.cashierCount}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Discarded
                  </p>
                  <p className="text-2xl font-bold text-slate-500 mt-0.5">
                    {summary.discardedCount}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Date filters */}
          {!loading && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/80 rounded-xl overflow-x-auto">
                {DATE_PRESETS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDatePreset(id)}
                    className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors ${
                      datePreset === id
                        ? "bg-[#1c6a1e] text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <Input
                    type="date"
                    value={dateRange.start}
                    max={dateRange.end}
                    onChange={(e) =>
                      setDateRange((r) => ({ ...r, start: e.target.value }))
                    }
                    className="h-8 w-[132px] text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <Input
                    type="date"
                    value={dateRange.end}
                    min={dateRange.start}
                    max={formatLocalDate(new Date())}
                    onChange={(e) =>
                      setDateRange((r) => ({ ...r, end: e.target.value }))
                    }
                    className="h-8 w-[132px] text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                  />
                </div>
              )}
              {datePreset !== "all" && (
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto">
                  Updated{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatFilterPeriodLabel(datePreset, dateRange)}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Tabs + list */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 pt-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex gap-1 overflow-x-auto pb-3 sm:pb-0">
                {TABS.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  const count = tabCounts[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActiveTab(id);
                        setExpandedId(null);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        active
                          ? "bg-[#1c6a1e]/10 text-[#1c6a1e] dark:text-[#3cb043]"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          active
                            ? "bg-[#1c6a1e]/15"
                            : id === "stale" && count > 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeTab !== "discarded" && summary.count > 0 && !loading && (
                <div className="flex flex-wrap items-center gap-2 pb-3 sm:pb-3">
                  <button
                    type="button"
                    onClick={toggleSelectAllOpen}
                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#1c6a1e]"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border-2 ${
                        allOpenSelected
                          ? "border-[#1c6a1e] bg-[#1c6a1e]/10"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {allOpenSelected ? (
                        <Check className="h-2.5 w-2.5 text-[#1c6a1e]" />
                      ) : null}
                    </span>
                    Select all open
                  </button>
                  {selectedOpenCount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={bulkDiscarding}
                      onClick={() => void handleBulkDiscard()}
                    >
                      {bulkDiscarding ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="w-3 h-3 mr-1" />
                      )}
                      Discard {selectedOpenCount}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading carts…
              </div>
            ) : error ? (
              <div className="py-16 px-6 text-center">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => void load()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              renderCartTable()
            )}
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Auto-refreshes every 30s
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
