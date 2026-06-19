"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { apiGet } from "@/lib/utils/api-client";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Loader2,
  Search,
  Pin,
  X,
  ChevronDown,
  ChevronRight,
  Package,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  Layers,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type CountShiftStatus = "open" | "counting" | "morning_complete" | "closed";
type CountBatchStatus = "pending" | "matched" | "escalated" | "acknowledged";

interface CountShift {
  id: string;
  business_id: string;
  user_id: string;
  department: string;
  status: CountShiftStatus;
  opened_at: number;
  closed_at: number | null;
  user_name?: string;
  batch_count?: number;
}

interface CountBatch {
  id: string;
  count_shift_id: string;
  item_id: string;
  morning_count: number | null;
  morning_count_status: string;
  evening_count: number | null;
  evening_count_status: string;
  system_stock_morning: number;
  system_stock_evening: number | null;
  variance_morning: number | null;
  variance_evening: number | null;
  variance_intraday: number | null;
  status: CountBatchStatus;
  escalation_notes: string | null;
  item_name?: string;
  barcode?: string;
  unit_type?: string;
  sell_price?: number;
}

interface CountItemPool {
  id: string;
  business_id: string;
  item_id: string;
  department: string | null;
  pinned: number;
  excluded: number;
  last_selected_at: number | null;
  item_name?: string;
  barcode?: string;
  current_stock?: number;
}

type ShiftFilter = "all" | "open" | "closed";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function varianceClass(v: number | null | undefined): string {
  if (v == null) return "text-slate-400";
  if (v > 0) return "text-red-600 font-semibold";
  if (v < 0) return "text-green-600 font-semibold";
  return "text-slate-500";
}

function variancePrefix(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v > 0) return `+${v}`;
  return `${v}`;
}

function shiftStatusBadge(status: CountShiftStatus, hasEscalations?: boolean) {
  switch (status) {
    case "open":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap">
          Open
        </span>
      );
    case "counting":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
          Opening count
        </span>
      );
    case "morning_complete":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 whitespace-nowrap">
          Closing count
        </span>
      );
    case "closed":
      return hasEscalations ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Closed · escalated
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Closed · matched
        </span>
      );
  }
}

