"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Loader2,
  Minus,
  Package,
  Percent,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import type { DashboardStats } from "@/lib/hooks/use-dashboard-stats";

interface AtAGlanceStatsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

function formatKes(amount: number) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({
  change,
  priorValue,
  formatPrior,
}: {
  change: number | null;
  priorValue: number;
  formatPrior?: (n: number) => string;
}) {
  if (change === null) {
    if (priorValue === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
          <Minus className="w-3 h-3" />
          no sales yesterday
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
        <Minus className="w-3 h-3" />
        no prior data
      </span>
    );
  }

  const isUp = change > 0;
  const isFlat = Math.abs(change) < 0.5;

  if (isFlat) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
        <Minus className="w-3 h-3" />
        flat vs yesterday
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        isUp
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-500 dark:text-red-400"
      }`}
    >
      {isUp ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {isUp ? "+" : ""}
      {change.toFixed(1)}% vs yesterday
      {formatPrior && (
        <span className="font-normal text-slate-400 ml-0.5">
          ({formatPrior(priorValue)})
        </span>
      )}
    </span>
  );
}

function MiniSparkline({
  data,
  dataKey,
  color = "#1c6a1e",
}: {
  data: { value: number }[];
  dataKey?: string;
  color?: string;
}) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (w - padding * 2);
      const y = h - padding - ((v - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      className="opacity-70"
      aria-hidden
      data-key={dataKey}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub: React.ReactNode;
  icon: React.ElementType;
  sparkline?: { value: number }[];
  href?: string;
  accent?: "green" | "slate" | "amber";
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  sparkline,
  href,
  accent = "green",
}: KpiCardProps) {
  const accents = {
    green:
      "border-[#1c6a1e]/20 dark:border-[#1c6a1e]/30 from-[#1c6a1e]/8 to-transparent",
    slate: "border-slate-200 dark:border-slate-700 from-slate-500/5 to-transparent",
    amber:
      "border-amber-200 dark:border-amber-800/40 from-amber-500/10 to-transparent",
  };
  const iconStyles = {
    green: "text-[#1c6a1e] bg-[#1c6a1e]/10",
    slate: "text-slate-500 bg-slate-100 dark:bg-slate-800",
    amber: "text-amber-600 bg-amber-100 dark:bg-amber-950/50",
  };

  const inner = (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br ${accents[accent]} bg-white dark:bg-[#1c2e18] p-4 shadow-sm h-full`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconStyles[accent]}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        {sparkline && <MiniSparkline data={sparkline} />}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
        {value}
      </p>
      <div className="mt-1">{sub}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-95 transition-opacity">
        {inner}
      </Link>
    );
  }

  return inner;
}

export function AtAGlanceStats({ stats, loading }: AtAGlanceStatsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[#1c6a1e]" />
      </div>
    );
  }

  if (!stats) return null;

  const { yesterday, today, sparkline } = stats;
  const revenueSpark = sparkline.map((d) => ({ value: d.revenue }));
  const profitSpark = sparkline.map((d) => ({ value: d.profit }));

  const revenueChange = pctChange(today.totalSales, yesterday.totalSales);
  const profitChange = pctChange(today.totalProfit, yesterday.totalProfit);
  const transactionsChange = pctChange(today.salesCount, yesterday.salesCount);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            How&apos;s today going?
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Yesterday: {formatKes(yesterday.totalSales)} ·{" "}
            {yesterday.salesCount} transactions
          </p>
        </div>
        <Link
          href="/admin/reports/daily"
          className="text-xs font-medium text-[#1c6a1e] hover:underline shrink-0"
        >
          Full report →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Today's revenue"
          value={formatKes(today.totalSales)}
          sub={
            <TrendBadge
              change={revenueChange}
              priorValue={yesterday.totalSales}
              formatPrior={formatKes}
            />
          }
          icon={DollarSign}
          sparkline={revenueSpark}
          href="/admin/sales"
        />
        <KpiCard
          label="Today's profit"
          value={formatKes(today.totalProfit)}
          sub={
            <div className="space-y-0.5">
              <TrendBadge
                change={profitChange}
                priorValue={yesterday.totalProfit}
                formatPrior={formatKes}
              />
              <p className="text-[10px] text-slate-400">
                {(today.profitMargin * 100).toFixed(1)}% margin
              </p>
            </div>
          }
          icon={TrendingUp}
          sparkline={profitSpark}
          href="/admin/profit"
        />
        <KpiCard
          label="Transactions"
          value={String(today.salesCount)}
          sub={
            <TrendBadge
              change={transactionsChange}
              priorValue={yesterday.salesCount}
              formatPrior={(n) => `${n} sales`}
            />
          }
          icon={ShoppingCart}
          href="/admin/transactions"
        />
        <KpiCard
          label="Needs attention"
          value={String(today.lowStockCount)}
          sub={
            <p className="text-[10px] text-slate-400">
              {today.lowStockCount === 0
                ? "Stock levels look good"
                : "items at or below minimum"}
            </p>
          }
          icon={Package}
          accent={today.lowStockCount > 0 ? "amber" : "slate"}
          href="/admin/stock"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-2.5 text-center">
          <Percent className="w-3.5 h-3.5 text-[#1c6a1e] mx-auto mb-1" />
          <p className="text-[10px] text-slate-500">Margin</p>
          <p className="text-xs font-bold text-[#1c6a1e]">
            {(today.profitMargin * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-2.5 text-center">
          <Package className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
          <p className="text-[10px] text-slate-500">Products</p>
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {stats.totalProducts}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] p-2.5 text-center">
          <DollarSign className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
          <p className="text-[10px] text-slate-500">Cost</p>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {formatKes(today.totalCost)}
          </p>
        </div>
      </div>
    </section>
  );
}
