'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  AlertTriangle,
  Wallet,
  Smartphone,
  CreditCard,
  DollarSign,
} from 'lucide-react';

const PAYMENT_ICONS: Record<string, typeof Wallet> = {
  cash: Wallet,
  mpesa: Smartphone,
  credit: CreditCard,
  split: DollarSign,
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  credit: 'Credit',
  split: 'Split',
};

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDateLabel = (dateStr: string) => {
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
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface SaleItem {
  item_name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
}

interface Sale {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  sale_date: number;
  created_at: number;
  user_name: string | null;
  items: SaleItem[];
}

interface TransactionsData {
  date: string;
  sales: Sale[];
  totalAmount: number;
  totalCount: number;
  completedCount: number;
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();

  const todayStr = toDateStr(new Date());
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toDateStr(d);
  })();
  const dayBeforeStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return toDateStr(d);
  })();

  const [date, setDate] = useState(() => {
    const d = searchParams.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return todayStr;
  });

  type FilterPreset = 'today' | 'yesterday' | 'dayBefore' | 'custom';
  const [filterMode, setFilterMode] = useState<FilterPreset>(() => {
    const d = searchParams.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      if (d === todayStr) return 'today';
      if (d === yesterdayStr) return 'yesterday';
      if (d === dayBeforeStr) return 'dayBefore';
      return 'custom';
    }
    return 'today';
  });

  useEffect(() => {
    const d = searchParams.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== date) {
      setDate(d);
      if (d === todayStr) setFilterMode('today');
      else if (d === yesterdayStr) setFilterMode('yesterday');
      else if (d === dayBeforeStr) setFilterMode('dayBefore');
      else setFilterMode('custom');
    }
  }, [searchParams]);

  const [data, setData] = useState<TransactionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/sales/by-date?date=${date}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load');
      }
    } catch {
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('date', date);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [date]);

  const goPrevDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    const newDate = toDateStr(d);
    setDate(newDate);
    if (newDate === todayStr) setFilterMode('today');
    else if (newDate === yesterdayStr) setFilterMode('yesterday');
    else if (newDate === dayBeforeStr) setFilterMode('dayBefore');
    else setFilterMode('custom');
  };

  const goNextDay = () => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const newDate = toDateStr(d);
    setDate(newDate);
    if (newDate === todayStr) setFilterMode('today');
    else if (newDate === yesterdayStr) setFilterMode('yesterday');
    else if (newDate === dayBeforeStr) setFilterMode('dayBefore');
    else setFilterMode('custom');
  };

  const isToday = date === todayStr;
  const maxDate = todayStr;

  const setFilter = (preset: FilterPreset) => {
    setFilterMode(preset);
    if (preset === 'today') setDate(todayStr);
    else if (preset === 'yesterday') setDate(yesterdayStr);
    else if (preset === 'dayBefore') setDate(dayBeforeStr);
    // custom: date picker handles changes
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-white dark:bg-[#0f1a0d]">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white dark:bg-[#0f1a0d] border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-8 py-5">
            <div className="max-w-4xl mx-auto space-y-5">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Transactions
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatDateLabel(date)}
                </p>
              </div>

              {/* Date filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setFilter('today')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      filterMode === 'today'
                        ? 'bg-[#259783] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setFilter('yesterday')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      filterMode === 'yesterday'
                        ? 'bg-[#259783] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => setFilter('dayBefore')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      filterMode === 'dayBefore'
                        ? 'bg-[#259783] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Day before
                  </button>
                  <button
                    onClick={() => setFilter('custom')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      filterMode === 'custom'
                        ? 'bg-[#259783] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Custom
                  </button>
                </div>

                {filterMode === 'custom' && (
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDate(v);
                        if (v === todayStr) setFilterMode('today');
                        else if (v === yesterdayStr) setFilterMode('yesterday');
                        else if (v === dayBeforeStr) setFilterMode('dayBefore');
                      }}
                      max={maxDate}
                      className="h-9 border-0 bg-transparent p-0 text-sm font-medium focus-visible:ring-0"
                    />
                  </div>
                )}

                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={goPrevDay}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={goNextDay}
                    disabled={isToday}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="text-center py-32 space-y-4">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
              <p className="text-slate-600 dark:text-slate-300">{error}</p>
              <Button onClick={fetchData} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : data ? (
            <>
              {/* Summary */}
              <div className="mb-8 flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {data.completedCount} sale{data.completedCount !== 1 ? 's' : ''}
                    {data.sales.filter((s) => s.status === 'voided').length > 0 && (
                      <span className="text-red-500 dark:text-red-400 ml-2">
                        · {data.sales.filter((s) => s.status === 'voided').length} voided
                      </span>
                    )}
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-0.5">
                    {formatPrice(data.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Transaction list — receipt-style cards */}
              {data.sales.length === 0 ? (
                <div className="text-center py-24 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <Receipt className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No transactions</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Select another date</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.sales.map((sale) => {
                    const PaymentIcon = PAYMENT_ICONS[sale.payment_method] || Wallet;
                    const isVoided = sale.status === 'voided';
                    return (
                      <article
                        key={sale.id}
                        className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
                          isVoided
                            ? 'border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                        }`}
                      >
                        {/* Row 1: Meta */}
                        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-700/50">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
                              {formatTime(sale.sale_date)}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                isVoided
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <PaymentIcon className="w-3.5 h-3.5" />
                              {PAYMENT_LABELS[sale.payment_method] || sale.payment_method}
                            </span>
                            {sale.user_name && (
                              <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
                                {sale.user_name}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-lg font-semibold tabular-nums ${
                              isVoided ? 'text-red-600 dark:text-red-400 line-through' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatPrice(sale.total_amount)}
                          </span>
                        </div>

                        {/* Row 2: Items */}
                        <div className="px-5 py-4">
                          <table className="w-full text-sm">
                            <tbody>
                              {sale.items.map((item, i) => (
                                <tr
                                  key={`${sale.id}-${i}`}
                                  className="border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                                >
                                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                                    {item.item_name}
                                    <span className="text-slate-400 dark:text-slate-500 ml-1.5">
                                      × {item.quantity_sold.toFixed(item.quantity_sold % 1 === 0 ? 0 : 1)}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                                    {formatPrice(item.quantity_sold * item.sell_price_per_unit)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </AdminLayout>
  );
}
