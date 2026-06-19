"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  Truck,
  CheckCircle,
  Clock,
  Send,
  Undo2,
  Pencil,
  Package,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, apiPatch } from "@/lib/utils/api-client";
import { toast } from "sonner";
import { getItemDisplayName } from "@/lib/utils";
import { SupplyShell } from "@/components/department/supply/SupplyShell";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import { WorkflowSteps } from "@/components/department/supply/WorkflowSteps";
import {
  POApprovalBadge,
  POFulfillmentBadge,
} from "@/components/department/supply/POStatusBadge";
import {
  POLineEditor,
  type LineDraft,
  type POProductOption,
} from "@/components/department/supply/POLineEditor";
import {
  deptLabel,
  formatSupplyDate,
  formatSupplyPrice,
  sortProductsByLatest,
} from "@/lib/department/supply-constants";

interface POLine {
  id: string;
  item_id: string | null;
  item_name_snapshot: string;
  item_name?: string;
  qty_ordered: number | null;
  qty_received: number;
  unit_cost_estimated: number | null;
  status: string;
}

interface PO {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  recorded_by_name: string;
  department: string | null;
  total_amount: number;
  approval_status: string;
  status: string;
  notes: string | null;
  rejection_reason: string | null;
  created_at: number;
  lines: POLine[];
}

interface DeliveryLineInput {
  purchaseItemId: string;
  itemId: string;
  usableQuantity: string;
  wastageQuantity: string;
  buyPricePerUnit: string;
  notes: string;
}

interface LinkedProductRow {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  default_cost_price: number | null;
  last_buy_price: number | null;
  last_updated_at: number | null;
}

function toProductOption(row: LinkedProductRow): POProductOption {
  return {
    id: row.item_id,
    name: row.item_name,
    variantName: row.variant_name,
    defaultCost: row.default_cost_price,
    lastBuyPrice: row.last_buy_price,
    lastUpdatedAt: row.last_updated_at,
  };
}

