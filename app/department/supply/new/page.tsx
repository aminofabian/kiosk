"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, Loader2, Save, StickyNote, Truck } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/utils/api-client";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import { toast } from "sonner";
import { SupplyShell } from "@/components/department/supply/SupplyShell";
import { NewPOSteps } from "@/components/department/supply/NewPOSteps";
import {
  POProductPicker,
  defaultCostFor,
} from "@/components/department/supply/POProductPicker";
import type { POProductOption } from "@/components/department/supply/POLineEditor";
import {
  deptLabel,
  formatSupplierName,
  sortProductsAlphabetically,
} from "@/lib/department/supply-constants";
import {
  clearNewPODraft,
  draftHasProgress,
  loadNewPODraft,
  saveNewPODraft,
  type POProductLineInput,
} from "@/lib/department/po-new-draft";
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

function mergeLineInputs(
  products: POProductOption[],
  existing: Record<string, POProductLineInput>,
): Record<string, POProductLineInput> {
  const next = { ...existing };
  for (const product of products) {
    if (!next[product.id]) {
      next[product.id] = { qty: "", cost: defaultCostFor(product) };
    }
  }
  return next;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { assignedTypes, shopType, userId } = useDepartmentApp();

  const [department, setDepartment] = useState(
    assignedTypes.includes(shopType) ? shopType : assignedTypes[0] || "",
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<POProductOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [lineInputs, setLineInputs] = useState<
    Record<string, POProductLineInput>
  >({});
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [localDraftSaved, setLocalDraftSaved] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftLoadedRef = useRef(false);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  useEffect(() => {
    if (!userId || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    const draft = loadNewPODraft(userId);
    if (!draft || !draftHasProgress(draft)) return;

    setDepartment(draft.department || assignedTypes[0] || "");
    setSupplierId(draft.supplierId);
    setNotes(draft.notes);
    setShowNotes(draft.showNotes ?? !!draft.notes.trim());
    setLineInputs(draft.lineInputs);
    setDraftRestored(true);
    toast.info("Restored your in-progress order");
  }, [userId, assignedTypes]);

  useEffect(() => {
    if (!userId) return;
    const hasProgress =
      !!supplierId ||
      notes.trim() !== "" ||
      Object.values(lineInputs).some(
        (line) => line.qty.trim() !== "" || line.cost.trim() !== "",
      );

    if (!hasProgress) {
      clearNewPODraft(userId);
      setLocalDraftSaved(false);
      return;
    }

    const timer = window.setTimeout(() => {
      saveNewPODraft(userId, {
        department,
        supplierId,
        notes,
        showNotes,
        lineInputs,
      });
      setLocalDraftSaved(true);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [userId, department, supplierId, notes, showNotes, lineInputs]);

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
      return;
    }

    setLoadingProducts(true);
    try {
      const result = await apiGet<LinkedProductRow[]>(
        `/api/department/suppliers/${supplierId}/products?departmentKey=${encodeURIComponent(department)}`,
      );
      if (result.success && result.data) {
        const options = sortProductsAlphabetically(
          result.data.map(toProductOption),
          (p) => getItemDisplayName(p.name, p.variantName),
        );
        setProducts(options);
        setLineInputs((prev) => mergeLineInputs(options, prev));
      } else {
        setProducts([]);
        if (result.message) toast.error(result.message);
      }
    } catch {
      toast.error("Failed to load supplier products");
      setProducts([]);
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

  const filledLineCount = useMemo(
    () =>
      products.filter((p) => {
        const input = lineInputs[p.id];
        if (!input) return false;
        const q = parseFloat(input.qty);
        const c = parseFloat(input.cost);
        return !isNaN(q) && q > 0 && !isNaN(c) && c > 0;
      }).length,
    [products, lineInputs],
  );

  const lineTotal = useMemo(
    () =>
      products.reduce((sum, product) => {
        const input = lineInputs[product.id];
        if (!input) return sum;
        const q = parseFloat(input.qty);
        const c = parseFloat(input.cost);
        if (isNaN(q) || isNaN(c) || q <= 0 || c <= 0) return sum;
        return sum + q * c;
      }, 0),
    [products, lineInputs],
  );

  const canSave =
    !!supplierId &&
    !loadingProducts &&
    products.length > 0 &&
    filledLineCount > 0 &&
    lineTotal > 0;

  const hasUnsavedServerDraft = canSave;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!department) {
      toast.error("Select a department");
      return false;
    }
    if (!supplierId) {
      toast.error("Select a supplier");
      return false;
    }

    const structuredLines = products
      .map((product) => {
        const input = lineInputs[product.id];
        if (!input) return null;
        const qtyOrdered = parseFloat(input.qty);
        const unitCostEstimated = parseFloat(input.cost);
        if (
          isNaN(qtyOrdered) ||
          qtyOrdered <= 0 ||
          isNaN(unitCostEstimated) ||
          unitCostEstimated <= 0
        ) {
          return null;
        }
        return {
          itemId: product.id,
          itemName: getItemDisplayName(product.name, product.variantName),
          qtyOrdered,
          unitCostEstimated,
        };
      })
      .filter(Boolean) as {
      itemId: string;
      itemName: string;
      qtyOrdered: number;
      unitCostEstimated: number;
    }[];

    if (structuredLines.length === 0) {
      toast.error("Enter quantity and cost for at least one product");
      return false;
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
        if (userId) clearNewPODraft(userId);
        toast.success("Draft saved");
        router.push(`/department/supply/${result.data.purchaseId}`);
        return true;
      }
      toast.error(result.message || "Failed to create purchase order");
      return false;
    } catch {
      toast.error("An error occurred");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const navigateBack = () => {
    router.push("/department/supply");
  };

  const handleBackClick = () => {
    if (hasUnsavedServerDraft) {
      setExitDialogOpen(true);
      return;
    }
    navigateBack();
  };

  const handleExitSaveDraft = async () => {
    const saved = await handleSubmit();
    if (saved) setExitDialogOpen(false);
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
    <>
      <SupplyShell
        title="New order"
        subtitle="Draft → submit → receive"
        onBackClick={handleBackClick}
        footer={!loadingSuppliers ? saveFooter : undefined}
      >
        {loadingSuppliers ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            {(draftRestored || localDraftSaved) && (
              <div className="flex items-center gap-2 rounded-lg border border-[#1c6a1e]/20 bg-[#1c6a1e]/5 px-3 py-2 text-[11px] text-[#1c6a1e]">
                {draftRestored ? (
                  <History className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Save className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {draftRestored
                    ? "In-progress order restored — pick up where you left off."
                    : "Progress saved on this device — safe to leave and return later."}
                </span>
              </div>
            )}

            <NewPOSteps
              supplierDone={!!supplierId}
              productsDone={filledLineCount > 0}
            />

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
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
                      <Label className="text-[10px] text-slate-500">
                        Department
                      </Label>
                      <Select
                        value={department}
                        onValueChange={(v) => {
                          setDepartment(v);
                          setSupplierId("");
                          setProducts([]);
                          setLineInputs({});
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
                    <Select
                      value={supplierId}
                      onValueChange={(v) => {
                        setSupplierId(v);
                        setProducts([]);
                        setLineInputs({});
                      }}
                    >
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
                    No suppliers assigned — ask admin to link one to your
                    department.
                  </p>
                )}
                {selectedSupplier && products.length > 0 && !loadingProducts && (
                  <p className="text-[11px] text-[#1c6a1e] mt-2 font-medium">
                    {products.length} product{products.length !== 1 ? "s" : ""}{" "}
                    available from {formatSupplierName(selectedSupplier.name)}
                  </p>
                )}
              </div>

              <div className="px-3 py-3">
                {!supplierId ? (
                  <p className="text-sm text-slate-400 text-center py-10">
                    Choose a supplier above to load products
                  </p>
                ) : (
                  <POProductPicker
                    products={products}
                    lineInputs={lineInputs}
                    onChange={setLineInputs}
                    loading={loadingProducts}
                    emptyMessage="No products linked to this supplier. Ask admin to link products first."
                  />
                )}
              </div>

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

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save before leaving?</DialogTitle>
            <DialogDescription>
              You have products ready to order. Save as a draft on the server, or
              leave — your progress is already saved on this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExitDialogOpen(false);
              }}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setExitDialogOpen(false);
                navigateBack();
              }}
            >
              Leave anyway
            </Button>
            <Button
              type="button"
              className="bg-[#1c6a1e] hover:bg-[#165a19]"
              disabled={submitting}
              onClick={() => void handleExitSaveDraft()}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save draft"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
