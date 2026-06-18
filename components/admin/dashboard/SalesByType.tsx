"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useItemTypes } from "@/lib/hooks/use-item-types";

interface SalesByItemTypeRow {
  item_type: string;
  revenue: number;
  profit: number;
}

interface SalesByTypeProps {
  salesByItemType: SalesByItemTypeRow[];
}

export function SalesByType({ salesByItemType }: SalesByTypeProps) {
  const { productTypes } = useItemTypes();

  if (salesByItemType.length === 0) return null;

  const totalRev = salesByItemType.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = salesByItemType.reduce((s, r) => s + r.profit, 0);

  return (
    <Link href="/admin/sales" className="block">
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1c6a1e]" />
              Today&apos;s sales by type
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatKes(totalRev)} revenue · {formatKes(totalProfit)} profit
            </p>
          </div>
          <span className="text-xs font-medium text-[#1c6a1e]">
            View details →
          </span>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          {salesByItemType.map((row) => {
            const typeConfig = productTypes.find((t) => t.key === row.item_type);
            const typeLabel = typeConfig
              ? `${typeConfig.emoji} ${typeConfig.label}`
              : row.item_type;
            const pct = totalRev > 0 ? (row.revenue / totalRev) * 100 : 0;

            return (
              <div key={row.item_type} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {typeLabel}
                  </span>
                  <span className="font-bold text-[#1c6a1e] tabular-nums">
                    {formatKes(row.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1c6a1e] to-[#1fa87a] transition-all"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {pct.toFixed(0)}% of revenue · {formatKes(row.profit)} profit
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

function formatKes(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}
