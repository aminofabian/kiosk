"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getItemDisplayName } from "@/lib/utils";
import {
  formatProductLastUpdated,
  sortProductsAlphabetically,
} from "@/lib/department/supply-constants";
import type { POProductLineInput } from "@/lib/department/po-new-draft";
import type { POProductOption } from "@/components/department/supply/POLineEditor";

interface POProductPickerProps {
  products: POProductOption[];
  lineInputs: Record<string, POProductLineInput>;
  onChange: (lineInputs: Record<string, POProductLineInput>) => void;
  loading?: boolean;
  emptyMessage?: string;
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

function ProductPickerSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {[0.85, 0.7, 0.9, 0.65, 0.75, 0.8].map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-2.5 py-2.5"
        >
          <div className="flex-1 space-y-1.5 min-w-0">
            <div
              className="h-3.5 bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse"
              style={{ width: `${w * 55}%` }}
            />
            <div
              className="h-2.5 bg-slate-50 dark:bg-slate-800/40 rounded animate-pulse"
              style={{ width: `${w * 30}%` }}
            />
          </div>
          <div className="h-8 w-14 bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse shrink-0" />
          <div className="h-8 w-16 bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function POProductPicker({
  products,
  lineInputs,
  onChange,
  loading,
  emptyMessage = "No products linked to this supplier. Ask admin to link products first.",
}: POProductPickerProps) {
  const [search, setSearch] = useState("");

  const sortedProducts = useMemo(
    () => sortProductsAlphabetically(products, displayName),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedProducts;
    return sortedProducts.filter((p) =>
      displayName(p).toLowerCase().includes(q),
    );
  }, [sortedProducts, search]);

  const filledCount = useMemo(
    () =>
      products.filter((p) => {
        const input = lineInputs[p.id];
        if (!input) return false;
        const qty = parseFloat(input.qty);
        const cost = parseFloat(input.cost);
        return !isNaN(qty) && qty > 0 && !isNaN(cost) && cost > 0;
      }).length,
    [products, lineInputs],
  );

  const updateLine = (productId: string, patch: Partial<POProductLineInput>) => {
    const current = lineInputs[productId] ?? { qty: "", cost: "" };
    onChange({
      ...lineInputs,
      [productId]: { ...current, ...patch },
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
        <ProductPickerSkeleton />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 text-center py-8 px-2">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-9 pl-8 pr-8 text-sm"
          aria-label="Search products"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] text-slate-500">
          {search.trim() ? (
            <>
              {filteredProducts.length} match{filteredProducts.length !== 1 ? "es" : ""}
            </>
          ) : (
            <>
              {products.length} product{products.length !== 1 ? "s" : ""} · A–Z
            </>
          )}
          {filledCount > 0 && (
            <span className="text-[#1c6a1e] font-medium">
              {" "}
              · {filledCount} with qty
            </span>
          )}
        </p>
      </div>

      {filteredProducts.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">
          No products match &ldquo;{search.trim()}&rdquo;
        </p>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[min(52vh,420px)] overflow-y-auto">
          {filteredProducts.map((product) => {
            const input = lineInputs[product.id] ?? {
              qty: "",
              cost: defaultCostFor(product),
            };
            const qty = parseFloat(input.qty);
            const cost = parseFloat(input.cost);
            const isFilled =
              !isNaN(qty) && qty > 0 && !isNaN(cost) && cost > 0;
            const subtotal =
              isFilled ? qty * cost : null;

            return (
              <div
                key={product.id}
                className={`flex items-start gap-2 px-2.5 py-2 transition-colors ${
                  isFilled
                    ? "bg-[#1c6a1e]/5 dark:bg-[#1c6a1e]/10"
                    : "bg-white dark:bg-slate-900/40"
                }`}
              >
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-snug truncate">
                    {displayName(product)}
                  </p>
                  {product.lastUpdatedAt != null && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Updated {formatProductLastUpdated(product.lastUpdatedAt)}
                    </p>
                  )}
                  {subtotal != null && (
                    <p className="text-[10px] text-[#1c6a1e] font-medium mt-0.5 tabular-nums">
                      KES{" "}
                      {subtotal.toLocaleString("en-KE", {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={input.qty}
                    onChange={(e) =>
                      updateLine(product.id, { qty: e.target.value })
                    }
                    className="h-8 w-[68px] text-xs text-right px-2"
                    aria-label={`Quantity for ${displayName(product)}`}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Cost"
                    value={input.cost}
                    onChange={(e) =>
                      updateLine(product.id, { cost: e.target.value })
                    }
                    className="h-8 w-[76px] text-xs text-right px-2"
                    aria-label={`Cost for ${displayName(product)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { defaultCostFor };
