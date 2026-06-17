"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getItemDisplayName } from "@/lib/utils";
import {
  formatProductLastUpdated,
  sortProductsByLatest,
} from "@/lib/department/supply-constants";

export interface LineDraft {
  id: string;
  itemId: string;
  qty: string;
  cost: string;
}

export interface POProductOption {
  id: string;
  name: string;
  variantName?: string | null;
  defaultCost?: number | null;
  lastBuyPrice?: number | null;
  lastUpdatedAt?: number | null;
}

interface POLineEditorProps {
  lines: LineDraft[];
  products: POProductOption[];
  onChange: (lines: LineDraft[]) => void;
  total: number;
  loading?: boolean;
  emptyMessage?: string;
  layout?: "table" | "cards";
  showTotal?: boolean;
  showHeader?: boolean;
}

function displayName(product: POProductOption): string {
  return getItemDisplayName(product.name, product.variantName);
}

function defaultCostFor(product: POProductOption): string {
  const price =
    product.defaultCost != null
      ? product.defaultCost
      : product.lastBuyPrice != null
        ? product.lastBuyPrice
        : null;
  return price != null ? String(price) : "";
}

function productLabel(products: POProductOption[], itemId: string): string {
  const product = products.find((p) => p.id === itemId);
  return product ? displayName(product) : "—";
}

function productUpdatedLabel(
  products: POProductOption[],
  itemId: string,
): string | null {
  const product = products.find((p) => p.id === itemId);
  if (!product?.lastUpdatedAt) return null;
  return formatProductLastUpdated(product.lastUpdatedAt);
}

export function POLineEditor({
  lines,
  products,
  onChange,
  total,
  loading,
  emptyMessage = "Select a supplier to see their products",
  layout = "table",
  showTotal = true,
  showHeader = true,
}: POLineEditorProps) {
  const sortedProducts = useMemo(
    () => sortProductsByLatest(products),
    [products],
  );

  const updateLine = (id: string, patch: Partial<LineDraft>) => {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    onChange([
      ...lines,
      { id: String(Date.now()), itemId: "", qty: "", cost: "" },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) return;
    onChange(lines.filter((l) => l.id !== id));
  };

  const handleProductSelect = (lineId: string, itemId: string) => {
    const product = sortedProducts.find((p) => p.id === itemId);
    const patch: Partial<LineDraft> = { itemId };
    if (product) {
      const suggested = defaultCostFor(product);
      const line = lines.find((l) => l.id === lineId);
      if (suggested && (!line?.cost || line.cost === "0")) {
        patch.cost = suggested;
      }
    }
    updateLine(lineId, patch);
  };

  if (loading) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">Loading products…</p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 text-center py-8 px-2">
        {emptyMessage}
      </p>
    );
  }

  if (layout === "table") {
    return (
      <div className="space-y-2">
        {showHeader && (
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[11px] text-slate-500">
              {lines.length} line{lines.length !== 1 ? "s" : ""} · newest first ·
              fill qty &amp; cost
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="h-7 text-[11px] shrink-0"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add row
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[320px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-semibold py-2 px-2.5">Product</th>
                <th className="text-left font-semibold py-2 px-2 w-[76px] hidden sm:table-cell">
                  Updated
                </th>
                <th className="text-right font-semibold py-2 px-2 w-[72px]">
                  Qty
                </th>
                <th className="text-right font-semibold py-2 px-2 w-[88px]">
                  Cost
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const qty = parseFloat(line.qty);
                const cost = parseFloat(line.cost);
                const subtotal =
                  !isNaN(qty) && !isNaN(cost) && qty > 0 && cost > 0
                    ? qty * cost
                    : null;
                const updated = line.itemId
                  ? productUpdatedLabel(sortedProducts, line.itemId)
                  : null;

                return (
                  <tr
                    key={line.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 align-top"
                  >
                    <td className="py-1.5 px-2">
                      <Select
                        value={line.itemId}
                        onValueChange={(v) => handleProductSelect(line.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs border-0 shadow-none bg-transparent px-1 max-w-[180px] sm:max-w-none">
                          <SelectValue placeholder="Select…">
                            {line.itemId
                              ? productLabel(sortedProducts, line.itemId)
                              : "Select…"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {sortedProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              <span className="flex flex-col items-start gap-0.5">
                                <span>{displayName(product)}</span>
                                {product.lastUpdatedAt != null && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    Updated{" "}
                                    {formatProductLastUpdated(product.lastUpdatedAt)}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {updated && (
                        <p className="text-[10px] text-slate-400 mt-0.5 px-1 sm:hidden">
                          Updated {updated}
                        </p>
                      )}
                      {subtotal != null && (
                        <p className="text-[10px] text-slate-400 mt-0.5 px-1 tabular-nums">
                          KES {subtotal.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-[10px] text-slate-400 whitespace-nowrap hidden sm:table-cell align-middle">
                      {updated ?? "—"}
                    </td>
                    <td className="py-1.5 px-1">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.id, { qty: e.target.value })
                        }
                        className="h-8 text-xs text-right px-2"
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={line.cost}
                        onChange={(e) =>
                          updateLine(line.id, { cost: e.target.value })
                        }
                        className="h-8 text-xs text-right px-2"
                      />
                    </td>
                    <td className="py-1.5 px-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 1}
                        aria-label="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showTotal && (
          <div className="flex justify-between items-center px-1 pt-1">
            <span className="text-xs text-slate-500">Estimated total</span>
            <span className="text-base font-bold text-[#1c6a1e] tabular-nums">
              KES {total.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Products
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLine}
            className="h-8 text-[#1c6a1e] hover:text-[#155a17] hover:bg-[#1c6a1e]/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add line
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {lines.map((line, index) => (
          <div
            key={line.id}
            className="p-3 bg-white dark:bg-slate-900/40 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Line {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => removeLine(line.id)}
                disabled={lines.length <= 1}
                aria-label="Remove line"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Select
              value={line.itemId}
              onValueChange={(v) => handleProductSelect(line.id, v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {sortedProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <span className="flex flex-col items-start">
                      <span>{displayName(product)}</span>
                      {product.lastUpdatedAt != null && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          Updated {formatProductLastUpdated(product.lastUpdatedAt)}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-slate-500">Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={line.qty}
                  onChange={(e) => updateLine(line.id, { qty: e.target.value })}
                  className="h-10 mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">Cost / unit</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={line.cost}
                  onChange={(e) => updateLine(line.id, { cost: e.target.value })}
                  className="h-10 mt-0.5"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {showTotal && (
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-slate-500">Estimated total</span>
          <span className="text-lg font-bold text-[#1c6a1e] tabular-nums">
            KES {total.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}
