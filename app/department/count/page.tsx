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
  Sun,
  Moon,
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

function isClosingCountInitialized(batches: CountBatchWithItem[]): boolean {
  return batches.some((b) => b.system_stock_evening !== null);
}

function getPhase(
  shift: CountShift,
  batches: CountBatchWithItem[],
): Phase | null {
  if (shift.status === "closed") return null;
  const morningDone = batches.every(
    (b) => b.morning_count_status !== "pending",
  );
  if (!morningDone) return "morning";
  if (!isClosingCountInitialized(batches)) return null;
  return "evening";
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

function getSelectionLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  if (source in POOL_SOURCE_LABELS) {
    return POOL_SOURCE_LABELS[source as PoolSource];
  }
  return null;
}

type ItemDisplayStatus = "Pending" | "Counted" | "Not found";

function getItemDisplayStatus(
  batch: CountBatchWithItem,
  phase: Phase,
  counts: Record<string, ItemCountEntry>,
): ItemDisplayStatus {
  const entry = counts[batch.item_id];
  if (entry?.status === "not_located") return "Not found";
  if (entry?.status === "counted") return "Counted";
  const serverStatus = getItemStatus(batch, phase);
  if (serverStatus === "not_located") return "Not found";
  if (serverStatus === "counted") return "Counted";
  return "Pending";
}

const ITEM_STATUS_STYLES: Record<
  ItemDisplayStatus,
  { chip: string; active: string }
