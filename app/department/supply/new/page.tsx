"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, StickyNote, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/utils/api-client";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import { toast } from "sonner";
import { SupplyShell } from "@/components/department/supply/SupplyShell";
import { NewPOSteps } from "@/components/department/supply/NewPOSteps";
import {
  POLineEditor,
  type LineDraft,
  type POProductOption,
} from "@/components/department/supply/POLineEditor";
import {
  deptLabel,
  formatSupplierName,
  sortProductsByLatest,
} from "@/lib/department/supply-constants";
import { getItemDisplayName } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
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

function linesFromProducts(products: POProductOption[]): LineDraft[] {
  if (products.length === 0) {
    return [{ id: "1", itemId: "", qty: "", cost: "" }];
  }
  return products.map((p, index) => {
    const cost =
      p.defaultCost != null
        ? String(p.defaultCost)
        : p.lastBuyPrice != null
          ? String(p.lastBuyPrice)
          : "";
    return {
      id: String(index + 1),
      itemId: p.id,
      qty: "",
      cost,
    };
  });
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { assignedTypes, shopType } = useDepartmentApp();

  const [department, setDepartment] = useState(
    assignedTypes.includes(shopType) ? shopType : assignedTypes[0] || "",
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<POProductOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([
    { id: "1", itemId: "", qty: "", cost: "" },
  ]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const supUrl = department
        ? `/api/department/suppliers?departmentKey=${encodeURIComponent(department)}`
        : "/api/department/suppliers";

      const supRes = await apiGet<Supplier[]>(supUrl);
      if (supRes.success && supRes.data) {
        setSuppliers(supRes.data);
        setSupplierId((prev) =>
          supRes.data!.some((s) => s.id === prev) ? prev : "",
        );
      }
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoadingSuppliers(false);
    }
  }, [department]);

  const loadSupplierProducts = useCallback(async () => {
    if (!supplierId || !department) {
      setProducts([]);
      setLines([{ id: "1", itemId: "", qty: "", cost: "" }]);
      return;
    }

    setLoadingProducts(true);
    try {
      const result = await apiGet<LinkedProductRow[]>(
        `/api/department/suppliers/${supplierId}/products?departmentKey=${encodeURIComponent(department)}`,
      );
      if (result.success && result.data) {
        const options = sortProductsByLatest(result.data.map(toProductOption));
        setProducts(options);
        setLines(linesFromProducts(options));
      } else {
        setProducts([]);
        setLines([{ id: "1", itemId: "", qty: "", cost: "" }]);
        if (result.message) toast.error(result.message);
      }
    } catch {
      toast.error("Failed to load supplier products");
      setProducts([]);
      setLines([{ id: "1", itemId: "", qty: "", cost: "" }]);
    } finally {
      setLoadingProducts(false);
    }
  }, [supplierId, department]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    void loadSupplierProducts();
  }, [loadSupplierProducts]);

  useEffect(() => {
    if (assignedTypes.length === 1) {
      setDepartment(assignedTypes[0]);
    } else if (!assignedTypes.includes(department) && assignedTypes[0]) {
      setDepartment(assignedTypes[0]);
    }
  }, [assignedTypes, department]);

  const lineTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const q = parseFloat(line.qty);
        const c = parseFloat(line.cost);
        if (isNaN(q) || isNaN(c) || q <= 0 || c <= 0) return sum;
        return sum + q * c;
      }, 0),
    [lines],
  );

  const filledLineCount = useMemo(
    () =>
      lines.filter((l) => {
        const q = parseFloat(l.qty);
        const c = parseFloat(l.cost);
        return l.itemId && !isNaN(q) && q > 0 && !isNaN(c) && c > 0;
      }).length,
    [lines],
  );

  const canSave =
    !!supplierId &&
    !loadingProducts &&
    products.length > 0 &&
    filledLineCount > 0 &&
    lineTotal > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department) {
      toast.error("Select a department");
      return;
    }
    if (!supplierId) {
      toast.error("Select a supplier");
      return;
    }

    const structuredLines = lines
      .map((line) => {
        const product = products.find((p) => p.id === line.itemId);
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
      toast.error("Enter quantity and cost for at least one product");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiPost<{ purchaseId: string }>(
        "/api/department/purchase-orders",
        {
          supplierId,
          department,
          notes: notes.trim() || null,
          lines: structuredLines,
        },
      );

      if (result.success && result.data?.purchaseId) {
        toast.success("Draft saved");
        router.push(`/department/supply/${result.data.purchaseId}`);
      } else {
        toast.error(result.message || "Failed to create purchase order");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const saveFooter = (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <div className="text-slate-500 text-xs">
          {filledLineCount > 0 ? (
            <span>
              {filledLineCount} line{filledLineCount !== 1 ? "s" : ""} ready
            </span>
          ) : (
            <span>Add qty &amp; cost to save</span>
          )}
        </div>
        <span className="font-bold text-[#1c6a1e] tabular-nums">
          KES {lineTotal.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
        </span>
      </div>
      <Button
        type="submit"
        disabled={submitting || !canSave}
        className="w-full h-11 bg-[#1c6a1e] hover:bg-[#165a19]"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Save draft"
        )}
      </Button>
    </form>
  );

  return (
    <SupplyShell
      title="New order"
      subtitle="Draft → submit → receive"
      footer={!loadingSuppliers ? saveFooter : undefined}
    >
      {loadingSuppliers ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <NewPOSteps
            supplierDone={!!supplierId}
            productsDone={filledLineCount > 0}
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
            {/* Supplier row */}
            <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-3.5 h-3.5 text-[#1c6a1e]" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Who are you ordering from?
                </span>
              </div>
              <div
                className={`grid gap-2 ${assignedTypes.length > 1 ? "sm:grid-cols-2" : ""}`}
              >
                {assignedTypes.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">Department</Label>
                    <Select
                      value={department}
                      onValueChange={(v) => {
                        setDepartment(v);
                        setSupplierId("");
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignedTypes.map((key) => (
                          <SelectItem key={key} value={key}>
                            {deptLabel(key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatSupplierName(s.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {suppliers.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                  No suppliers assigned — ask admin to link one to your department.
                </p>
              )}
              {selectedSupplier && products.length > 0 && !loadingProducts && (
                <p className="text-[11px] text-[#1c6a1e] mt-2 font-medium">
                  {products.length} product{products.length !== 1 ? "s" : ""} available
                  from {formatSupplierName(selectedSupplier.name)}
                </p>
              )}
            </div>

            {/* Products table */}
            <div className="px-3 py-3">
              {!supplierId ? (
                <p className="text-sm text-slate-400 text-center py-10">
                  Choose a supplier above to load products
                </p>
              ) : (
                <POLineEditor
                  lines={lines}
                  products={products}
                  onChange={setLines}
                  total={lineTotal}
                  loading={loadingProducts}
                  layout="table"
                  showTotal={false}
                  emptyMessage="No products linked to this supplier. Ask admin to link products first."
                />
              )}
            </div>

            {/* Collapsible notes */}
            <div className="border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
              >
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <StickyNote className="w-3.5 h-3.5" />
                  Notes for admin
                  {notes.trim() && (
                    <span className="normal-case font-normal text-[#1c6a1e]">
                      · added
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${showNotes ? "rotate-180" : ""}`}
                />
              </button>
              {showNotes && (
                <div className="px-3 pb-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Delivery window, urgency, special instructions…"
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center px-2">
            Saves as draft — open the order later to submit for admin approval.
          </p>
        </form>
      )}
    </SupplyShell>
  );
}
