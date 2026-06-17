"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Cloud,
  GitMerge,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import { useCartStore } from "@/lib/stores/cart-store";
import { useShallow } from "zustand/react/shallow";
import { abandonPendingSaleOnApi } from "@/lib/stores/cart-sync";
import {
  formatPendingSaleAge,
  getPendingSaleSource,
  isDepartmentOrder,
} from "@/lib/pos/pending-sales";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { usePendingSales } from "@/lib/hooks/use-pending-sales";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

interface PosPendingSalesPanelProps {
  onResume?: () => void;
  compact?: boolean;
  refreshTrigger?: number;
  /** Cashier POS: only department-forwarded orders, not cashier-saved carts */
  departmentOrdersOnly?: boolean;
}

export function PosPendingSalesPanel({
  onResume,
  compact = false,
  refreshTrigger,
  departmentOrdersOnly = false,
}: PosPendingSalesPanelProps) {
  const isOnline = useOnlineStatus();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const { sales, loading, error, orphaned, refresh } = usePendingSales();
  const restorePendingSale = useCartStore((s) => s.restorePendingSale);
  const mergePendingSaleIntoActiveCart = useCartStore(
    (s) => s.mergePendingSaleIntoActiveCart,
  );
  const mergeActiveCartIntoPendingSale = useCartStore(
    (s) => s.mergeActiveCartIntoPendingSale,
  );
  const activeCart = useCartStore(
    useShallow((s) => {
      const id = s.activeCartId || s.carts[0]?.id;
      return s.carts.find((c) => c.id === id);
    }),
  );

  // Refresh on external trigger (e.g. SSE event)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      void refresh();
    }
  }, [refreshTrigger, refresh]);
  const clearCartByPendingSaleId = useCartStore(
    (s) => s.clearCartByPendingSaleId,
  );
  const linkedIds = useCartStore(
    useShallow((s) =>
      s.carts
        .map((c) => c.pendingSaleId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [expanded, setExpanded] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const linkedSet = new Set(linkedIds);

  const departmentSales = sales.filter(isDepartmentOrder);
  const cashierSales = sales.filter((s) => !isDepartmentOrder(s));
  const visibleSales = departmentOrdersOnly ? departmentSales : sales;
  const visibleCashierSales = departmentOrdersOnly ? [] : cashierSales;
  const orphanedDept = orphaned.filter(isDepartmentOrder);
  const orphanedCashier = orphaned.filter((s) => !isDepartmentOrder(s));
  const visibleOrphaned = departmentOrdersOnly ? orphanedDept : orphaned;

  const sourceSummary = (() => {
    if (departmentOrdersOnly) {
      return departmentSales.length > 0
        ? `${departmentSales.length} dept order${departmentSales.length === 1 ? "" : "s"}`
        : "";
    }
    const parts: string[] = [];
    if (departmentSales.length > 0) {
      parts.push(`${departmentSales.length} dept`);
    }
    if (cashierSales.length > 0) {
      parts.push(`${cashierSales.length} saved`);
    }
    return parts.join(" · ");
  })();

  const collapsedSubtitle = (() => {
    if (visibleOrphaned.length > 0) {
      if (departmentOrdersOnly) {
        return `${orphanedDept.length} dept order${orphanedDept.length === 1 ? "" : "s"} to resume`;
      }
      const parts: string[] = [];
      if (orphanedDept.length > 0) parts.push(`${orphanedDept.length} dept`);
      if (orphanedCashier.length > 0) parts.push(`${orphanedCashier.length} saved`);
      return `${parts.join(" · ")} to resume`;
    }
    return sourceSummary;
  })();

  useEffect(() => {
    if (visibleOrphaned.length > 0) {
      setExpanded(true);
    }
  }, [visibleOrphaned.length]);

  if (!isOnline || (visibleSales.length === 0 && !loading && !error)) {
    return null;
  }

  const handleResume = (sale: (typeof sales)[number]) => {
    restorePendingSale(sale);
    onResume?.();
  };

  const handleAddToActiveCart = (sale: (typeof sales)[number]) => {
    mergePendingSaleIntoActiveCart(sale);
    onResume?.();
  };

  const handleMergeActiveIntoSale = (sale: (typeof sales)[number]) => {
    mergeActiveCartIntoPendingSale(sale);
    onResume?.();
  };

  const handleAbandon = async (sale: (typeof sales)[number]) => {
    if (
      !window.confirm(
        `Discard this ${isDepartmentOrder(sale) ? "department order" : "saved cart"} (${sale.items.length} items, KES ${sale.total_amount.toFixed(0)})?`,
      )
    ) {
      return;
    }

    setActionId(sale.id);
    try {
      const ok = await abandonPendingSaleOnApi(sale.id);
      if (!ok) {
        return;
      }
      clearCartByPendingSaleId(sale.id);
      await refresh();
    } finally {
      setActionId(null);
    }
  };

  const renderSaleRow = (sale: (typeof sales)[number]) => {
    const isLinked = linkedSet.has(sale.id);
    const isBusy = actionId === sale.id;
    const source = getPendingSaleSource(sale);
    const isDept = source === "department";
    const staffName =
      sale.originated_by_name || (isDept ? sale.user_name : null);
    const isActiveInvoice = activeCart?.pendingSaleId === sale.id;
    const activeHasItems = (activeCart?.items.length ?? 0) > 0;
    const canAddToActive = !isActiveInvoice;
    const canMergeActiveInto =
      activeHasItems && !isActiveInvoice && activeCart?.pendingSaleId !== sale.id;

    return (
      <div
        key={sale.id}
        className={`rounded-lg border bg-white/80 dark:bg-slate-900/60 ${
          isDept
            ? "border-blue-200/70 dark:border-blue-900/60"
            : "border-amber-200/70 dark:border-amber-900/60"
        } ${compact ? "p-1.5" : "p-2.5"}`}
      >
        <div
          className={`flex items-start justify-between ${compact ? "gap-1" : "gap-2"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide ${
                  isDept
                    ? "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40"
                    : "text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40"
                } ${compact ? "text-[8px] px-1 py-0.5 rounded" : "text-[9px] px-1.5 py-0.5 rounded"}`}
              >
                {isDept ? (
                  <>
                    <ClipboardList
                      className={compact ? "w-2.5 h-2.5" : "w-3 h-3"}
                    />
                    Dept
                  </>
                ) : (
                  <>
                    <Cloud className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
                    Saved
                  </>
                )}
              </span>
              <span
                className={`font-semibold text-slate-900 dark:text-white ${compact ? "text-[11px]" : "text-xs"}`}
              >
                KES {sale.total_amount.toFixed(0)}
              </span>
              <span
                className={`text-slate-500 dark:text-slate-400 ${compact ? "text-[9px]" : "text-[10px]"}`}
              >
                {sale.items.length} · {formatPendingSaleAge(sale.updated_at)}
              </span>
              {isLinked && !compact && (
                <span className="text-[10px] font-medium text-[#1c6a1e] bg-[#1c6a1e]/10 px-1.5 py-0.5 rounded">
                  Open here
                </span>
              )}
            </div>
            {!compact && staffName && isDept && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300">
                <User className="w-3 h-3" />
                From {staffName}
              </p>
            )}
            {!compact && !isDept && isAdmin && sale.user_name && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                <User className="w-3 h-3" />
                {sale.user_name}
              </p>
            )}
            {!compact && sale.customer_name && (
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                Customer: {sale.customer_name}
              </p>
            )}
            {!compact && (
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500 line-clamp-2">
                {sale.items
                  .slice(0, 3)
                  .map((i) => `${i.name} ×${i.quantity_sold}`)
                  .join(", ")}
                {sale.items.length > 3 ? "…" : ""}
              </p>
            )}
          </div>
          <div
            className={`flex shrink-0 ${compact ? "flex-row flex-wrap gap-0.5 justify-end" : "flex-col gap-1"}`}
          >
            {canAddToActive && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30 ${
                  compact ? "h-6 w-6 p-0" : "h-7 px-2 text-[11px]"
                }`}
                disabled={isBusy}
                onClick={() => handleAddToActiveCart(sale)}
                title="Add invoice items to current cart"
              >
                {compact ? (
                  <Plus className="w-3 h-3" />
                ) : (
                  <>
                    <Plus className="w-3 h-3 mr-1" />
                    Add here
                  </>
                )}
              </Button>
            )}
            {canMergeActiveInto && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`border-amber-500/40 text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30 ${
                  compact ? "h-6 w-6 p-0" : "h-7 px-2 text-[11px]"
                }`}
                disabled={isBusy}
                onClick={() => handleMergeActiveIntoSale(sale)}
                title="Merge current cart into this invoice"
              >
                {compact ? (
                  <GitMerge className="w-3 h-3" />
                ) : (
                  <>
                    <GitMerge className="w-3 h-3 mr-1" />
                    Merge cart
                  </>
                )}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`border-[#1c6a1e]/30 text-[#1c6a1e] hover:bg-[#1c6a1e]/10 ${
                compact ? "h-6 w-6 p-0" : "h-7 px-2 text-[11px]"
              }`}
              disabled={isBusy}
              onClick={() => handleResume(sale)}
              title={isLinked ? "Switch to this cart" : "Resume sale"}
            >
              {isBusy ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : compact ? (
                <RotateCcw className="w-3 h-3" />
              ) : (
                <>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {isLinked ? "Switch" : "Resume"}
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 ${
                compact ? "h-6 w-6 p-0" : "h-7 px-2 text-[11px]"
              }`}
              disabled={isBusy}
              onClick={() => void handleAbandon(sale)}
              title="Discard saved sale"
            >
              {compact ? (
                <Trash2 className="w-3 h-3" />
              ) : (
                <>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Discard
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border-b border-amber-200/80 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20">
      <div
        className={`w-full flex items-center gap-1 ${
          compact ? "px-2 py-1.5" : "px-3 py-2.5"
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex-1 flex items-center justify-between gap-2 min-w-0 text-left hover:bg-amber-100/60 dark:hover:bg-amber-950/30 transition-colors rounded ${
            compact ? "-ml-0.5 pl-0.5" : "-ml-1 pl-1"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Cloud
              className={`text-amber-700 dark:text-amber-400 shrink-0 ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`}
            />
            <div className="min-w-0">
              <p
                className={`font-semibold text-amber-900 dark:text-amber-200 ${compact ? "text-[11px]" : "text-xs"}`}
              >
                {departmentOrdersOnly
                  ? "Department orders"
                  : isAdmin
                    ? "Open carts"
                    : "Saved & orders"}
                {visibleSales.length > 0 && (
                  <span className="ml-1 font-normal text-amber-700 dark:text-amber-400">
                    ({visibleSales.length})
                  </span>
                )}
              </p>
              {!expanded && collapsedSubtitle && (
                <p
                  className={`text-amber-700/90 dark:text-amber-400/90 truncate ${compact ? "text-[10px]" : "text-[11px]"}`}
                >
                  {collapsedSubtitle}
                </p>
              )}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          className="p-1 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0"
          aria-label="Refresh saved sales"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {expanded && (
        <div
          className={
            compact
              ? "px-2 pb-2 max-h-36 overflow-y-auto space-y-1.5"
              : "px-3 pb-3 space-y-2"
          }
        >
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {loading && visibleSales.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {departmentOrdersOnly
                ? "Loading department orders…"
                : "Loading saved sales…"}
            </div>
          ) : visibleSales.length === 0 ? (
            <p className="text-xs text-amber-800/80 dark:text-amber-400/80 py-1">
              {departmentOrdersOnly
                ? "No department orders waiting."
                : "No saved sales on the server."}
            </p>
          ) : (
            <>
              {departmentSales.length > 0 && (
                <div className="space-y-1.5">
                  {!compact && visibleCashierSales.length > 0 && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 px-0.5">
                      Department orders ({departmentSales.length})
                    </p>
                  )}
                  {departmentSales.map(renderSaleRow)}
                </div>
              )}
              {visibleCashierSales.length > 0 && (
                <div className="space-y-1.5">
                  {!compact && departmentSales.length > 0 && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 px-0.5 pt-1">
                      Saved carts ({visibleCashierSales.length})
                    </p>
                  )}
                  {visibleCashierSales.map(renderSaleRow)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
