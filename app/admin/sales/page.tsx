'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Package,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Wallet,
  Smartphone,
  CreditCard,
  Trophy,
  Receipt,
  ExternalLink,
  Banknote,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils/api-client';
import { getSalesPeriodRange } from '@/lib/utils/sales-period';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import Link from 'next/link';

interface TypeBreakdown {
  item_type: string;
  transaction_count: number;
  items_sold: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface SalesSummary {
  totalTransactions: number;
  totalItemsSold: number;
  totalRevenue: number;
  transactionRevenue: number;
  salesWithoutItemsCount: number;
  salesWithoutItemsValue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  uniqueProductsSold: number;
  lowStockCount: number;
  outOfStockCount: number;
  cappedLines: number;
  zeroCostLines: number;
}

interface TopSeller {
  item_id: string;
  item_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  item_type: string;
}

interface TopSellerByType {
  item_id: string;
  item_name: string;
  total_quantity_sold: number;
  total_revenue: number;
}

interface SalesOverviewData {
  summary: SalesSummary;
  salesByPaymentMethod: { payment_method: string; count: number; total: number }[];
  salesByItemType: TypeBreakdown[];
  topSellers?: TopSeller[];
  topSellersByType?: Record<string, TopSellerByType[]>;
  creditPaid?: { total: number; count: number };
  noSalesItems?: unknown[];
}

const PAYMENT_METHOD_ICONS: Record<string, typeof Wallet> = {
  cash: Wallet,
  mpesa: Smartphone,
  credit: CreditCard,
  wallet: Wallet,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  credit: 'Credit',
  wallet: 'Wallet',
};

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatNumber = (num: number) =>
  num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const PERIODS: { key: string; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '3days', label: 'Last 3 days' },
  { key: '4days', label: 'Last 4 days' },
  { key: '5days', label: 'Last 5 days' },
  { key: '6days', label: 'Last 6 days' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All time' },
];

interface DrawerInfo {
  shiftId: string;
  cashierName: string;
  openingCash: number;
  expectedCash: number;
}

export default function SalesHubPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { productTypes } = useItemTypes();
  const [data, setData] = useState<SalesOverviewData | null>(null);
  const [drawers, setDrawers] = useState<DrawerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('today');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { start, end } = getSalesPeriodRange(period);
      const rangeParams = new URLSearchParams({ period, start: String(start) });
      if (end !== null) rangeParams.set('end', String(end));

