'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

const REFUND_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  wallet: 'Wallet credit',
  credit_note: 'Credit note',
};

const formatPrice = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const formatted = d.toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return isToday ? `Today · ${formatted}` : formatted;
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

interface SaleReturnRow {
  id: string;
  sale_id: string;
  refund_method: string;
  total_refund_amount: number;
  reason: string;
  mpesa_reference: string | null;
  created_at: number;
  processor_name: string | null;
  customer_name: string | null;
  item_count: number;
}

function ReturnsPageContent() {
  const searchParams = useSearchParams();
  const todayStr = toDateStr(new Date());
  const [date, setDate] = useState(searchParams.get('date') || todayStr);
  const [returns, setReturns] = useState<SaleReturnRow[]>([]);
  const [totalRefunded, setTotalRefunded] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{
        returns: SaleReturnRow[];
        total: number;
        totalRefunded: number;
      }>(`/api/sale-returns?date=${encodeURIComponent(date)}`);
      if (!res.success || !res.data) {
        setError(res.message || 'Failed to load returns');
        return;
      }
      setReturns(res.data.returns);
      setTotal(res.data.total);
      setTotalRefunded(res.data.totalRefunded);
    } catch {
      setError('Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(toDateStr(d));
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-violet-600" />
              Returns &amp; Refunds
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Partial and full refunds processed from POS. Also logged under Activity Log → Sale Return.
            </p>
          </div>
          <Link
            href="/admin/logs"
            className="text-sm text-[#1c6a1e] hover:underline flex items-center gap-1"
          >
            Activity log (filter: Sale Return) <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => shiftDate(1)} disabled={date >= todayStr}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(todayStr)}>
            Today
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Date</p>
            <p className="text-sm font-semibold mt-1">{formatDateLabel(date)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Returns</p>
            <p className="text-sm font-semibold mt-1">{total}</p>
          </div>
          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-violet-600 dark:text-violet-400 uppercase tracking-wide">
              Total refunded
            </p>
            <p className="text-lg font-bold text-violet-700 dark:text-violet-300 mt-1">
              {formatPrice(totalRefunded)}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
          </div>
        ) : error ? (
          <p className="text-center text-red-600 py-12">{error}</p>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-lg border-slate-200 dark:border-slate-700">
            <RotateCcw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No returns on this date</p>
            <p className="text-xs text-slate-400 mt-1">
              Process returns from POS → Returns button
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">Time</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Sale</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Method</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Reason</th>
                  <th className="px-4 py-3 font-medium text-slate-600">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span title={r.sale_id}>{r.sale_id.slice(0, 8).toUpperCase()}</span>
                      {r.customer_name && (
                        <span className="block text-slate-500 font-sans text-[11px] truncate max-w-[120px]">
                          {r.customer_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {REFUND_LABELS[r.refund_method] ?? r.refund_method}
                      {r.mpesa_reference && (
                        <span className="block text-[10px] text-slate-400">{r.mpesa_reference}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-violet-700 dark:text-violet-300">
                      {formatPrice(r.total_refund_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={r.reason}>
                      {r.reason}
                      <span className="block text-[10px] text-slate-400">
                        {r.item_count} item{r.item_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.processor_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
          </div>
        </AdminLayout>
      }
    >
      <ReturnsPageContent />
    </Suspense>
  );
}
