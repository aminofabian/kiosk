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
} from 'lucide-react';
import { apiFetch } from '@/lib/utils/api-client';
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
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  uniqueProductsSold: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface TopSeller {
  item_id: string;
  item_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  item_type: string;
}

interface SalesOverviewData {
  summary: SalesSummary;
  salesByPaymentMethod: { payment_method: string; count: number; total: number }[];
  salesByItemType: TypeBreakdown[];
  topSellers?: TopSeller[];
  noSalesItems?: unknown[];
}

const PAYMENT_METHOD_ICONS: Record<string, typeof Wallet> = {
  cash: Wallet,
  mpesa: Smartphone,
  credit: CreditCard,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  credit: 'Credit',
};

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatNumber = (num: number) =>
  num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
] as const;

export default function SalesHubPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { productTypes } = useItemTypes();
  const [data, setData] = useState<SalesOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week'>('today');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<SalesOverviewData>(`/api/sales/analytics?period=${period}`, { cache: 'no-store' });
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load data');
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
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1a0d]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1c6a1e] flex items-center justify-center rounded">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">Sales Overview</h1>
              <div className="flex gap-1 mt-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${period === p.key ? 'bg-[#1c6a1e] text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="h-7 text-xs">
            Refresh
          </Button>
        </div>

        <div className="flex-1 min-h-0 p-3 overflow-auto">
          {/* Row 1: Key metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <ShoppingCart className="w-4 h-4 text-white/80" />
                  <span className="text-[9px] text-white/80">{formatNumber(data.summary.totalTransactions)} orders</span>
                </div>
                <p className="text-[10px] text-blue-100 font-medium">Revenue</p>
                <p className="text-sm font-bold text-white">{formatPrice(data.summary.totalRevenue)}</p>
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
          </div>

          {/* Row 2: Secondary metrics + quick links */}
          <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              COGS: {formatPrice(data.summary.totalCost)}
            </span>
            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {data.summary.uniqueProductsSold} products sold
            </span>
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

            {/* Top Sellers */}
            <div className="lg:col-span-4">
              <Card className="border border-slate-200 dark:border-slate-700 h-full">
                <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    Top Sellers
                  </CardTitle>
                  <Link href="/admin/profit" className="text-[10px] text-[#1c6a1e] hover:underline">Details</Link>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  {(data.topSellers?.length ?? 0) > 0 ? (
                    <div className="space-y-1.5">
                      {(data.topSellers ?? []).slice(0, 5).map((item, i) => (
                        <div key={item.item_id} className="flex items-center justify-between py-1 px-2 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-slate-400 w-4 shrink-0">#{i + 1}</span>
                            <span className="font-medium truncate">{item.item_name}</span>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-bold">{formatNumber(item.total_quantity_sold)} sold</span>
                            <span className="text-slate-500 ml-1">· {formatPrice(item.total_revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 py-2">No sales yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment + Comparison */}
            <div className="lg:col-span-3 space-y-3">
              {data.salesByPaymentMethod.length > 0 && (
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