function batchStatusBadge(status: CountBatchStatus) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 whitespace-nowrap">
          Pending
        </span>
      );
    case "matched":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Matched
        </span>
      );
    case "escalated":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Escalated
        </span>
      );
    case "acknowledged":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Acknowledged
        </span>
      );
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StockCountsPage() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"shifts" | "pool">("shifts");

  if (!user || (user.role !== "admin" && user.role !== "owner")) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-[#f6f8f6] dark:bg-[#0f1a0d] flex items-center justify-center">
          <div className="text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#f6f8f6] dark:bg-[#0f1a0d]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-[#0f1a0d]/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-lg shadow-[#1c6a1e]/20">
                <ClipboardCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  Stock Counts
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Oversee count shifts &amp; item pool
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mt-4 -mb-px">
              <button
                onClick={() => setActiveTab("shifts")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                  activeTab === "shifts"
                    ? "border-[#1c6a1e] text-[#1c6a1e] dark:text-[#2a8a30] dark:border-[#2a8a30] bg-[#1c6a1e]/5 dark:bg-[#2a8a30]/10"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Shifts
              </button>
              <button
                onClick={() => setActiveTab("pool")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                  activeTab === "pool"
                    ? "border-[#1c6a1e] text-[#1c6a1e] dark:text-[#2a8a30] dark:border-[#2a8a30] bg-[#1c6a1e]/5 dark:bg-[#2a8a30]/10"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Item Pool
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-6 pb-24 md:pb-6">
          {activeTab === "shifts" ? <ShiftsTab /> : <ItemPoolTab />}
        </div>
      </div>
    </AdminLayout>
  );
}

// ── Tab: Shifts ──────────────────────────────────────────────────────────────

function ShiftsTab() {
  const [shifts, setShifts] = useState<CountShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ShiftFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [batches, setBatches] = useState<CountBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = filter === "all" ? "" : `?status=${filter}`;
      const result = await apiGet<CountShift[]>(`/api/count-shifts${params}`);
      if (result.success && result.data) {
        setShifts(result.data);
      } else {
        setError(result.message || "Failed to load shifts");
      }
    } catch {
      setError("Failed to load count shifts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const loadBatches = useCallback(async (shiftId: string) => {
    try {
      setBatchesLoading(true);
      setBatchesError(null);
      setBatches([]);
      const result = await apiGet<{ shift: CountShift; batches: CountBatch[] }>(
        `/api/count-shifts/${shiftId}`,
      );
      if (result.success && result.data) {
        setBatches(result.data.batches);
      } else {
        setBatchesError(result.message || "Failed to load batch details");
      }
    } catch {
      setBatchesError("Failed to load batch details");
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  const toggleExpand = (shiftId: string) => {
    if (expandedId === shiftId) {
      setExpandedId(null);
      setBatches([]);
    } else {
      setExpandedId(shiftId);
      loadBatches(shiftId);
    }
  };

  const hasEscalatedBatches = (bs: CountBatch[]) =>
    bs.some((b) => b.status === "escalated");

  const handleAcknowledge = async (shiftId: string, batchIds?: string[]) => {
    setAcknowledging(true);
    try {
      const res = await fetch(`/api/count-shifts/${shiftId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchIds ? { batchIds } : {}),
      });
      if (res.ok) {
        const result = await apiGet<{
          shift: CountShift;
          batches: CountBatch[];
        }>(`/api/count-shifts/${shiftId}`);
        if (result.success && result.data) {
          setBatches(result.data.batches);
        }
      }
    } catch {
      // silently fail
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {(["all", "open", "closed"] as ShiftFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setExpandedId(null);
              setBatches([]);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
              filter === f
                ? "bg-[#1c6a1e] text-white shadow-sm"
                : "bg-white dark:bg-[#1a2c17] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
          <p className="text-slate-500 dark:text-slate-400">
            Loading shifts...
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchShifts}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && shifts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <ClipboardCheck className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            No count shifts found
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            {filter !== "all"
              ? `No ${filter} shifts available.`
              : "Stock count shifts will appear here once created."}
          </p>
        </div>
      )}

      {/* Shift list — mobile cards */}
      {!loading && !error && shifts.length > 0 && (
        <div className="md:hidden space-y-2">
          {shifts.map((shift) => {
            const isExpanded = expandedId === shift.id;
            const hasEscalations = isExpanded
              ? hasEscalatedBatches(batches)
              : undefined;

            return (
              <div
                key={shift.id}
                className="bg-white dark:bg-[#1a2c17] rounded-xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(shift.id)}
                  className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-slate-900 dark:text-white capitalize text-sm">
                        {shift.department || "General"}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {shift.user_name || "Unknown"}
                      </span>
                      {shiftStatusBadge(shift.status, hasEscalations)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                      <span>{formatDate(shift.opened_at)}</span>
                      <span>
                        {shift.closed_at
                          ? formatDate(shift.closed_at)
                          : "Open"}
                      </span>
                      {shift.batch_count != null && (
                        <span>{shift.batch_count} items</span>
                      )}
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800">
                    <BatchDetailsBody
                      shift={shift}
                      batches={batches}
                      batchesLoading={batchesLoading}
                      batchesError={batchesError}
                      acknowledging={acknowledging}
                      onAcknowledge={handleAcknowledge}
                      layout="cards"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Shift list — desktop table */}
      {!loading && !error && shifts.length > 0 && (
        <div className="hidden md:block bg-white dark:bg-[#1a2c17] rounded-lg border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                <th className="w-7 py-1.5 px-1" />
                <th className="text-left py-1.5 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                  Department
                </th>
                <th className="text-left py-1.5 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                  Staff
                </th>
                <th className="text-left py-1.5 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="text-left py-1.5 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                  Opened
                </th>
                <th className="text-left py-1.5 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                  Closed
                </th>
                <th className="text-right py-1.5 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                  Items
                </th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => {
                const isExpanded = expandedId === shift.id;
                const hasEscalations = isExpanded
                  ? hasEscalatedBatches(batches)
                  : undefined;

                return (
                  <Fragment key={shift.id}>
                    <tr
                      onClick={() => toggleExpand(shift.id)}
                      className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${
                        isExpanded ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
                      }`}
                    >
                      <td className="py-1 px-1 text-center">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 inline" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 inline" />
                        )}
                      </td>
                      <td className="py-1 px-2 font-medium text-slate-900 dark:text-white capitalize">
                        {shift.department || "General"}
                      </td>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                        {shift.user_name || "Unknown"}
                      </td>
                      <td className="py-1 px-2">
                        {shiftStatusBadge(shift.status, hasEscalations)}
                      </td>
                      <td className="py-1 px-2 text-slate-500 tabular-nums">
                        {formatDate(shift.opened_at)}
                      </td>
                      <td className="py-1 px-2 text-slate-500 tabular-nums">
                        {shift.closed_at ? formatDate(shift.closed_at) : "—"}
                      </td>
                      <td className="py-1 px-2 text-right text-slate-500 tabular-nums">
                        {shift.batch_count ?? "—"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <td colSpan={7} className="p-0 bg-slate-50/30 dark:bg-slate-900/20">
                          <BatchDetailsBody
                            shift={shift}
                            batches={batches}
                            batchesLoading={batchesLoading}
                            batchesError={batchesError}
                            acknowledging={acknowledging}
                            onAcknowledge={handleAcknowledge}
                            layout="table"
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BatchDetailsBody({
  shift,
  batches,
  batchesLoading,
  batchesError,
  acknowledging,
  onAcknowledge,
  layout,
}: {
  shift: CountShift;
  batches: CountBatch[];
  batchesLoading: boolean;
  batchesError: string | null;
  acknowledging: boolean;
  onAcknowledge: (shiftId: string, batchIds?: string[]) => void;
  layout: "cards" | "table";
}) {
  if (batchesLoading) {
    return (
      <div className="flex items-center justify-center py-6 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e]" />
        <span className="text-xs text-slate-500">Loading…</span>
      </div>
    );
  }

  if (batchesError) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-red-600 dark:text-red-400">{batchesError}</p>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-slate-500">No items in this shift.</p>
      </div>
    );
  }

  const showAckAll =
    shift.status === "closed" && batches.some((b) => b.status === "escalated");

  if (layout === "table") {
    return (
      <div>
        {showAckAll && (
          <div className="px-2 py-1.5 flex justify-end border-b border-slate-200/60 dark:border-slate-800/60">
            <button
              type="button"
              onClick={() => onAcknowledge(shift.id)}
              disabled={acknowledging}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 disabled:opacity-50"
            >
              {acknowledging ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCheck className="w-3 h-3" />
              )}
              Acknowledge all
            </button>
          </div>
        )}
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-[#1a2c17]/60">
              <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                Item
              </th>
              <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-14">
                Open
              </th>
              <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-14">
                Close
              </th>
              <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-14">
                Sys
              </th>
              <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-12">
                Δ AM
              </th>
              <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-12">
                Δ PM
              </th>
              <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-12">
                Δ Day
              </th>
              <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-24">
                Status
              </th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <Fragment key={b.id}>
                <tr
                  className={`border-b border-slate-100 dark:border-slate-800/50 ${
                    b.status === "escalated"
                      ? "bg-red-50/50 dark:bg-red-900/10"
                      : b.status === "matched"
                        ? "bg-green-50/30 dark:bg-green-900/10"
                        : ""
                  }`}
                >
                  <td className="py-1 px-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {b.item_name || "Unknown"}
                    </span>
                    {b.barcode && (
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {b.barcode}
                      </span>
                    )}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums">
                    {b.morning_count ?? "—"}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums">
                    {b.evening_count ?? "—"}
                  </td>
                  <td className="py-1 px-2 text-right tabular-nums text-slate-500">
                    {b.system_stock_morning}
                  </td>
                  <td
                    className={`py-1 px-2 text-right tabular-nums ${varianceClass(b.variance_morning)}`}
                  >
                    {variancePrefix(b.variance_morning)}
                  </td>
                  <td
                    className={`py-1 px-2 text-right tabular-nums ${varianceClass(b.variance_evening)}`}
                  >
                    {variancePrefix(b.variance_evening)}
                  </td>
                  <td
                    className={`py-1 px-2 text-right tabular-nums ${varianceClass(b.variance_intraday)}`}
                  >
                    {variancePrefix(b.variance_intraday)}
                  </td>
                  <td className="py-1 px-2">{batchStatusBadge(b.status)}</td>
                  <td className="py-1 px-1 text-right">
                    {b.status === "escalated" && shift.status === "closed" && (
                      <button
                        type="button"
                        onClick={() => onAcknowledge(shift.id, [b.id])}
                        disabled={acknowledging}
                        className="text-[10px] font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                      >
                        Ack
                      </button>
                    )}
                  </td>
                </tr>
                {b.escalation_notes && (
                  <tr
                    className={
                      b.status === "escalated"
                        ? "bg-red-50/30 dark:bg-red-900/5"
                        : ""
                    }
                  >
                    <td
                      colSpan={9}
                      className="py-1 px-2 pb-1.5 text-[10px] leading-snug text-red-600 dark:text-red-400"
                    >
                      {b.escalation_notes}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1.5">
      {showAckAll && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onAcknowledge(shift.id)}
            disabled={acknowledging}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-[10px] font-semibold disabled:opacity-50"
          >
            {acknowledging ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCheck className="w-3 h-3" />
            )}
            Acknowledge all
          </button>
        </div>
      )}
      {batches.map((b) => (
        <div
          key={b.id}
          className={`rounded-lg border px-2.5 py-2 text-xs ${
            b.status === "escalated"
              ? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-900/10"
              : b.status === "matched"
                ? "border-green-200 bg-green-50/30 dark:border-green-900/40 dark:bg-green-900/10"
                : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white">
                {b.item_name || "Unknown Item"}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {[b.barcode, b.unit_type].filter(Boolean).join(" · ")}
              </p>
            </div>
            {batchStatusBadge(b.status)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums">
            <span>
              <span className="text-slate-400">Open </span>
              {b.morning_count ?? "—"}
            </span>
            <span>
              <span className="text-slate-400">Close </span>
              {b.evening_count ?? "—"}
            </span>
            <span>
              <span className="text-slate-400">Sys </span>
              {b.system_stock_morning}
            </span>
            <span className={varianceClass(b.variance_morning)}>
              Δ AM {variancePrefix(b.variance_morning)}
            </span>
            <span className={varianceClass(b.variance_evening)}>
              Δ PM {variancePrefix(b.variance_evening)}
            </span>
          </div>
          {b.escalation_notes && (
            <p className="mt-1.5 text-[10px] leading-snug text-red-600 dark:text-red-400">
              {b.escalation_notes}
            </p>
          )}
          {b.status === "escalated" && shift.status === "closed" && (
            <button
              type="button"
              onClick={() => onAcknowledge(shift.id, [b.id])}
              disabled={acknowledging}
              className="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400"
            >
              Acknowledge
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: Item Pool ───────────────────────────────────────────────────────────

function ItemPoolTab() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CountItemPool[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [poolItems, setPoolItems] = useState<CountItemPool[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [poolError, setPoolError] = useState<string | null>(null);

  // Fetch current pool
  const fetchPool = useCallback(async () => {
    try {
      setPoolLoading(true);
      setPoolError(null);
      const result = await apiGet<CountItemPool[]>("/api/count-pool");
      if (result.success && result.data) {
        setPoolItems(result.data);
      } else {
        setPoolError(result.message || "Failed to load item pool");
      }
    } catch {
      setPoolError("Failed to load item pool");
    } finally {
      setPoolLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Search items
  const doSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const result = await apiGet<CountItemPool[]>(
        `/api/count-pool?search=${encodeURIComponent(q)}`,
      );
      if (result.success && result.data) {
        const existingIds = new Set(poolItems.map((p) => p.item_id));
        setSearchResults(
          result.data.filter((r: CountItemPool) => !existingIds.has(r.item_id)),
        );
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [search, poolItems]);

  // Pin / Exclude / Remove
  const addToPool = async (
    itemId: string,
    pinned: boolean,
    excluded: boolean,
  ) => {
    try {
      const res = await fetch("/api/count-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ itemId, pinned, excluded }],
        }),
      });
      if (res.ok) {
        fetchPool();
        setSearchResults((prev) => prev.filter((r) => r.item_id !== itemId));
      }
    } catch {
      // silently fail
    }
  };

  const removeFromPool = async (poolEntry: CountItemPool) => {
    try {
      const res = await fetch(
        `/api/count-pool?id=${encodeURIComponent(poolEntry.id)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        fetchPool();
      }
    } catch {
      // silently fail
    }
  };

  const pinnedItems = poolItems.filter((p) => p.pinned === 1);
  const excludedItems = poolItems.filter((p) => p.excluded === 1);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Search items to add to pool..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1a2c17] border border-slate-200/60 dark:border-slate-800/60 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]/50 transition-shadow"
        />
        <Button
          size="sm"
          onClick={doSearch}
          disabled={searchLoading || !search.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white text-xs rounded-lg"
        >
          {searchLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            "Search"
          )}
        </Button>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Search Results ({searchResults.length})
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {searchResults.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {item.item_name || "Unknown Item"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.barcode && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {item.barcode}
                      </span>
                    )}
                    {item.current_stock != null && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        Stock: {item.current_stock}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => addToPool(item.item_id, true, false)}
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    title="Pin this item"
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => addToPool(item.item_id, false, true)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Exclude this item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pool items */}
      {poolLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
          <p className="text-slate-500 dark:text-slate-400">
            Loading item pool...
          </p>
        </div>
      )}

      {!poolLoading && poolError && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">{poolError}</p>
          <Button variant="outline" size="sm" onClick={fetchPool}>
            Retry
          </Button>
        </div>
      )}

      {!poolLoading && !poolError && poolItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            Item pool is empty
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Search above to add items to the count pool.
          </p>
        </div>
      )}

      {!poolLoading && !poolError && poolItems.length > 0 && (
        <div className="space-y-6">
          {/* Pinned items */}
          {pinnedItems.length > 0 && (
            <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-green-50/50 dark:bg-green-900/20">
                <div className="flex items-center gap-2">
                  <Pin className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">
                    Pinned ({pinnedItems.length})
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pinnedItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.item_name || "Unknown Item"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.barcode && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {item.barcode}
                          </span>
                        )}
                        {item.current_stock != null && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Stock: {item.current_stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromPool(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from pool"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Excluded items */}
          {excludedItems.length > 0 && (
            <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/20">
                <div className="flex items-center gap-2">
                  <X className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                    Excluded ({excludedItems.length})
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {excludedItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.item_name || "Unknown Item"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.barcode && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {item.barcode}
                          </span>
                        )}
                        {item.current_stock != null && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Stock: {item.current_stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromPool(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Remove from pool"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other items (neither pinned nor excluded) */}
          {poolItems.filter((p) => p.pinned === 0 && p.excluded === 0).length >
            0 && (
            <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Other Pool Items (
                    {
                      poolItems.filter(
                        (p) => p.pinned === 0 && p.excluded === 0,
                      ).length
                    }
                    )
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {poolItems
                  .filter((p) => p.pinned === 0 && p.excluded === 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {item.item_name || "Unknown Item"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.barcode && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {item.barcode}
                            </span>
                          )}
                          {item.current_stock != null && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              Stock: {item.current_stock}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => addToPool(item.item_id, true, false)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          title="Pin this item"
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => addToPool(item.item_id, false, true)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Exclude this item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFromPool(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Remove from pool"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
