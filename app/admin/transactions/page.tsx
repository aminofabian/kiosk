"use client";

import { useState, useEffect, useCallback, Suspense, Fragment, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Loader2,
  AlertTriangle,
  Wallet,
  Smartphone,
  CreditCard,
  DollarSign,
  Undo2,
  Pencil,
  Printer,
  HelpCircle,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { apiPatch } from "@/lib/utils/api-client";
import { toast } from "sonner";
import { TransactionEditDrawer } from "@/components/admin/TransactionEditDrawer";

const PAYMENT_ICONS: Record<string, typeof Wallet> = {
  cash: Wallet,
  mpesa: Smartphone,
  credit: CreditCard,
  split: DollarSign,
  unpaid: HelpCircle,
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  mpesa: "M-Pesa",
  credit: "Credit",
  split: "Split",
  unpaid: "—",
};

const STATUS_BADGES: Record<string, { label: string; classes: string }> = {
  pending: {
    label: "Pending",
    classes:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  discarded: {
    label: "Discarded",
    classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const formatted = d.toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return isToday ? `Today · ${formatted}` : formatted;
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface SaleItem {
  item_name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
}

interface Sale {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  sale_date: number | null;
  created_at: number;
  user_name: string | null;
  items: SaleItem[];
}

interface TransactionsData {
  date: string;
  sales: Sale[];
  totalAmount: number;
  totalCount: number;
  completedCount: number;
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const canVoid = user?.role === "admin" || user?.role === "owner";
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const todayStr = toDateStr(new Date());
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toDateStr(d);
  })();
  const dayBeforeStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return toDateStr(d);
  })();

  const [date, setDate] = useState(() => {
    const d = searchParams.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return todayStr;
  });

  type FilterPreset = "today" | "yesterday" | "dayBefore" | "custom";
  const [filterMode, setFilterMode] = useState<FilterPreset>(() => {
    const d = searchParams.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      if (d === todayStr) return "today";
      if (d === yesterdayStr) return "yesterday";
      if (d === dayBeforeStr) return "dayBefore";
      return "custom";
    }
    return "today";
  });

  useEffect(() => {
    const d = searchParams.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== date) {
      setDate(d);
      if (d === todayStr) setFilterMode("today");
      else if (d === yesterdayStr) setFilterMode("yesterday");
      else if (d === dayBeforeStr) setFilterMode("dayBefore");
      else setFilterMode("custom");
    }
  }, [searchParams]);

  const [data, setData] = useState<TransactionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sales/by-date?date=${date}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || "Failed to load");
      }
    } catch {
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [date]);

  const handleVoid = useCallback(
    (sale: Sale) => {
      if (!canVoid || sale.status === "voided") return;
      toast(
        `Void this transaction of ${formatPrice(sale.total_amount)}? Stock will be restored and the sale will be marked as voided.`,
        {
          action: {
            label: "Void",
            onClick: async () => {
              setVoidingSaleId(sale.id);
              try {
                const result = await apiPatch<{ saleId: string }>(
                  `/api/sales/${sale.id}`,
                  { action: "void", reason: "Admin void" },
                );
                if (result.success) {
                  await fetchData();
                  toast.success("Transaction voided");
                } else {
                  toast.error(result.message || "Failed to void transaction");
                }
              } catch (err) {
                console.error("Error voiding sale:", err);
                toast.error("An error occurred while voiding the transaction.");
              } finally {
                setVoidingSaleId(null);
              }
            },
          },
          cancel: { label: "Cancel", onClick: () => {} },
        },
      );
    },
    [canVoid, fetchData],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("date", date);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [date]);

  const goPrevDay = () => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const newDate = toDateStr(d);
    setDate(newDate);
    setExpandedId(null);
    if (newDate === todayStr) setFilterMode("today");
    else if (newDate === yesterdayStr) setFilterMode("yesterday");
    else if (newDate === dayBeforeStr) setFilterMode("dayBefore");
    else setFilterMode("custom");
  };

  const goNextDay = () => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const newDate = toDateStr(d);
    setDate(newDate);
    setExpandedId(null);
    if (newDate === todayStr) setFilterMode("today");
    else if (newDate === yesterdayStr) setFilterMode("yesterday");
    else if (newDate === dayBeforeStr) setFilterMode("dayBefore");
    else setFilterMode("custom");
  };

  const isToday = date === todayStr;
  const maxDate = todayStr;

  const setFilter = (preset: FilterPreset) => {
    setFilterMode(preset);
    setExpandedId(null);
    if (preset === "today") setDate(todayStr);
    else if (preset === "yesterday") setDate(yesterdayStr);
    else if (preset === "dayBefore") setDate(dayBeforeStr);
    // custom: date picker handles changes
  };

  const sales = useMemo(() => {
    if (!data?.sales) return [];
    return [...data.sales].sort(
      (a, b) =>
        (b.sale_date ?? b.created_at) - (a.sale_date ?? a.created_at) ||
        b.created_at - a.created_at,
    );
  }, [data?.sales]);

  const voidedCount = useMemo(
    () => sales.filter((s) => s.status === "voided").length,
    [sales],
  );

  const renderTransactionsTable = () => {
    if (sales.length === 0) {
      return (
        <div className="py-14 px-6 text-center">
          <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-medium text-slate-900 dark:text-white">
            No transactions
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Nothing recorded for {formatDateLabel(date)}. Try another date.
          </p>
        </div>
      );
    }

    const colCount = 6 + (isAdmin ? 1 : 0) + 1;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
              <th className="w-8 px-1 py-3" />
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Time
              </th>
              {isAdmin && (
                <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Cashier
                </th>
              )}
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Payment
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Items
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Contents
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const expanded = expandedId === sale.id;
              const PaymentIcon = PAYMENT_ICONS[sale.payment_method] || Wallet;
              const isVoided = sale.status === "voided";
              const isPending = sale.status === "pending";
              const isDiscarded = sale.status === "discarded";
              const isComplete = sale.status === "completed";
              const isNonFinal = isPending || isDiscarded;
              const statusBadge = STATUS_BADGES[sale.status];
              const saleTs = sale.sale_date ?? sale.created_at;

              return (
                <Fragment key={sale.id}>
                  <tr
                    className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors ${
                      isVoided
                        ? "bg-red-50/30 dark:bg-red-950/10"
                        : isPending
                          ? "bg-amber-50/30 dark:bg-amber-950/10"
                          : isDiscarded
                            ? "bg-slate-50/50 dark:bg-slate-800/20 opacity-70"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                    }`}
                  >
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
                      <p className="font-medium text-slate-900 dark:text-white text-xs tabular-nums">
                        {formatTime(saleTs)}
                      </p>
                      {statusBadge && !isComplete && (
                        <span
                          className={`inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusBadge.classes}`}
                        >
                          {statusBadge.label}
                        </span>
                      )}
                      {isVoided && (
                        <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                          Voided
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3 align-middle">
                        <p className="text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                          {sale.user_name || "—"}
                        </p>
                      </td>
                    )}
                    <td className="px-3 py-3 align-middle">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <PaymentIcon className="w-3.5 h-3.5 shrink-0" />
                        {PAYMENT_LABELS[sale.payment_method] ||
                          sale.payment_method}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                      <span
                        className={`font-bold tabular-nums ${
                          isVoided
                            ? "text-red-600 dark:text-red-400 line-through"
                            : "text-[#1c6a1e]"
                        }`}
                      >
                        {formatPrice(sale.total_amount)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-center tabular-nums text-slate-600 dark:text-slate-400">
                      {sale.items.length}
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[200px]">
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {sale.items
                          .map(
                            (i) =>
                              `${i.item_name} ×${i.quantity_sold % 1 === 0 ? i.quantity_sold : i.quantity_sold.toFixed(1)}`,
                          )
                          .join(", ")}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-30"
                          onClick={() => {
                            window.open(
                              `/pos/receipt/${sale.id}?print=true`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                          disabled={isNonFinal}
                          title={
                            isNonFinal
                              ? "Cannot print receipt for pending/discarded orders"
                              : "Reprint receipt"
                          }
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span className="sr-only">Reprint receipt</span>
                        </Button>
                        {canVoid && !isVoided && isComplete && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                              onClick={() => setEditingSaleId(sale.id)}
                              disabled={voidingSaleId === sale.id}
                              title="Edit transaction"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                              onClick={() => handleVoid(sale)}
                              disabled={voidingSaleId === sale.id}
                              title="Void transaction"
                            >
                              {voidingSaleId === sale.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
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
                            {sale.items.map((item, i) => (
                              <tr
                                key={`${sale.id}-${i}`}
                                className="border-t border-slate-200/60 dark:border-slate-700/60"
                              >
                                <td className="py-1.5 pr-2 text-slate-900 dark:text-white">
                                  {item.item_name}
                                </td>
                                <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">
                                  {item.quantity_sold % 1 === 0
                                    ? item.quantity_sold
                                    : item.quantity_sold.toFixed(1)}
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] p-3 sm:p-4 pb-24 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-[#1c6a1e]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Transactions
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {formatDateLabel(date)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={goPrevDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={goNextDay}
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Date filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/80 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilter("today")}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors ${
                filterMode === "today"
                  ? "bg-[#1c6a1e] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setFilter("yesterday")}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors ${
                filterMode === "yesterday"
                  ? "bg-[#1c6a1e] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setFilter("dayBefore")}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors ${
                filterMode === "dayBefore"
                  ? "bg-[#1c6a1e] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              Day before
            </button>
            <button
              type="button"
              onClick={() => setFilter("custom")}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                filterMode === "custom"
                  ? "bg-[#1c6a1e] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Custom
            </button>
          </div>

          {filterMode === "custom" && (
            <div className="flex items-center gap-2 bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  const v = e.target.value;
                  setDate(v);
                  setExpandedId(null);
                  if (v === todayStr) setFilterMode("today");
                  else if (v === yesterdayStr) setFilterMode("yesterday");
                  else if (v === dayBeforeStr) setFilterMode("dayBefore");
                }}
                max={maxDate}
                className="h-8 w-[132px] text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
              />
            </div>
          )}
        </div>

        {/* Summary strip */}
        {!loading && data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#1c6a1e]/20 dark:border-[#1c6a1e]/30 bg-gradient-to-br from-[#1c6a1e]/8 to-transparent bg-white dark:bg-[#1c2e18] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Completed
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {data.completedCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Revenue
              </p>
              <p className="text-2xl font-bold text-[#1c6a1e] mt-0.5">
                {formatPrice(data.totalAmount)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-4 col-span-2 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Total rows
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {data.totalCount}
                {voidedCount > 0 && (
                  <span className="text-sm font-medium text-red-500 ml-2">
                    · {voidedCount} voided
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading transactions…
            </div>
          ) : error ? (
            <div className="py-16 px-6 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button
                onClick={fetchData}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                Try again
              </Button>
            </div>
          ) : (
            renderTransactionsTable()
          )}
        </div>
      </div>

      <TransactionEditDrawer
        saleId={editingSaleId}
        open={editingSaleId !== null}
        onOpenChange={(open) => !open && setEditingSaleId(null)}
        onSuccess={fetchData}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <AdminLayout>
      <Suspense
        fallback={
          <div className="min-h-screen bg-white dark:bg-[#0f1a0d] flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        }
      >
        <TransactionsContent />
      </Suspense>
    </AdminLayout>
  );
}
