"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Cloud,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Trash2,
  User,
  AlertTriangle,
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

const formatPrice = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const REFRESH_MS = 30_000;

export default function PendingCartsPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await fetchPendingSales({ includeDiscarded: true });
      setSales(data);
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

  const summary = useMemo(() => {
    const open = sales.filter((s) => s.status === "pending");
    const discarded = sales.filter((s) => s.status === "discarded");
    const totalValue = open.reduce((sum, s) => sum + s.total_amount, 0);
    const staleCount = open.filter((s) =>
      isPendingSaleStale(s.updated_at),
    ).length;
    const cashierIds = new Set(sales.map((s) => s.user_id));
    return {
      count: open.length,
      discardedCount: discarded.length,
      totalValue,
      staleCount,
      cashierCount: cashierIds.size,
    };
  }, [sales]);

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
      setSales((prev) =>
        prev.map((s) =>
          s.id === sale.id
            ? {
                ...s,
                status: "discarded" as const,
                discarded_by_name: user?.name ?? null,
                updated_at: Math.floor(Date.now() / 1000),
              }
            : s,
        ),
      );
      toast.success("Cart marked as discarded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to discard cart",
      );
    } finally {
      setDiscardingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cloud className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {isAdmin ? "Cashier carts" : "My carts"}
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              {isAdmin
                ? "Open and discarded POS carts — including when a cashier closes the browser, reloads, or abandons a sale."
                : "Your saved POS carts, including open and discarded ones."}
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

        {!loading && sales.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open carts
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {summary.count}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Discarded
              </p>
              <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">
                {summary.discardedCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open value
              </p>
              <p className="text-2xl font-bold text-[#1c6a1e]">
                {formatPrice(summary.totalValue)}
              </p>
            </div>
            {isAdmin && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cashiers
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {summary.cashierCount}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Idle 1h+
              </p>
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                {summary.staleCount}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading pending carts…
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
          ) : sales.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <Cloud className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-medium text-slate-900 dark:text-white">
                No cart history yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                When a cashier adds items on the POS, carts appear here until
                checkout or discard.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.map((sale) => {
                const expanded = expandedId === sale.id;
                const isDiscarded = sale.status === "discarded";
                const stale =
                  !isDiscarded && isPendingSaleStale(sale.updated_at);
                const busy = discardingId === sale.id;
                return (
                  <div
                    key={sale.id}
                    className={`bg-white dark:bg-slate-900 ${isDiscarded ? "opacity-75" : ""}`}
                  >
                    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : sale.id)}
                        className="mt-1 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatPrice(sale.total_amount)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {sale.items.length} item
                            {sale.items.length !== 1 ? "s" : ""}
                          </span>
                          {isDiscarded ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded">
                              Discarded
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#1c6a1e] bg-[#1c6a1e]/10 px-1.5 py-0.5 rounded">
                              Open
                            </span>
                          )}
                          {isDepartmentOrder(sale) ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">
                              Dept order
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">
                              Saved cart
                            </span>
                          )}
                          {stale && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3" />
                              Idle {formatPendingSaleAge(sale.updated_at)}
                            </span>
                          )}
                        </div>

                        {isAdmin && sale.user_name && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <User className="w-3.5 h-3.5" />
                            {isDepartmentOrder(sale)
                              ? `From ${sale.originated_by_name || sale.user_name}`
                              : sale.user_name}
                          </p>
                        )}

                        {(sale.customer_name || sale.customer_phone) && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Customer: {sale.customer_name || "—"}
                            {sale.customer_phone
                              ? ` · ${sale.customer_phone}`
                              : ""}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                          Started {formatPendingSaleDateTime(sale.created_at)}
                          {" · "}
                          {isDiscarded ? "Discarded" : "Updated"}{" "}
                          {formatPendingSaleAge(sale.updated_at)}
                          {isDiscarded && sale.discarded_by_name
                            ? ` · by ${sale.discarded_by_name}`
                            : ""}
                        </p>

                        {!expanded && (
                          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {sale.items
                              .map((i) => `${i.name} ×${i.quantity_sold}`)
                              .join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        {!isDiscarded && (
                          <>
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                            >
                              <Link href="/pos">Resume on POS</Link>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                              disabled={busy}
                              onClick={() => void handleDiscard(sale)}
                            >
                              {busy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  Discard
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 sm:px-5 sm:pl-12">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                              <th className="pb-2 font-medium">Item</th>
                              <th className="pb-2 font-medium text-right">
                                Qty
                              </th>
                              <th className="pb-2 font-medium text-right">
                                Price
                              </th>
                              <th className="pb-2 font-medium text-right">
                                Subtotal
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((item) => (
                              <tr
                                key={item.id}
                                className="border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                              >
                                <td className="py-2 pr-2 text-slate-900 dark:text-white">
                                  {item.name}
                                  {item.batch_number && (
                                    <span className="ml-1 text-[10px] text-slate-400">
                                      ({item.batch_number})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                  {item.quantity_sold}
                                </td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400">
                                  {formatPrice(item.sell_price_per_unit)}
                                </td>
                                <td className="py-2 text-right font-medium text-slate-900 dark:text-white">
                                  {formatPrice(
                                    item.quantity_sold *
                                      item.sell_price_per_unit,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="mt-2 text-[10px] text-slate-400 font-mono truncate">
                          ID: {sale.id}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
          Auto-refreshes every 30 seconds · Carts sync when items are added on
          the POS
        </p>
      </div>
    </AdminLayout>
  );
}
