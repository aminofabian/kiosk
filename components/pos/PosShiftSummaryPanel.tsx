'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Clock,
  History,
  Loader2,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/utils/api-client';
import type { Shift } from '@/lib/db/types';

interface ShiftSummaryData {
  sales: { count: number; total: number };
  salesBreakdown?: {
    fullCashSales: { count: number; total: number };
    splitCashSales: { count: number; total: number };
  };
  creditPayments: { count: number; total: number };
  cashExpenses: { count: number; total: number };
  dailyOperatingCost?: number;
  expensesList?: Array<{
    id: string;
    name: string;
    amount: number;
    created_at: number;
  }>;
}

interface PosShiftSummaryPanelProps {
  shift: Shift;
}

function formatPrice(n: number) {
  return `KES ${n.toLocaleString('en-US')}`;
}

function formatTime(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PosShiftSummaryPanel({ shift }: PosShiftSummaryPanelProps) {
  const [summary, setSummary] = useState<ShiftSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await apiGet<ShiftSummaryData>(`/api/shifts/${shift.id}/summary`);
        if (!cancelled && result.success) {
          setSummary(result.data ?? null);
        }
      } catch (err) {
        console.error('Error loading shift summary:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shift.id]);

  const expectedDrawer =
    shift.opening_cash +
    (summary?.sales.total ?? 0) +
    (summary?.creditPayments.total ?? 0) -
    (summary?.cashExpenses.total ?? 0) -
    (summary?.dailyOperatingCost ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Started</p>
          <p className="text-sm font-semibold mt-1">{formatTime(shift.started_at)}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Opening float</p>
          <p className="text-sm font-semibold mt-1 tabular-nums">{formatPrice(shift.opening_cash)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#1c6a1e]" />
        </div>
      ) : summary ? (
        <>
          <div className="space-y-2">
            <SummaryRow
              icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
              label="Cash sales"
              value={formatPrice(summary.sales.total)}
              sub={`${summary.sales.count} transaction${summary.sales.count === 1 ? '' : 's'}`}
            />
            <SummaryRow
              icon={<Banknote className="w-4 h-4 text-blue-600" />}
              label="Credit payments"
              value={formatPrice(summary.creditPayments.total)}
              sub={`${summary.creditPayments.count} collected`}
            />
            <SummaryRow
              icon={<Wallet className="w-4 h-4 text-rose-500" />}
              label="Cash expenses"
              value={formatPrice(summary.cashExpenses.total)}
              sub={`${summary.cashExpenses.count} recorded`}
            />
            {(summary.dailyOperatingCost ?? 0) > 0 && (
              <SummaryRow
                icon={<TrendingDown className="w-4 h-4 text-amber-600" />}
                label="Daily operating"
                value={formatPrice(summary.dailyOperatingCost ?? 0)}
                sub="Fixed daily costs"
              />
            )}
          </div>

          <div className="p-4 rounded-xl border-2 border-[#1c6a1e]/25 bg-[#1c6a1e]/5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Expected in drawer</p>
            <p className="text-2xl font-black text-[#1c6a1e] tabular-nums mt-1">
              {formatPrice(expectedDrawer)}
            </p>
          </div>

          {summary.expensesList && summary.expensesList.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Recent expenses
              </p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {summary.expensesList.slice(0, 8).map((exp) => (
                  <li
                    key={exp.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="truncate pr-2">{exp.name}</span>
                    <span className="tabular-nums font-medium shrink-0">
                      {formatPrice(exp.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Could not load shift summary.</p>
      )}

      <Link href="/admin/shifts" className="block">
        <Button variant="outline" className="w-full gap-2">
          <History className="w-4 h-4" />
          Shift history
        </Button>
      </Link>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
