"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Truck,
  CheckCircle,
  XCircle,
  FileText,
  Package,
  ClipboardList,
} from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/utils/api-client";
import { toast } from "sonner";
import { useItemTypes } from "@/lib/hooks/use-item-types";
import { useDepartmentEvents } from "@/lib/hooks/use-department-events";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  ADMIN_TABS,
  deptLabel,
  formatSupplyDate,
  formatSupplyPrice,
  formatSupplierName,
  type AdminTab,
} from "@/lib/department/supply-constants";
import { AssignSupplierDialog } from "@/components/department/supply/AssignSupplierDialog";
import { RejectPODialog } from "@/components/department/supply/RejectPODialog";
import { DepartmentSuppliersBoard } from "@/components/admin/department-supply/DepartmentSuppliersBoard";

interface Supplier {
  id: string;
  name: string;
  active?: number;
}

interface Assignment {
  id: string;
  department_key: string;
  supplier_id: string;
  supplier_name: string;
  assigned_by_name: string;
}

interface PendingPO {
  id: string;
  staff_name: string;
  supplier_name: string;
  department: string;
  total_amount: number;
  notes: string | null;
  item_count: number;
  created_at: number;
}

interface DeliveryRecord {
  breakdown_id: string;
  purchase_id: string;
  item_name: string;
  usable_quantity: number;
  buy_price_per_unit: number;
  staff_name: string;
  department: string;
  supplier_name: string;
  confirmed_at: number;
}

function isAdminTab(v: string | null): v is AdminTab {
  return v === "setup" || v === "approvals" || v === "deliveries";
}

function DepartmentSupplyAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: AdminTab = isAdminTab(tabParam) ? tabParam : "setup";

  const { itemTypeKeys } = useItemTypes();
  const { user } = useCurrentUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [poLoading, setPoLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingPO | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

  const deptKeys =
    itemTypeKeys.length > 0
      ? itemTypeKeys
      : [
          "grocery",
          "retail",
          "bakery",
          "butcher",
          "dairy",
          "produce",
          "beverages",
          "household",
          "electronics",
          "pharmacy",
        ];

  const setTab = (tab: AdminTab) => {
    router.replace(`/admin/department-supply?tab=${tab}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        apiGet<Assignment[]>("/api/admin/department-suppliers"),
        apiGet<Supplier[]>("/api/suppliers"),
      ]);
      if (aRes.success && aRes.data) setAssignments(aRes.data);
      if (sRes.success && sRes.data) setSuppliers(sRes.data);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPendingPOs = useCallback(async () => {
    setPoLoading(true);
    try {
      const result = await apiGet<PendingPO[]>(
        "/api/admin/purchase-orders/pending",
      );
      if (result.success && result.data) setPendingPOs(result.data);
    } catch {
      /* non-critical */
    } finally {
      setPoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPendingPOs();
  }, [loadPendingPOs]);

  const loadDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    try {
      const result = await apiGet<DeliveryRecord[]>(
        "/api/admin/purchase-orders/deliveries",
      );
      if (result.success && result.data) setDeliveries(result.data.slice(0, 30));
    } catch {
      /* non-critical */
    } finally {
      setDeliveriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  useDepartmentEvents({
    role: user?.role,
    userId: user?.id,
    businessId: user?.businessId,
    onPurchaseSubmitted: () => {
      void loadPendingPOs();
    },
  });

  const handleAssign = async (
    departmentKey: string,
    supplierId: string,
  ): Promise<boolean> => {
    try {
      const result = await apiPost("/api/admin/department-suppliers", {
        departmentKey,
        supplierId,
      });
      if (result.success) {
        toast.success("Supplier assigned");
        void load();
        return true;
      }
      toast.error(result.message || "Failed to assign");
      return false;
    } catch {
      toast.error("An error occurred");
      return false;
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const result = await apiDelete(
        `/api/admin/department-suppliers?id=${id}`,
      );
      if (result.success) {
        toast.success("Assignment removed");
        void load();
      } else {
        toast.error(result.message || "Failed to remove");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      const result = await apiPost(
        `/api/admin/purchase-orders/${id}/approve`,
        {},
      );
      if (result.success) {
        toast.success("PO approved");
        void loadPendingPOs();
        void loadDeliveries();
      } else {
        toast.error(result.message || "Failed to approve");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (reason?: string) => {
    if (!rejectTarget) return;
    setActingId(rejectTarget.id);
    try {
      const result = await apiPost(
        `/api/admin/purchase-orders/${rejectTarget.id}/reject`,
        { reason },
      );
      if (result.success) {
        toast.success("PO rejected");
        setRejectTarget(null);
        void loadPendingPOs();
      } else {
        toast.error(result.message || "Failed to reject");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActingId(null);
    }
  };

  const grouped = assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.department_key]) acc[a.department_key] = [];
    acc[a.department_key].push(a);
    return acc;
  }, {});

  const assignedSupplierIds = new Set(assignments.map((a) => a.supplier_id));
  const allDeptKeys = [...new Set([...deptKeys, ...Object.keys(grouped)])];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d]">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-8 py-5 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Department Supply
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure suppliers, approve orders, and audit deliveries
                </p>
              </div>
              <AssignSupplierDialog
                deptKeys={deptKeys}
                suppliers={suppliers}
                assignedSupplierIds={assignedSupplierIds}
                onAssign={handleAssign}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setTab("setup")}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  activeTab === "setup"
                    ? "border-[#1c6a1e]/40 bg-[#1c6a1e]/5"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-slate-300"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase text-slate-500">
                  Suppliers
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {loading ? "—" : assignments.length}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTab("approvals")}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  activeTab === "approvals"
                    ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-slate-300"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                  Pending
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {poLoading ? "—" : pendingPOs.length}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTab("deliveries")}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  activeTab === "deliveries"
                    ? "border-[#1c6a1e]/40 bg-[#1c6a1e]/5"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-slate-300"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase text-slate-500">
                  Deliveries
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {deliveriesLoading ? "—" : deliveries.length}
                </p>
              </button>
            </div>

            <nav
              className="flex gap-1 mt-4 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80"
              aria-label="Supply sections"
            >
              {ADMIN_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === key
                      ? "bg-white dark:bg-slate-900 text-[#1c6a1e] shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 md:px-8 py-6">
          {activeTab === "setup" && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <DepartmentSuppliersBoard
                  deptKeys={allDeptKeys}
                  grouped={grouped}
                  onRemove={(id) => void handleRemove(id)}
                />
              )}
            </section>
          )}

          {activeTab === "approvals" && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Awaiting your approval
                </h2>
              </div>
              {poLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : pendingPOs.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <FileText className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                  <p className="text-sm text-slate-500">
                    No purchase orders waiting for approval
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    New submissions from department staff appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingPOs.map((po) => (
                    <div key={po.id} className="px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {formatSupplierName(po.supplier_name || "Unknown supplier")}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatSupplyDate(po.created_at)} · {po.staff_name}
                            {po.department
                              ? ` · ${deptLabel(po.department)}`
                              : ""}{" "}
                            · {po.item_count} item
                            {po.item_count !== 1 ? "s" : ""}
                          </p>
                          {po.notes && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2">
                              {po.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                          <p className="font-bold text-lg text-slate-900 dark:text-white tabular-nums">
                            {formatSupplyPrice(po.total_amount)}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 sm:flex-none h-9 bg-[#1c6a1e] hover:bg-[#155a17] text-white"
                              disabled={actingId === po.id}
                              onClick={() => void handleApprove(po.id)}
                            >
                              {actingId === po.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1.5" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 sm:flex-none h-9 border-red-200 text-red-600 hover:bg-red-50"
                              disabled={actingId === po.id}
                              onClick={() => setRejectTarget(po)}
                            >
                              <XCircle className="w-4 h-4 mr-1.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "deliveries" && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#1c6a1e]" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Recent deliveries
                </h2>
              </div>
              {deliveriesLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : deliveries.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <Package className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                  <p className="text-sm text-slate-500">No deliveries recorded yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deliveries.map((d) => (
                    <div key={d.breakdown_id} className="px-5 py-3.5">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {d.item_name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatSupplyDate(d.confirmed_at)} · {d.staff_name}
                            {d.department
                              ? ` · ${deptLabel(d.department)}`
                              : ""}
                            {d.supplier_name
                              ? ` · ${formatSupplierName(d.supplier_name)}`
                              : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white shrink-0 tabular-nums">
                          {d.usable_quantity} @{" "}
                          {formatSupplyPrice(d.buy_price_per_unit)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <p className="text-center text-xs text-slate-400 mt-8">
            <Link
              href="/admin/department-activity"
              className="text-[#1c6a1e] hover:underline"
            >
              View department activity →
            </Link>
          </p>
        </main>
      </div>

      <RejectPODialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        supplierName={rejectTarget?.supplier_name}
        onConfirm={handleReject}
        loading={actingId === rejectTarget?.id}
      />
    </AdminLayout>
  );
}

export default function DepartmentSupplyAdminPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        </AdminLayout>
      }
    >
      <DepartmentSupplyAdminContent />
    </Suspense>
  );
}
