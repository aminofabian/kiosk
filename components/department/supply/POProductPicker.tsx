"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getItemDisplayName } from "@/lib/utils";
import {
  formatProductLastUpdated,
  sortProductsRecentlyThenAlphabetically,
} from "@/lib/department/supply-constants";
import type { POProductLineInput } from "@/lib/department/po-new-draft";
import type { POProductOption } from "@/components/department/supply/POLineEditor";

export type ProductViewMode = "all" | "in_order";

interface POProductPickerProps {
  products: POProductOption[];
  lineInputs: Record<string, POProductLineInput>;
  onChange: (lineInputs: Record<string, POProductLineInput>) => void;
  loading?: boolean;
  emptyMessage?: string;
  onApplyLastOrder?: () => void;
  lastOrderLoading?: boolean;
  lastOrderAvailable?: boolean;
  lastOrderLabel?: string;
  recentItemIds?: string[];
}

function displayName(product: POProductOption): string {
  return getItemDisplayName(product.name, product.variantName);
}

export function defaultCostFor(product: POProductOption): string {
  const price =
    product.defaultCost != null
      ? product.defaultCost
      : product.lastBuyPrice != null
        ? product.lastBuyPrice
        : null;
  return price != null ? String(price) : "";
}

function isFilledInput(input: POProductLineInput | undefined): boolean {
  if (!input) return false;
  const qty = parseFloat(input.qty);
  const cost = parseFloat(input.cost);
  return !isNaN(qty) && qty > 0 && !isNaN(cost) && cost > 0;
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
  onApplyLastOrder,
  lastOrderLoading,
  lastOrderAvailable,
  lastOrderLabel,
  recentItemIds = [],
}: POProductPickerProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ProductViewMode>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const prevFilledCountRef = useRef(0);

  const sortedProducts = useMemo(
    () =>
      sortProductsRecentlyThenAlphabetically(
        products,
        recentItemIds,
        displayName,
      ),
    [products, recentItemIds],
  );

  const recentIdSet = useMemo(() => new Set(recentItemIds), [recentItemIds]);

  const filledCount = useMemo(
    () => products.filter((p) => isFilledInput(lineInputs[p.id])).length,
    [products, lineInputs],
  );

  useEffect(() => {
    if (!loading && products.length > 0) {
      searchRef.current?.focus({ preventScroll: true });
    }
  }, [loading, products.length]);

  useEffect(() => {
    if (filledCount > 0 && prevFilledCountRef.current === 0) {
      setViewMode("in_order");
    }
    prevFilledCountRef.current = filledCount;
  }, [filledCount]);

  const filteredProducts = useMemo(() => {
    let list =
      viewMode === "in_order"
        ? sortedProducts.filter((p) => isFilledInput(lineInputs[p.id]))
        : sortedProducts;

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => displayName(p).toLowerCase().includes(q));
    }
    return list;
  }, [sortedProducts, lineInputs, viewMode, search]);

  const updateLine = (productId: string, patch: Partial<POProductLineInput>) => {
    const current = lineInputs[productId] ?? { qty: "", cost: "" };
    onChange({
      ...lineInputs,
      [productId]: { ...current, ...patch },
    });
  };

  const bumpQty = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    const current = lineInputs[productId] ?? {
      qty: "",
      cost: product ? defaultCostFor(product) : "",
    };
    const currentQty = parseFloat(current.qty);
    const nextQty = (isNaN(currentQty) ? 0 : currentQty) + delta;
    updateLine(productId, { qty: String(Math.max(0, nextQty)) });
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
          ref={searchRef}
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

      <div className="flex flex-wrap items-center gap-1.5">
        <div
          className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800/40"
          role="tablist"
          aria-label="Product view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "in_order"}
            onClick={() => setViewMode("in_order")}
            disabled={filledCount === 0}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              viewMode === "in_order"
                ? "bg-white dark:bg-slate-900 text-[#1c6a1e] shadow-sm"
                : filledCount === 0
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-500 hover:text-slate-700"
            }`}
          >
            In order{filledCount > 0 ? ` (${filledCount})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "all"}
            onClick={() => setViewMode("all")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              viewMode === "all"
                ? "bg-white dark:bg-slate-900 text-[#1c6a1e] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            All ({products.length})
          </button>
        </div>

        {lastOrderAvailable && onApplyLastOrder && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={lastOrderLoading}
            onClick={onApplyLastOrder}
            className="h-7 text-[11px] ml-auto"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {lastOrderLabel ?? "Use last order"}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-slate-500 px-0.5">
        {viewMode === "in_order" ? (
          <>
            Showing items in your order
            {search.trim() ? ` · ${filteredProducts.length} match search` : ""}
          </>
        ) : search.trim() ? (
          <>
            {filteredProducts.length} match{filteredProducts.length !== 1 ? "es" : ""}{" "}
            · A–Z
          </>
        ) : (
          <>
            {products.length} product{products.length !== 1 ? "s" : ""}
            {recentItemIds.length > 0 ? " · recent first" : " · A–Z"}
            {filledCount > 0 && (
              <span className="text-[#1c6a1e] font-medium">
                {" "}
                · {filledCount} in order
              </span>
            )}
          </>
        )}
      </p>

      {viewMode === "in_order" && filledCount === 0 ? (
        <div className="text-center py-8 px-2 space-y-2">
          <p className="text-sm text-slate-400">No items in your order yet</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setViewMode("all")}
            className="h-8 text-xs"
          >
            Browse all products
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
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
            const isFilled = isFilledInput(input);
            const subtotal = isFilled ? qty * cost : null;
            const isRecent = recentIdSet.has(product.id);

            return (
              <div
                key={product.id}
                className={`flex flex-col gap-1.5 px-2.5 py-2 transition-colors ${
                  isFilled
                    ? "bg-[#1c6a1e]/5 dark:bg-[#1c6a1e]/10"
                    : "bg-white dark:bg-slate-900/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-snug truncate">
                      {displayName(product)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {isRecent && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Last order
                        </span>
                      )}
                      {product.lastUpdatedAt != null && (
                        <span className="text-[10px] text-slate-400">
                          Updated{" "}
                          {formatProductLastUpdated(product.lastUpdatedAt)}
                        </span>
                      )}
                    </div>
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
                <div className="flex gap-1 pl-0.5">
                  {[1, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => bumpQty(product.id, n)}
                      className="h-6 px-2 rounded-md text-[10px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95 transition-transform"
                      aria-label={`Add ${n} to quantity for ${displayName(product)}`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
