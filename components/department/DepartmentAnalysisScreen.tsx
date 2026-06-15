'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useDepartmentApp } from '@/components/department/DepartmentAppProvider';
import { apiGet } from '@/lib/utils/api-client';
import { ANALYSIS_PERIODS, type AnalysisPeriod } from '@/lib/department/analysis-periods';

interface AnalysisData {
  periodLabel: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  stockLosses: number;
  expenses: number;
  supplySpend: number;
  netProfit: number;
  transactions: number;
  isProfit: boolean;
}

function formatKes(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function MetricRow({
  label,
  value,
  negative,
  muted,
}: {
  label: string;
  value: string;
  negative?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className={`text-xs ${muted ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
        {label}
      </span>
      <span
        className={`text-sm font-bold tabular-nums ${
          negative ? 'text-red-600' : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function DepartmentAnalysisScreen() {
  const { assignedTypes } = useDepartmentApp();
  const [period, setPeriod] = useState<AnalysisPeriod>('today');
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalysis = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const params = new URLSearchParams({ period });
        if (assignedTypes.length > 0) {
          params.set('itemTypes', assignedTypes.join(','));
        }
        const result = await apiGet<AnalysisData>(`/api/department/analysis?${params}`);
        if (result.success && result.data) {
          setData(result.data);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, assignedTypes],
  );

  useEffect(() => {
    void fetchAnalysis();
  }, [fetchAnalysis]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden bg-white dark:bg-[#132210]">
      <header className="shrink-0 safe-area-top border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2c17] px-3 py-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="w-4 h-4 text-[#1c6a1e] shrink-0" />
            <h1 className="text-sm font-bold uppercase tracking-wide truncate">Analysis</h1>
          </div>
          <button
            type="button"
            onClick={() => void fetchAnalysis(true)}
            disabled={refreshing}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-600 rounded-md hover:bg-slate-200/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {ANALYSIS_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold border ${
                period === p.key
                  ? 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                  : 'bg-white dark:bg-[#1c2e18] border-slate-200 dark:border-slate-700 text-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
          </div>
        ) : data ? (
          <>
            <div
              className={`rounded-xl p-4 border-2 ${
                data.isProfit
                  ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900'
                  : 'border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {data.periodLabel} · Net result
                  </p>
                  <p
                    className={`text-2xl font-black tabular-nums mt-1 ${
                      data.isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {formatKes(data.netProfit)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {data.isProfit ? 'Profit' : 'Loss'} after losses & expenses
                  </p>
                </div>
                {data.isProfit ? (
                  <TrendingUp className="w-8 h-8 text-emerald-600 shrink-0" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-red-600 shrink-0" />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2c17] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                Income
              </p>
              <MetricRow label="Sales revenue" value={formatKes(data.revenue)} />
              <MetricRow label="Cost of goods sold" value={formatKes(data.cogs)} negative />
              <MetricRow label="Gross profit" value={formatKes(data.grossProfit)} />
              <p className="text-[10px] text-slate-400 mt-2">{data.transactions} transactions</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2c17] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-red-500" />
                Outflows
              </p>
              <MetricRow label="Stock losses (damage/spoil)" value={formatKes(data.stockLosses)} negative />
              <MetricRow label="Expenses" value={formatKes(data.expenses)} negative />
              <MetricRow
                label="Supply purchases"
                value={formatKes(data.supplySpend)}
                muted
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed px-1">
              Net profit = gross profit from sales minus stock losses and expenses recorded in this
              period. Supply purchases add inventory and are shown for reference.
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-slate-500 py-12">No data available</p>
        )}
      </div>
    </div>
  );
}
