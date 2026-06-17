"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck,
  Loader2,
  Scan,
  SearchX,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlusCircle,
  AlertTriangle,
} from "lucide-react";
import { apiGet } from "@/lib/utils/api-client";
import { BarcodeCameraScannerDialog } from "@/components/pos/BarcodeCameraScannerDialog";
import { PosNumericKeypad } from "@/components/pos/PosNumericKeypad";
import { isDiscreteUnitType, type UnitType } from "@/lib/constants";
import { useDepartmentTypes } from "@/lib/hooks/use-department-types";
import { useBarcodeScanner } from "@/lib/hooks/use-barcode-scanner";
import { toast } from "sonner";
import {
  POOL_SOURCE_LABELS,
  type PoolSource,
} from "@/lib/department/cycle-count-constants";

// ── Types ──────────────────────────────────────────────────────

type CountShiftStatus = "open" | "counting" | "morning_complete" | "closed";
type CountItemStatus = "pending" | "counted" | "not_located";
type CountBatchStatus = "pending" | "matched" | "escalated" | "acknowledged";
type Phase = "morning" | "evening";

interface CountShift {
  id: string;
  business_id: string;
  user_id: string;
  department: string;
  status: CountShiftStatus;
  opened_at: number;
  closed_at: number | null;
}

interface CountBatch {
  id: string;
  count_shift_id: string;
  item_id: string;
  morning_count: number | null;
  morning_count_status: CountItemStatus;
  evening_count: number | null;
  evening_count_status: CountItemStatus;
  system_stock_morning: number;
  system_stock_evening: number | null;
  variance_morning: number | null;
  variance_evening: number | null;
  variance_intraday: number | null;
  status: CountBatchStatus;
  selection_source: string | null;
}

interface CountBatchWithItem extends CountBatch {
  item_name: string;
  barcode: string;
  unit_type: string;
  sell_price: number;
}

interface CurrentShiftData {
  shift: CountShift;
  batches: CountBatchWithItem[];
  matchedCount?: number;
  escalatedCount?: number;
}

interface ItemCountEntry {
  count: string;
  status: "counted" | "not_located";
}

// ── Helpers ────────────────────────────────────────────────────

function getPhase(
  shift: CountShift,
  batches: CountBatchWithItem[],
): Phase | null {
  if (shift.status === "closed") return null;
  const morningDone = batches.every(
    (b) => b.morning_count_status !== "pending",
  );
  return morningDone ? "evening" : "morning";
}

function getItemStatus(
  batch: CountBatchWithItem,
  phase: Phase,
): CountItemStatus {
  return phase === "morning"
    ? batch.morning_count_status
    : batch.evening_count_status;
}

function getItemCount(batch: CountBatchWithItem, phase: Phase): number | null {
  return phase === "morning" ? batch.morning_count : batch.evening_count;
}

function getSystemStock(batch: CountBatchWithItem, phase: Phase): number {
  return phase === "morning"
    ? batch.system_stock_morning
    : (batch.system_stock_evening ?? batch.system_stock_morning);
}

function getSelectionLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  if (source in POOL_SOURCE_LABELS) {
    return POOL_SOURCE_LABELS[source as PoolSource];
  }
  return null;
}

// ── Page Component ─────────────────────────────────────────────

