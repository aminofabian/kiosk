"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Loader2, FileText, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/utils/api-client";
import { toast } from "sonner";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import { SupplyShell } from "@/components/department/supply/SupplyShell";
import { ContinueDraftBanner } from "@/components/department/supply/ContinueDraftBanner";
import {
  POApprovalBadge,
  POFulfillmentBadge,
} from "@/components/department/supply/POStatusBadge";
import {
  STAFF_FILTERS,
  formatSupplyDate,
  formatSupplyPrice,
  matchesStaffFilter,
  type StaffFilter,
} from "@/lib/department/supply-constants";

interface PO {
  id: string;
  supplier_name: string | null;
  department: string | null;
  total_amount: number;
  approval_status: string;
  status: string;
  notes: string | null;
  item_count: number;
  created_at: number;
}

export default function DepartmentSupplyPage() {
  const { supplyRefreshKey } = useDepartmentApp();
  const [orders, setOrders] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StaffFilter>("all");
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<PO[]>("/api/department/purchase-orders");
      if (result.success && result.data) setOrders(result.data);
    } catch {
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, supplyRefreshKey]);

  const filtered = useMemo(
    () =>
      orders.filter((po) =>
        matchesStaffFilter(po.approval_status, po.status, filter),
      ),
    [orders, filter],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<StaffFilter, number> = {
      all: orders.length,
      needs_action: 0,
      waiting: 0,
      in_progress: 0,
      done: 0,
    };
    for (const po of orders) {
      for (const f of STAFF_FILTERS) {
        if (
          f.key !== "all" &&
          matchesStaffFilter(po.approval_status, po.status, f.key)
        ) {
          counts[f.key]++;
        }
      }
    }
    return counts;
  }, [orders]);

  return (
    <SupplyShell
      title="Supply"
      subtitle="Purchase orders & deliveries"
      backHref="/department"
      action={
        <Button
          size="sm"
          className="h-8 bg-[#1c6a1e] hover:bg-[#155a17] text-white text-xs"
          asChild
        >
          <Link href="/department/supply/new">
            <Plus className="w-3.5 h-3.5 mr-1" />
            New
          </Link>
        </Button>
      }
      footer={
        <Button
          className="w-full h-11 bg-[#1c6a1e] hover:bg-[#155a17] text-white md:hidden"
          asChild
        >
          <Link href="/department/supply/new">
            <Plus className="w-4 h-4 mr-2" />
            New purchase order
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <ContinueDraftBanner />

        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="w-full flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 px-3 py-2.5 text-left"
        >
          <Info className="w-4 h-4 text-[#1c6a1e] shrink-0" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex-1">
            How supply orders work
          </span>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 transition-transform ${showGuide ? "rotate-90" : ""}`}
          />
        </button>
        {showGuide && (
          <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 pl-1 list-decimal list-inside bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <li>Create a draft PO with your assigned supplier</li>
            <li>Submit for admin approval</li>
            <li>When stock arrives, record delivery to update inventory</li>
          </ol>
        )}

        <div
          className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          role="tablist"
          aria-label="Filter orders"
        >
          {STAFF_FILTERS.map(({ key, label }) => {
            const count = filterCounts[key];
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#1c6a1e] text-white"
                    : "bg-white dark:bg-slate-900/60 text-slate-500 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {label}
                {count > 0 && (
                  <span
                    className={`ml-1 tabular-nums ${active ? "opacity-90" : "opacity-60"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40">
            <FileText className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              No purchase orders yet
            </p>
            <p className="text-sm text-slate-400 mt-1 px-6">
              Request supplies from suppliers assigned to your department
            </p>
            <Button
              className="mt-4 bg-[#1c6a1e] hover:bg-[#155a17] text-white"
              asChild
            >
              <Link href="/department/supply/new">
                <Plus className="w-4 h-4 mr-2" />
                Create first order
              </Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            No orders in this view
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((po) => (
              <Link
                key={po.id}
                href={`/department/supply/${po.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 hover:border-[#1c6a1e]/40 active:scale-[0.99] transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {po.supplier_name || "Unknown supplier"}
                    </span>
                    <POApprovalBadge status={po.approval_status} />
                    {po.approval_status === "approved" && (
                      <POFulfillmentBadge status={po.status} />
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {formatSupplyDate(po.created_at)} · {po.item_count} item
                    {po.item_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <p className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                    {formatSupplyPrice(po.total_amount)}
                  </p>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SupplyShell>
  );
}