function mergeEditProducts(
  linked: POProductOption[],
  poLines: POLine[],
): POProductOption[] {
  const byId = new Map(linked.map((p) => [p.id, p]));
  for (const line of poLines) {
    if (line.item_id && !byId.has(line.item_id)) {
      byId.set(line.item_id, {
        id: line.item_id,
        name: line.item_name || line.item_name_snapshot,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function poToEditLines(po: PO): LineDraft[] {
  return po.lines.map((line) => ({
    id: line.id,
    itemId: line.item_id || "",
    qty: String(line.qty_ordered ?? ""),
    cost: String(line.unit_cost_estimated ?? ""),
  }));
}

export default function PODetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { supplyRefreshKey } = useDepartmentApp();
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState<LineDraft[]>([]);
  const [editProducts, setEditProducts] = useState<POProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [deliveryLines, setDeliveryLines] = useState<
    Record<string, DeliveryLineInput>
  >({});
  const [showDelivery, setShowDelivery] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const result = await apiGet<PO>(`/api/department/purchase-orders/${id}`);
      if (result.success && result.data) {
        setPo(result.data);
        setEditNotes(result.data.notes || "");
        setEditLines(poToEditLines(result.data));

        const init: Record<string, DeliveryLineInput> = {};
        for (const line of result.data.lines) {
          if (line.status === "pending") {
            init[line.id] = {
              purchaseItemId: line.id,
              itemId: line.item_id || "",
              usableQuantity: String(line.qty_ordered || ""),
              wastageQuantity: "",
              buyPricePerUnit: String(line.unit_cost_estimated || ""),
              notes: "",
            };
          }
        }
        setDeliveryLines(init);
      }
    } catch {
      toast.error("Failed to load PO");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void load({ silent: supplyRefreshKey > 0 });
  }, [id, supplyRefreshKey, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const loadSupplierProducts = useCallback(
    async (supplierId: string, department: string, poLines: POLine[]) => {
      setProductsLoading(true);
      try {
        const result = await apiGet<LinkedProductRow[]>(
          `/api/department/suppliers/${supplierId}/products?departmentKey=${encodeURIComponent(department)}`,
        );
        if (result.success && result.data) {
          setEditProducts(
            mergeEditProducts(
              sortProductsByLatest(result.data.map(toProductOption)),
              poLines,
            ),
          );
        } else {
          setEditProducts(mergeEditProducts([], poLines));
        }
      } catch {
        toast.error("Failed to load supplier products");
        setEditProducts(mergeEditProducts([], poLines));
      } finally {
        setProductsLoading(false);
      }
    },
    [],
  );

  const startEditing = () => {
    if (!po) return;
    setEditing(true);
    setEditNotes(po.notes || "");
    setEditLines(poToEditLines(po));
    if (po.supplier_id && po.department) {
      void loadSupplierProducts(po.supplier_id, po.department, po.lines);
    }
  };

  const cancelEditing = () => {
    if (!po) return;
    setEditing(false);
    setEditNotes(po.notes || "");
    setEditLines(poToEditLines(po));
  };

  const editLineTotal = useMemo(
    () =>
      editLines.reduce((sum, line) => {
        const q = parseFloat(line.qty);
        const c = parseFloat(line.cost);
        if (isNaN(q) || isNaN(c) || q <= 0 || c <= 0) return sum;
        return sum + q * c;
      }, 0),
    [editLines],
  );

  const handleSaveEdit = async () => {
    if (!po) return;

    const structuredLines = editLines
      .map((line) => {
        const product = editProducts.find((p) => p.id === line.itemId);
        return {
          itemId: line.itemId,
          itemName: product
            ? getItemDisplayName(product.name, product.variantName)
            : undefined,
          qtyOrdered: parseFloat(line.qty),
          unitCostEstimated: parseFloat(line.cost),
        };
      })
      .filter(
        (l) =>
          l.itemId &&
          !isNaN(l.qtyOrdered) &&
          l.qtyOrdered > 0 &&
          !isNaN(l.unitCostEstimated!) &&
          l.unitCostEstimated! > 0,
      );

    if (structuredLines.length === 0) {
      toast.error("Add at least one valid product line");
      return;
    }

    setActing(true);
    try {
      const result = await apiPatch(`/api/department/purchase-orders/${id}`, {
        notes: editNotes.trim() || null,
        lines: structuredLines,
      });
      if (result.success) {
        toast.success("Changes saved");
        setEditing(false);
        void load();
      } else {
        toast.error(result.message || "Failed to save changes");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActing(false);
    }
  };

  const handleSubmit = async () => {
    setActing(true);
    try {
      const result = await apiPost(
        `/api/department/purchase-orders/${id}/submit`,
        {},
      );
      if (result.success) {
        toast.success("Submitted for approval");
        void load();
      } else {
        toast.error(result.message || "Failed to submit");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActing(false);
    }
  };

  const handleWithdraw = async () => {
    setActing(true);
    try {
      const result = await apiPatch(`/api/department/purchase-orders/${id}`, {
        action: "withdraw",
      });
      if (result.success) {
        toast.success("Withdrawn to draft");
        void load();
      } else {
        toast.error(result.message || "Failed to withdraw");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActing(false);
    }
  };

  const updateDeliveryLine = (
    lineId: string,
    patch: Partial<DeliveryLineInput>,
  ) => {
    setDeliveryLines((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], ...patch },
    }));
  };

  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = Object.values(deliveryLines).filter(
      (l) =>
        l.itemId &&
        parseFloat(l.usableQuantity) > 0 &&
        parseFloat(l.buyPricePerUnit) > 0,
    );
    if (lines.length === 0) {
      toast.error("Add at least one valid delivery line");
      return;
    }
    setActing(true);
    try {
      const result = await apiPost(
        `/api/department/purchase-orders/${id}/deliver`,
        {
          lines: lines.map((l) => ({
            purchaseItemId: l.purchaseItemId,
            itemId: l.itemId,
            usableQuantity: parseFloat(l.usableQuantity),
            wastageQuantity: parseFloat(l.wastageQuantity) || 0,
            buyPricePerUnit: parseFloat(l.buyPricePerUnit),
            notes: l.notes || undefined,
          })),
        },
      );
      if (result.success) {
        toast.success("Delivery recorded — stock updated");
        setShowDelivery(false);
        void load();
      } else {
        toast.error(result.message || "Failed to record delivery");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#f4f7f4] dark:bg-[#0e1810]">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <SupplyShell title="Not found" subtitle="Purchase order">
        <div className="text-center py-16 text-slate-400">
          <p>This purchase order could not be found.</p>
          <Button variant="link" asChild className="mt-2 text-[#1c6a1e]">
            <Link href="/department/supply">Back to orders</Link>
          </Button>
        </div>
      </SupplyShell>
    );
  }

  const pendingLines = po.lines.filter((l) => l.status === "pending");
  const canDeliver =
    po.approval_status === "approved" && pendingLines.length > 0;
  const canEdit =
    po.approval_status === "draft" || po.approval_status === "rejected";
  const canSubmit =
    po.approval_status === "draft" || po.approval_status === "rejected";
  const canWithdraw = po.approval_status === "pending_approval";

  const primaryFooter = editing ? (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="flex-1 h-11"
        onClick={cancelEditing}
        disabled={acting}
      >
        <X className="w-4 h-4 mr-1.5" />
        Cancel
      </Button>
      <Button
        className="flex-1 h-11 bg-[#1c6a1e] hover:bg-[#165a19]"
        disabled={acting || editLineTotal <= 0}
        onClick={() => void handleSaveEdit()}
      >
        {acting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Save className="w-4 h-4 mr-1.5" />
            Save
          </>
        )}
      </Button>
    </div>
  ) : canSubmit ? (
    <div className="flex gap-2">
      {canEdit && (
        <Button
          variant="outline"
          className="h-11 px-4"
          onClick={startEditing}
          disabled={acting}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      )}
      <Button
        className="flex-1 h-11 bg-[#1c6a1e] hover:bg-[#155a17]"
        disabled={acting}
        onClick={() => void handleSubmit()}
      >
        {acting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Submit for approval
          </>
        )}
      </Button>
    </div>
  ) : canDeliver && showDelivery ? (
    <Button
      type="submit"
      form="delivery-form"
      disabled={acting}
      className="w-full h-11 bg-[#1c6a1e] hover:bg-[#155a17]"
    >
      {acting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Package className="w-4 h-4 mr-2" />
          Confirm delivery
        </>
      )}
    </Button>
  ) : canDeliver ? (
    <Button
      className="w-full h-11 bg-[#1c6a1e] hover:bg-[#155a17]"
      onClick={() => setShowDelivery(true)}
    >
      <Truck className="w-4 h-4 mr-2" />
      Record delivery
    </Button>
  ) : undefined;

  return (
    <SupplyShell
      title={po.supplier_name || "Purchase order"}
      subtitle={formatSupplyPrice(po.total_amount)}
      action={
        !editing && canEdit ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-slate-500"
            onClick={startEditing}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" />
            Edit
          </Button>
        ) : undefined
      }
      footer={primaryFooter}
    >
      <div className="space-y-4">
        <WorkflowSteps
          approvalStatus={po.approval_status}
          fulfillmentStatus={po.status}
        />

        {po.rejection_reason && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-3 text-sm text-red-700 dark:text-red-300">
            <strong className="font-semibold">Rejected:</strong>{" "}
            {po.rejection_reason}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <POApprovalBadge status={po.approval_status} />
            {po.approval_status === "approved" && (
              <POFulfillmentBadge status={po.status} />
            )}
          </div>
          <p className="text-xs text-slate-400">
            {formatSupplyDate(po.created_at)} · {po.recorded_by_name}
            {po.department ? ` · ${deptLabel(po.department)}` : ""}
          </p>
          {!editing && po.notes && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
              {po.notes}
            </p>
          )}
        </section>

        {canWithdraw && !editing && (
          <Button
            variant="outline"
            className="w-full h-10 text-slate-600"
            disabled={acting}
            onClick={() => void handleWithdraw()}
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Withdraw submission
          </Button>
        )}

        {editing ? (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Edit order
            </h2>
            {productsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <POLineEditor
                  lines={editLines}
                  products={editProducts}
                  onChange={setEditLines}
                  total={editLineTotal}
                  emptyMessage="No products linked to this supplier for your department."
                />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Items ({po.lines.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {po.lines.map((line) => (
                <div key={line.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {line.item_name || line.item_name_snapshot}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ordered {line.qty_ordered ?? "—"}
                      {line.unit_cost_estimated != null &&
                        ` × ${formatSupplyPrice(line.unit_cost_estimated)}`}
                    </p>
                    {line.qty_received > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Received {line.qty_received}
                      </p>
                    )}
                  </div>
                  {line.status === "broken_down" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {canDeliver && showDelivery && !editing && (
          <form
            id="delivery-form"
            onSubmit={(e) => void handleDeliver(e)}
            className="rounded-xl border border-[#1c6a1e]/30 bg-[#1c6a1e]/5 dark:bg-[#1c6a1e]/10 p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1c6a1e] flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Record delivery
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-slate-500"
                onClick={() => setShowDelivery(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {pendingLines.map((line) => {
              const dl = deliveryLines[line.id];
              if (!dl) return null;
              return (
                <div
                  key={line.id}
                  className="rounded-lg bg-white dark:bg-slate-900/60 p-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {line.item_name || line.item_name_snapshot}
                    {line.qty_ordered ? ` · ordered ${line.qty_ordered}` : ""}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">
                        Qty received
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={dl.usableQuantity}
                        onChange={(e) =>
                          updateDeliveryLine(line.id, {
                            usableQuantity: e.target.value,
                          })
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">
                        Cost / unit
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={dl.buyPricePerUnit}
                        onChange={(e) =>
                          updateDeliveryLine(line.id, {
                            buyPricePerUnit: e.target.value,
                          })
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">
                        Wastage
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={dl.wastageQuantity}
                        onChange={(e) =>
                          updateDeliveryLine(line.id, {
                            wastageQuantity: e.target.value,
                          })
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Notes</Label>
                      <Input
                        value={dl.notes}
                        onChange={(e) =>
                          updateDeliveryLine(line.id, { notes: e.target.value })
                        }
                        className="h-9 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </form>
        )}
      </div>
    </SupplyShell>
  );
}