export default function DepartmentCountPage() {
  const { assignedTypes } = useDepartmentTypes();

  // ── Core state ──────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<CountShift | null>(null);
  const [batches, setBatches] = useState<CountBatchWithItem[] | null>(null);
  const [openingShift, setOpeningShift] = useState(false);
  const [selectedDepartmentKey, setSelectedDepartmentKey] = useState<string>("");
  const [verifiedBarcodes, setVerifiedBarcodes] = useState<Record<string, boolean>>(
    {},
  );

  // ── Counting state ──────────────────────────────────────

  const [currentIndex, setCurrentIndex] = useState(0);
  const [counts, setCounts] = useState<Record<string, ItemCountEntry>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closingShift, setClosingShift] = useState(false);

  // ── Error state ─────────────────────────────────────────

  const [error, setError] = useState<string | null>(null);

  // ── Fetch current shift ─────────────────────────────────

  const [closedStats, setClosedStats] = useState<{
    matchedCount: number;
    escalatedCount: number;
  } | null>(null);

  const fetchShift = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<CurrentShiftData | null>(
        "/api/count-shifts/current",
      );
      if (res.success && res.data) {
        setShift(res.data.shift);
        setBatches(res.data.batches);
        if (res.data.shift.status === "closed") {
          const matched =
            res.data.matchedCount ??
            res.data.batches.filter((b) => b.status === "matched").length;
          const escalated =
            res.data.escalatedCount ??
            res.data.batches.filter(
              (b) => b.status === "escalated" || b.status === "acknowledged",
            ).length;
          setClosedStats({ matchedCount: matched, escalatedCount: escalated });
        } else {
          setClosedStats(null);
        }
      } else {
        setShift(null);
        setBatches(null);
        setClosedStats(null);
      }
    } catch {
      setError("Failed to load shift data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShift();
  }, [fetchShift]);

  // ── Initialize counts from existing batch data ──────────

  useEffect(() => {
    if (!shift || !batches || shift.status === "closed") return;
    const phase = getPhase(shift, batches);
    if (!phase) return;
    const initial: Record<string, ItemCountEntry> = {};
    for (const batch of batches) {
      const existingStatus = getItemStatus(batch, phase);
      const existingCount = getItemCount(batch, phase);
      if (existingStatus !== "pending") {
        initial[batch.item_id] = {
          count: existingCount !== null ? String(existingCount) : "",
          status: existingStatus,
        };
      }
    }
    setCounts(initial);
    const firstPending = batches.findIndex(
      (b) => getItemStatus(b, phase) === "pending",
    );
    setCurrentIndex(firstPending >= 0 ? firstPending : 0);
    setVerifiedBarcodes({});
  }, [shift, batches]);

  // ── Derived values ──────────────────────────────────────

  const phase: Phase | null =
    shift && batches && shift.status !== "closed"
      ? getPhase(shift, batches)
      : null;
  const phaseLabel = phase === "morning" ? "Morning Count" : "Evening Count";
  const isEvening = phase === "evening";

  const currentBatch: CountBatchWithItem | null = batches
    ? (batches[currentIndex] ?? null)
    : null;
  const currentEntry = currentBatch ? counts[currentBatch.item_id] : undefined;

  const countedItems = batches
    ? batches.filter((b) => {
        const e = counts[b.item_id];
        return e && (e.status === "counted" || e.status === "not_located");
      }).length
    : 0;

  const totalItems = batches?.length ?? 0;

  const allCounted =
    totalItems > 0 &&
    batches !== null &&
    batches.every((b) => {
      const e = counts[b.item_id];
      return e && (e.status === "counted" || e.status === "not_located");
    });

  const eveningCompleteOnServer =
    batches?.every((b) => b.evening_count_status !== "pending") ?? false;

  const needsBarcodeVerify =
    currentBatch?.barcode != null && currentBatch.barcode.trim() !== "";
  const barcodeVerified = currentBatch
    ? !needsBarcodeVerify || verifiedBarcodes[currentBatch.item_id]
    : true;

  // ── Handlers ────────────────────────────────────────────

  const handleOpenShift = async () => {
    setOpeningShift(true);
    setError(null);
    try {
      const departmentKey =
        assignedTypes.length === 1
          ? assignedTypes[0]
          : selectedDepartmentKey || assignedTypes[0];

      if (!departmentKey) {
        setError("Select a department before opening a count shift.");
        return;
      }

      const res = await fetch("/api/count-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentKey }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchShift();
      } else {
        setError(data.message || "Failed to open shift.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setOpeningShift(false);
    }
  };

  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      if (!batches || !currentBatch) return;
      const trimmed = barcode.trim();
      const idx = batches.findIndex(
        (b) => b.barcode && b.barcode.trim() === trimmed,
      );
      if (idx === -1) {
        toast.error("Barcode not in today's count batch");
        return;
      }
      if (batches[idx].item_id !== currentBatch.item_id) {
        toast.error("Wrong item — scan matches a different item in this batch");
        setCurrentIndex(idx);
        return;
      }
      setVerifiedBarcodes((prev) => ({
        ...prev,
        [currentBatch.item_id]: true,
      }));
      toast.success("Barcode verified");
    },
    [batches, currentBatch],
  );

  useBarcodeScanner({
    enabled: Boolean(currentBatch && needsBarcodeVerify && !barcodeVerified),
    onScan: handleBarcodeScan,
  });

  const handleCountChange = (itemId: string, count: string) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: { count, status: "counted" as const },
    }));
  };

  const handleMarkNotFound = (itemId: string) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: { count: "", status: "not_located" as const },
    }));
    // Auto-advance to next item
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleClearCount = (itemId: string) => {
    setCounts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleConfirmItem = useCallback(() => {
    if (!currentBatch) return;

    if (!currentEntry) {
      toast.error("Enter a quantity first");
      return;
    }

    if (
      currentEntry.status === "counted" &&
      currentEntry.count.trim().length === 0
    ) {
      toast.error("Enter a quantity first");
      return;
    }

    if (needsBarcodeVerify && !barcodeVerified) {
      toast.error("Scan the barcode to verify this item first");
      setScannerOpen(true);
      return;
    }

    if (currentIndex < totalItems - 1) {
      setCurrentIndex((i) => i + 1);
      toast.success("Item confirmed — next item");
    } else {
      toast.success("All items entered — tap Submit to save");
    }
  }, [
    currentBatch,
    currentEntry,
    needsBarcodeVerify,
    barcodeVerified,
    currentIndex,
    totalItems,
  ]);

  const handleManualVerify = () => {
    if (!currentBatch) return;
    setVerifiedBarcodes((prev) => ({
      ...prev,
      [currentBatch.item_id]: true,
    }));
    toast.success("Item visually confirmed");
  };

  const handleSubmitCounts = async () => {
    if (!shift || !batches || !phase) return;
    setSubmitting(true);
    setError(null);

    const items = batches
      .filter((b) => {
        const entry = counts[b.item_id];
        return (
          entry &&
          (entry.status === "counted" || entry.status === "not_located")
        );
      })
      .map((b) => {
        const entry = counts[b.item_id];
        const unitType = b.unit_type as UnitType;
        const parsed =
          entry.status === "counted"
            ? isDiscreteUnitType(unitType)
              ? parseInt(entry.count, 10)
              : parseFloat(entry.count)
            : 0;
        return {
          itemId: b.item_id,
          count: entry.status === "counted" && !isNaN(parsed) ? parsed : 0,
          status: entry.status,
        };
      });

    try {
      const res = await fetch(`/api/count-shifts/${shift.id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, phase }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `${phaseLabel} saved — ${items.length} of ${totalItems} items`,
        );
        await fetchShift();
      } else {
        setError(data.message || "Failed to submit counts.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!shift) return;
    setClosingShift(true);
    setError(null);
    try {
      const res = await fetch(`/api/count-shifts/${shift.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchShift();
      } else {
        setError(data.message || "Failed to close shift.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setClosingShift(false);
    }
  };

  const isClosedToday = shift?.status === "closed";
  const summary = isClosedToday ? closedStats : null;

  // ═══════════════════════════════════════════════════════════
  //  Render: Loading
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f6f8f6] dark:bg-[#0f1a0d]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Render: Summary (after close)
  // ═══════════════════════════════════════════════════════════

  if (summary && isClosedToday) {
    return (
      <div className="h-full overflow-y-auto bg-[#f6f8f6] dark:bg-[#0f1a0d]">
        <div className="max-w-lg mx-auto p-4 pt-6">
          <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-[#1c6a1e]/10 flex items-center justify-center">
                <ClipboardCheck className="w-8 h-8 text-[#1c6a1e]" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
              Today&apos;s Count Complete
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              {shift?.department
                ? `${shift.department} — `
                : ""}
              Your count shift for today is finished.
              {summary.escalatedCount > 0
                ? " Some items were escalated for admin review."
                : " All items matched."}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {summary.matchedCount}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                  Matched
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {summary.escalatedCount}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Escalated
                </p>
              </div>
            </div>

            <p className="text-xs text-center text-slate-400 dark:text-slate-500">
              A new count shift will be available tomorrow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Render: No shift
  // ═══════════════════════════════════════════════════════════

  if (!shift || !batches) {
    return (
      <div className="h-full overflow-y-auto bg-[#f6f8f6] dark:bg-[#0f1a0d]">
        <div className="max-w-lg mx-auto p-4 pt-6">
          <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-6">
            {/* Icon */}
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ClipboardCheck className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
              No Open Count Shift
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
              Start a new stock count shift to verify inventory levels across
              your department.
            </p>

            {error && (
              <p
                className="text-sm text-red-600 dark:text-red-400 text-center mb-4"
                role="alert"
              >
                {error}
              </p>
            )}

            {assignedTypes.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                  Department
                </label>
                <select
                  value={selectedDepartmentKey || assignedTypes[0]}
                  onChange={(e) => setSelectedDepartmentKey(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2c17] px-3 text-sm"
                >
                  {assignedTypes.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenShift}
              disabled={openingShift}
              className="w-full h-12 min-h-[48px] rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {openingShift ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening shift…
                </>
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  Open Count Shift
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Render: Counting (morning or evening)
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-[#f6f8f6] dark:bg-[#0f1a0d]">
      {/* Barcode Scanner Dialog */}
      <BarcodeCameraScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleBarcodeScan}
      />

      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {phaseLabel}
            </h1>
            {isEvening && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Morning counts completed — now counting evening stock
              </p>
            )}
          </div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {countedItems}/{totalItems}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1c6a1e] transition-all duration-300"
            style={{
              width: `${totalItems > 0 ? (countedItems / totalItems) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {currentBatch && (
          <div className="bg-white dark:bg-[#1a2c17] rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-5">
            {/* Item name */}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              {currentBatch.item_name}
            </h2>

            {(() => {
              const selectionLabel = getSelectionLabel(
                currentBatch.selection_source,
              );
              return selectionLabel ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                  {selectionLabel}
                </span>
              ) : null;
            })()}

            {/* Barcode */}
            {currentBatch.barcode && (
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-3 font-mono tracking-wide">
                {currentBatch.barcode}
              </p>
            )}

            {/* System stock */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                System
              </span>
              <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                {phase && getSystemStock(currentBatch, phase)}
              </span>
              {isEvening && currentBatch.morning_count !== null && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  morning: {currentBatch.morning_count}
                </span>
              )}
            </div>

            {/* Current count status banner */}
            {currentEntry ? (
              <div className="mb-4">
                {currentEntry.status === "not_located" ? (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-3">
                    <SearchX className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Marked as not found
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClearCount(currentBatch.item_id)}
                      className="ml-auto text-xs text-red-500 underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-4 py-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Counted
                    </span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {currentEntry.count || "0"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClearCount(currentBatch.item_id)}
                      className="text-xs text-slate-400 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {!needsBarcodeVerify && (
              <button
                type="button"
                onClick={() =>
                  setVerifiedBarcodes((prev) => ({
                    ...prev,
                    [currentBatch.item_id]: true,
                  }))
                }
                className="mb-4 w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium"
              >
                Confirm item (no barcode)
              </button>
            )}

            {needsBarcodeVerify && (
              <button
                type="button"
                onClick={() => {
                  if (!barcodeVerified) setScannerOpen(true);
                }}
                disabled={barcodeVerified}
                className={`mb-2 w-full flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-left active:scale-[0.99] transition-transform ${
                  barcodeVerified
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                }`}
              >
                <Scan className="w-4 h-4 shrink-0" />
                {barcodeVerified
                  ? "Barcode verified"
                  : "Tap to scan barcode and verify this item"}
              </button>
            )}
            {needsBarcodeVerify && !barcodeVerified && (
              <button
                type="button"
                onClick={handleManualVerify}
                className="mb-4 w-full text-xs text-slate-500 dark:text-slate-400 underline"
              >
                Can&apos;t scan? I&apos;ve visually confirmed this item
              </button>
            )}

            {/* Numeric keypad */}
            <PosNumericKeypad
              value={
                currentEntry?.status === "counted" ? currentEntry.count : ""
              }
              onChange={(val: string) =>
                handleCountChange(currentBatch.item_id, val)
              }
              allowDecimal={
                !isDiscreteUnitType(currentBatch.unit_type as UnitType)
              }
              className="mb-3"
            />

            <button
              type="button"
              onClick={handleConfirmItem}
              disabled={!currentEntry}
              className="w-full h-12 min-h-[48px] rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-40 mb-4"
            >
              {needsBarcodeVerify && !barcodeVerified
                ? "Scan barcode to confirm"
                : currentIndex < totalItems - 1
                  ? "Confirm & next item"
                  : "Confirm last item"}
            </button>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="flex-1 h-12 min-h-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <Scan className="w-5 h-5" />
                Scan barcode
              </button>
              <button
                type="button"
                onClick={() => handleMarkNotFound(currentBatch.item_id)}
                className={`flex-1 h-12 min-h-[48px] rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${
                  currentEntry?.status === "not_located"
                    ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <SearchX className="w-5 h-5" />
                Not found
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="h-10 w-10 rounded-xl bg-white dark:bg-[#1a2c17] border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center disabled:opacity-30 active:scale-[0.95] transition-transform"
            aria-label="Previous item"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
            Item {currentIndex + 1} of {totalItems}
          </span>

          <button
            type="button"
            onClick={() =>
              setCurrentIndex((i) => Math.min(totalItems - 1, i + 1))
            }
            disabled={currentIndex >= totalItems - 1}
            className="h-10 w-10 rounded-xl bg-white dark:bg-[#1a2c17] border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center disabled:opacity-30 active:scale-[0.95] transition-transform"
            aria-label="Next item"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="shrink-0 px-4 py-3 space-y-2">
        {error && (
          <p
            className="text-sm text-red-600 dark:text-red-400 text-center"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Submit counts */}
        <button
          type="button"
          onClick={handleSubmitCounts}
          disabled={submitting || countedItems === 0}
          className="w-full h-12 min-h-[48px] rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Submit {phaseLabel} ({countedItems}/{totalItems})
            </>
          )}
        </button>

        {/* Close shift — evening only, when all counted and morning was submitted */}
        {isEvening && eveningCompleteOnServer && (
          <button
            type="button"
            onClick={handleCloseShift}
            disabled={closingShift}
            className="w-full h-12 min-h-[48px] rounded-xl bg-amber-500 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {closingShift ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Closing shift…
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                Close Shift &amp; Compare
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