> = {
  Pending: {
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    active:
      "ring-2 ring-slate-400 bg-slate-200 dark:bg-slate-700 dark:text-slate-200",
  },
  Counted: {
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    active:
      "ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  "Not found": {
    chip: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    active:
      "ring-2 ring-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300",
  },
};

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
  const [startingClosingCount, setStartingClosingCount] = useState(false);

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
  const phaseLabel =
    phase === "morning" ? "Opening Count" : "Closing Count";
  const isEvening = phase === "evening";
  const openingCountComplete =
    shift !== null &&
    batches !== null &&
    shift.status !== "closed" &&
    batches.every((b) => b.morning_count_status !== "pending") &&
    !isClosingCountInitialized(batches);

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

  const handleStartClosingCount = async () => {
    if (!shift) return;
    setStartingClosingCount(true);
    setError(null);
    try {
      const res = await fetch(`/api/count-shifts/${shift.id}/start-evening`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Closing count ready — count the same items again");
        await fetchShift();
      } else {
        setError(data.message || "Failed to start closing count.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setStartingClosingCount(false);
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
  //  Render: Opening count complete — start closing count
  // ═══════════════════════════════════════════════════════════

  if (openingCountComplete) {
    const morningCounted = batches.filter(
      (b) => b.morning_count_status === "counted",
    ).length;
    const morningNotFound = batches.filter(
      (b) => b.morning_count_status === "not_located",
    ).length;

    return (
      <div className="h-full overflow-y-auto bg-[#f6f8f6] dark:bg-[#0f1a0d]">
        <div className="max-w-lg mx-auto p-4 pt-5">
          <div className="bg-white dark:bg-[#1a2c17] rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800/60 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                <Sun className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Opening Count Complete
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totalItems} items counted — ready for closing count
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {morningCounted}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
                  Counted
                </p>
              </div>
              <div className="flex-1 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 text-center">
                <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {morningNotFound}
                </p>
                <p className="text-[11px] text-red-500 dark:text-red-400">
                  Not found
                </p>
              </div>
            </div>

            {error && (
              <p
                className="text-sm text-red-600 dark:text-red-400 mb-3"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleStartClosingCount}
              disabled={startingClosingCount}
              className="w-full h-11 rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {startingClosingCount ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  Start Closing Count
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Render: Counting (opening or closing)
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-[#f6f8f6] dark:bg-[#0f1a0d] lg:max-w-6xl lg:mx-auto lg:w-full">
      <BarcodeCameraScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleBarcodeScan}
      />

      {/* Header */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-[#0f1a0d]/80 lg:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white leading-tight">
              {phaseLabel}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {countedItems}/{totalItems} entered
              {isEvening ? " · same items as opening" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 lg:hidden">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-30"
              aria-label="Previous item"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums min-w-[4rem] text-center">
              {currentIndex + 1}/{totalItems}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(totalItems - 1, i + 1))
              }
              disabled={currentIndex >= totalItems - 1}
              className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-30"
              aria-label="Next item"
            >
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2">
          <div
            className="h-full rounded-full bg-[#1c6a1e] transition-all duration-300"
            style={{
              width: `${totalItems > 0 ? (countedItems / totalItems) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row lg:min-h-0">
        {/* Desktop item table */}
        {batches && phase && (
          <div className="hidden lg:flex lg:flex-col lg:w-[44%] xl:w-[42%] border-r border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-[#1a2c17] min-h-0">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-8">
                      #
                    </th>
                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500">
                      Product
                    </th>
                    <th className="text-left py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-20">
                      Status
                    </th>
                    <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-14">
                      Qty
                    </th>
                    {isEvening && (
                      <th className="text-right py-1 px-2 font-semibold text-[10px] uppercase tracking-wide text-slate-500 w-14">
                        Open
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch, idx) => {
                    const displayStatus = getItemDisplayStatus(
                      batch,
                      phase,
                      counts,
                    );
                    const entry = counts[batch.item_id];
                    const isActive = idx === currentIndex;
                    const statusColor =
                      displayStatus === "Counted"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : displayStatus === "Not found"
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-500 dark:text-slate-400";

                    return (
                      <tr
                        key={batch.item_id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`cursor-pointer border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          isActive
                            ? "bg-[#1c6a1e]/8 dark:bg-[#1c6a1e]/15"
                            : ""
                        }`}
                      >
                        <td className="py-1 px-2 tabular-nums text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-2">
                          <span className="font-medium text-slate-900 dark:text-white leading-tight">
                            {batch.item_name}
                          </span>
                          {batch.barcode && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              {batch.barcode}
                            </span>
                          )}
                        </td>
                        <td className={`py-1 px-2 font-medium ${statusColor}`}>
                          {displayStatus}
                        </td>
                        <td className="py-1 px-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-200">
                          {entry?.status === "counted"
                            ? entry.count || "0"
                            : "—"}
                        </td>
                        {isEvening && (
                          <td className="py-1 px-2 text-right tabular-nums text-slate-500">
                            {batch.morning_count ?? "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {/* Mobile item status strip */}
          {batches && phase && (
            <div className="shrink-0 px-3 py-1.5 border-b border-slate-200/40 dark:border-slate-800/40 bg-white dark:bg-[#1a2c17] lg:hidden">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {batches.map((batch, idx) => {
                  const displayStatus = getItemDisplayStatus(
                    batch,
                    phase,
                    counts,
                  );
                  const styles = ITEM_STATUS_STYLES[displayStatus];
                  const isActive = idx === currentIndex;
                  return (
                    <button
                      key={batch.item_id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`shrink-0 flex flex-col items-center min-w-[3rem] px-1.5 py-0.5 rounded-md text-center ${styles.chip} ${isActive ? styles.active : ""}`}
                    >
                      <span className="text-[11px] font-bold tabular-nums leading-none">
                        {idx + 1}
                      </span>
                      <span className="text-[9px] font-medium leading-tight mt-0.5 whitespace-nowrap">
                        {displayStatus}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Entry panel */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 lg:px-4 lg:py-3">
        {currentBatch && (
          <div className="bg-white dark:bg-[#1a2c17] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
              {currentBatch.item_name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 mb-2 text-[11px] text-slate-500 dark:text-slate-400">
              {currentBatch.barcode && (
                <span className="font-mono">{currentBatch.barcode}</span>
              )}
              {(() => {
                const selectionLabel = getSelectionLabel(
                  currentBatch.selection_source,
                );
                return selectionLabel ? (
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {selectionLabel}
                  </span>
                ) : null;
              })()}
              {isEvening && currentBatch.morning_count !== null && (
                <span className="whitespace-nowrap">
                  Opening:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {currentBatch.morning_count}
                  </span>
                </span>
              )}
            </div>

            {/* Entry status */}
            {currentEntry && (
              <div
                className={`mb-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  currentEntry.status === "not_located"
                    ? "bg-red-50 dark:bg-red-950/30"
                    : "bg-emerald-50 dark:bg-emerald-950/30"
                }`}
              >
                <span
                  className={`font-medium ${
                    currentEntry.status === "not_located"
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {currentEntry.status === "not_located"
                    ? "Not found"
                    : "Counted"}
                </span>
                {currentEntry.status === "counted" && (
                  <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                    {currentEntry.count || "0"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleClearCount(currentBatch.item_id)}
                  className="text-[11px] text-slate-400 underline ml-2"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Barcode verify */}
            {needsBarcodeVerify ? (
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!barcodeVerified) setScannerOpen(true);
                  }}
                  disabled={barcodeVerified}
                  className={`flex-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    barcodeVerified
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  }`}
                >
                  <Scan className="w-3.5 h-3.5 shrink-0" />
                  {barcodeVerified ? "Barcode verified" : "Scan to verify"}
                </button>
                {!barcodeVerified && (
                  <button
                    type="button"
                    onClick={handleManualVerify}
                    className="text-[11px] text-slate-500 underline shrink-0"
                  >
                    Visual OK
                  </button>
                )}
              </div>
            ) : (
              !verifiedBarcodes[currentBatch.item_id] && (
                <button
                  type="button"
                  onClick={() =>
                    setVerifiedBarcodes((prev) => ({
                      ...prev,
                      [currentBatch.item_id]: true,
                    }))
                  }
                  className="mb-2 w-full rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Confirm item (no barcode)
                </button>
              )
            )}

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
              className="mb-2"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmItem}
                disabled={!currentEntry}
                className="flex-[2] h-11 rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                {needsBarcodeVerify && !barcodeVerified
                  ? "Scan first"
                  : currentIndex < totalItems - 1
                    ? "Confirm & next"
                    : "Confirm last"}
              </button>
              <button
                type="button"
                onClick={() => handleMarkNotFound(currentBatch.item_id)}
                className={`flex-1 h-11 rounded-xl font-semibold text-xs active:scale-[0.98] transition-transform flex items-center justify-center gap-1 ${
                  currentEntry?.status === "not_located"
                    ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <SearchX className="w-4 h-4" />
                Not found
              </button>
            </div>
          </div>
        )}
          </div>

          {/* Bottom actions */}
          <div className="shrink-0 px-3 py-2 space-y-1.5 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-[#0f1a0d]/90 lg:px-4">
        {error && (
          <p
            className="text-xs text-red-600 dark:text-red-400 text-center"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmitCounts}
          disabled={submitting || countedItems === 0}
          className="w-full h-11 rounded-xl bg-[#1c6a1e] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Submit {phaseLabel} ({countedItems}/{totalItems})
            </>
          )}
        </button>

        {isEvening && eveningCompleteOnServer && (
          <button
            type="button"
            onClick={handleCloseShift}
            disabled={closingShift}
            className="w-full h-11 rounded-xl bg-amber-500 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {closingShift ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Closing…
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Close Shift & Compare
              </>
            )}
          </button>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