      const [analyticsRes, drawersRes] = await Promise.all([
        apiFetch<SalesOverviewData>(`/api/sales/analytics?${rangeParams.toString()}`, { cache: 'no-store' }),
        apiFetch<{ drawers: DrawerInfo[] }>('/api/shifts/drawers', { cache: 'no-store' }),
      ]);
      if (analyticsRes.success && analyticsRes.data) {
        setData(analyticsRes.data);
      } else {
        setError(analyticsRes.message || 'Failed to load data');
      }
      if (drawersRes.success && drawersRes.data?.drawers) {
        setDrawers(drawersRes.data.drawers);
      } else {
        setDrawers([]);
      }
    } catch {
      setError('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!user || user.role === 'cashier') return;
    fetchData();
  }, [fetchData, user, period]);

  // If user is a cashier, hide summaries entirely
  if (user && user.role === 'cashier') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-slate-700 dark:text-slate-200 font-semibold">
              Sales summaries are only available to admins and owners.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading || userLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
            <p className="text-slate-500 dark:text-slate-400">Loading sales overview...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
            <Button onClick={fetchData} variant="outline">Try Again</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const getTypeData = (key: string) => data.salesByItemType?.find(t => t.item_type === key);

  return (
    <AdminLayout>
      <div className="h-full min-h-0 flex flex-col">
        {/* Header with period selector */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1a0d]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-[#1c6a1e] flex items-center justify-center rounded shrink-0">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Sales Overview</h1>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-0.5 text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-[#1c6a1e] focus:outline-none max-w-full"
              >
                {PERIODS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="h-7 text-xs shrink-0">
            Refresh
          </Button>
        </div>

        <div className="flex-1 min-h-0 p-3 overflow-auto">
          {/* Data Quality Banner */}
          {(data.summary.cappedLines > 0 || data.summary.zeroCostLines > 0 || data.summary.salesWithoutItemsCount > 0) && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Data quality notice</p>
                  <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5">
                    {data.summary.salesWithoutItemsCount > 0 && (
                      <li>
                        {data.summary.salesWithoutItemsCount.toLocaleString()} sale{data.summary.salesWithoutItemsCount !== 1 ? 's' : ''} ({formatPrice(data.summary.salesWithoutItemsValue)}) have no item lines and are excluded from profit/COGS.
                      </li>
                    )}
                    {data.summary.cappedLines > 0 && (
                      <li>{data.summary.cappedLines.toLocaleString()} sale line{data.summary.cappedLines !== 1 ? 's' : ''} had extreme cost prices capped.</li>
                    )}
                    {data.summary.zeroCostLines > 0 && (
                      <li>{data.summary.zeroCostLines.toLocaleString()} sale line{data.summary.zeroCostLines !== 1 ? 's' : ''} had no known cost and were estimated at 85% of sell price.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Row 1: Key metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-3">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <ShoppingCart className="w-4 h-4 text-white/80" />
                  <span className="text-[9px] text-white/80">{formatNumber(data.summary.totalTransactions)} orders</span>
                </div>
                <p className="text-[10px] text-blue-100 font-medium">Revenue</p>
                <p className="text-sm font-bold text-white">{formatPrice(data.summary.totalRevenue)}</p>
                {data.summary.salesWithoutItemsCount > 0 && (
                  <p className="text-[9px] text-blue-100/80 mt-0.5">
                    + {formatPrice(data.summary.salesWithoutItemsValue)} from {data.summary.salesWithoutItemsCount} un-itemized sale{data.summary.salesWithoutItemsCount !== 1 ? 's' : ''}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <TrendingUp className="w-4 h-4 text-white/80" />
                  <span className="text-[9px] text-white/80">{data.summary.profitMargin.toFixed(1)}% margin</span>
                </div>
                <p className="text-[10px] text-green-100 font-medium">Profit</p>
                <p className="text-sm font-bold text-white">{formatPrice(data.summary.totalProfit)}</p>
                <p className="text-[9px] text-green-100/80 mt-0.5">COGS: {formatPrice(data.summary.totalCost)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-600 to-slate-700 border-0 shadow">
              <CardContent className="p-2">
                <Receipt className="w-4 h-4 text-white/80" />
                <p className="text-[10px] text-slate-200 font-medium">Avg Order</p>
                <p className="text-sm font-bold text-white">
                  {data.summary.totalTransactions > 0
                    ? formatPrice(data.summary.totalRevenue / data.summary.totalTransactions)
                    : '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow">
              <CardContent className="p-2">
                <Package className="w-4 h-4 text-white/80" />
                <p className="text-[10px] text-purple-100 font-medium">Items Sold</p>
                <p className="text-sm font-bold text-white">{formatNumber(data.summary.totalItemsSold)}</p>
              </CardContent>
            </Card>
            <Link href="/admin/items">
              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow hover:opacity-95 transition-opacity cursor-pointer h-full">
                <CardContent className="p-2">
                  <div className="flex items-center justify-between">
                    <AlertTriangle className="w-4 h-4 text-white/80" />
                    <ExternalLink className="w-3 h-3 text-white/60" />
                  </div>
                  <p className="text-[10px] text-orange-100 font-medium">Stock Alerts</p>
                  <div className="flex gap-2 text-white text-sm font-bold">
                    <span>{data.summary.outOfStockCount} out</span>
                    <span>{data.summary.lowStockCount} low</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/balance/approvals">
              <Card className="bg-gradient-to-br from-amber-600 to-amber-700 border-0 shadow hover:opacity-95 transition-opacity cursor-pointer h-full">
                <CardContent className="p-2">
                  <div className="flex items-center justify-between">
                    <Banknote className="w-4 h-4 text-white/80" />
                    <ExternalLink className="w-3 h-3 text-white/60" />
                  </div>
                  <p className="text-[10px] text-amber-100 font-medium">Cash in Drawers</p>
                  <p className="text-sm font-bold text-white">
                    {drawers.length > 0
                      ? formatPrice(drawers.reduce((sum, d) => sum + d.expectedCash, 0))
                      : '—'}
                  </p>
                  {drawers.length > 0 && (
                    <p className="text-[9px] text-amber-200/90">{drawers.length} drawer{drawers.length !== 1 ? 's' : ''} open</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Row 2: Secondary metrics + quick links */}
          <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              COGS: {formatPrice(data.summary.totalCost)}
            </span>
            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {data.summary.uniqueProductsSold} products sold
            </span>
            {(data.creditPaid?.total ?? 0) > 0 && (
              <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-medium">
                Credit paid: {formatPrice(data.creditPaid!.total)} ({data.creditPaid!.count} payments)
              </span>
            )}
            {(data.noSalesItems?.length ?? 0) > 0 && (
              <Link href="/admin/items" className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:underline">
                {(data.noSalesItems ?? []).length} items with no sales
              </Link>
            )}
            <Link href="/admin/transactions" className="px-2 py-1 rounded bg-[#1c6a1e]/10 text-[#1c6a1e] dark:text-[#2a8a30] hover:underline flex items-center gap-1">
              View transactions <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Department Cards */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-2">
              {productTypes.map((t) => {
                const typeData = getTypeData(t.key);
                const color = t.color ?? '#22c55e';
                return (
                  <Link key={t.key} href={`/admin/sales/${t.key}`} className="block group">
                    <Card className="border transition-all hover:shadow-md h-full" style={{ borderColor: `${color}40` }}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xl" aria-hidden>{t.emoji}</span>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-all" style={{ color: typeData ? color : undefined }} />
                        </div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{t.label}</h2>
                        {typeData ? (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                            <span className="font-bold" style={{ color }}>{formatPrice(typeData.revenue)}</span>
                            <span className="text-slate-500">{formatNumber(typeData.items_sold)} items</span>
                            <span className="text-slate-400">· {formatPrice(typeData.profit)} profit</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">No sales</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Top Sellers by Type */}
            <div className="lg:col-span-4">
              <Card className="border border-slate-200 dark:border-slate-700 h-full">
                <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    Top Sellers by Type
                  </CardTitle>
                  <Link href="/admin/profit" className="text-[10px] text-[#1c6a1e] hover:underline">Details</Link>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  {productTypes.length > 0 && Object.keys(data.topSellersByType ?? {}).length > 0 ? (
                    <div className="space-y-3">
                      {productTypes.map((t) => {
                        const typeSellers = (data.topSellersByType ?? {})[t.key] ?? [];
                        if (typeSellers.length === 0) return null;
                        const color = t.color ?? '#22c55e';
                        return (
                          <div key={t.key}>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <span aria-hidden>{t.emoji}</span> {t.label}
                            </p>
                            <div className="space-y-1">
                              {typeSellers.slice(0, 5).map((item, i) => (
                                <div key={`${t.key}-${item.item_id}`} className="flex items-center justify-between py-0.5 px-2 bg-slate-50 dark:bg-slate-800 rounded text-[11px]">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-slate-400 w-3 shrink-0">#{i + 1}</span>
                                    <span className="truncate">{item.item_name}</span>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span className="font-bold" style={{ color }}>{formatNumber(item.total_quantity_sold)}</span>
                                    <span className="text-slate-500 ml-0.5">· {formatPrice(item.total_revenue)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 py-2">No sales yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment + Comparison */}
            <div className="lg:col-span-3 space-y-3">
              {(data.salesByPaymentMethod.length > 0 || (data.creditPaid?.total ?? 0) > 0) && (
                <Card className="border border-slate-200 dark:border-slate-700">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-[#1c6a1e]" />
                      Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <div className="space-y-1.5">
                      {data.salesByPaymentMethod.map((pm) => {
                        const Icon = PAYMENT_METHOD_ICONS[pm.payment_method] || Wallet;
                        return (
                          <div key={pm.payment_method} className="flex items-center justify-between py-1 px-2 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-[#1c6a1e]" />
                              <span className="font-medium">{PAYMENT_METHOD_LABELS[pm.payment_method] || pm.payment_method}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 dark:text-white">{formatPrice(pm.total)}</span>
                              <span className="text-slate-500 ml-1">({pm.count})</span>
                            </div>
                          </div>
                        );
                      })}
                      {(data.creditPaid?.total ?? 0) > 0 && (
                        <div className="flex items-center justify-between py-1 px-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-xs">
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-medium">Credit paid</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatPrice(data.creditPaid!.total)}</span>
                            <span className="text-slate-500 ml-1">({data.creditPaid!.count})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.salesByItemType && data.salesByItemType.length > 0 && (
                <Card className="border border-slate-200 dark:border-slate-700">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-[#1c6a1e]" />
                      By Dept
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    {(() => {
                      const totalRevenue = data.salesByItemType.reduce((sum, t) => sum + t.revenue, 0);
                      return (
                        <div className="space-y-2">
                          {data.salesByItemType.map((typeRow) => {
                            const pct = totalRevenue > 0 ? (typeRow.revenue / totalRevenue) * 100 : 0;
                            const typeConfig = productTypes.find((t) => t.key === typeRow.item_type);
                            const label = typeConfig?.label ?? typeRow.item_type;
                            const color = typeConfig?.color ?? '#22c55e';
                            return (
                              <div key={typeRow.item_type}>
                                <div className="flex items-center justify-between text-xs mb-0.5">
                                  <span>{typeConfig?.emoji ?? '📦'} {label}</span>
                                  <span className="font-bold">{formatPrice(typeRow.revenue)} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span></span>
                                </div>
                                <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
