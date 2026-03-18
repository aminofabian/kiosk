'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { Loader2, BarChart3 } from 'lucide-react';

const formatPrice = (n: number) =>
  `KES ${Math.round(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const tooltipFormatter = (v: unknown) => formatPrice(Number(v ?? 0));

const CHART_COLORS = [
  '#1c6a1e',
  '#0ea5e9',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7' | '14' | '30'>('14');

  const [profitData, setProfitData] = useState<{
    totalSales: number;
    totalProfit: number;
    totalCost: number;
    totalTransactions: number;
    profitMargin: number;
  } | null>(null);

  const [salesAnalytics, setSalesAnalytics] = useState<{
    salesByItemType: { item_type: string; revenue: number; profit: number }[];
    salesByPaymentMethod: { payment_method: string; total: number; count: number }[];
  } | null>(null);

  const [dailyData, setDailyData] = useState<{
    dailySales: { date_label: string; date_key: string; total_revenue: number; total_profit: number }[];
    categoryBreakdown: { category_name: string; total_revenue: number; total_profit: number }[];
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const days = parseInt(period, 10);
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const start = new Date(end);
      start.setDate(start.getDate() - days + 1);
      start.setHours(0, 0, 0, 0);
      const startTs = Math.floor(start.getTime() / 1000);
      const endTs = Math.floor(end.getTime() / 1000);

      const [profitRes, salesRes, dailyRes] = await Promise.all([
        fetch(`/api/profit?start=${startTs}&end=${endTs}`).then((r) => r.json()),
        fetch(`/api/sales/analytics?period=${days <= 7 ? 'week' : days <= 14 ? 'week' : 'month'}`).then((r) => r.json()),
        fetch(`/api/sales/analytics/daily?days=${days}&itemType=retail`).then((r) => r.json()),
      ]);

      if (profitRes.success && profitRes.data) {
        setProfitData({
          totalSales: profitRes.data.totalSales ?? 0,
          totalProfit: profitRes.data.totalProfit ?? profitRes.data.grossProfit ?? 0,
          totalCost: profitRes.data.totalCost ?? 0,
          totalTransactions: profitRes.data.totalTransactions ?? 0,
          profitMargin: profitRes.data.profitMargin ?? profitRes.data.grossMargin ?? 0,
        });
      } else {
        setProfitData(null);
      }

      if (salesRes.success && salesRes.data) {
        setSalesAnalytics({
          salesByItemType: salesRes.data.salesByItemType ?? [],
          salesByPaymentMethod: (salesRes.data.salesByPaymentMethod ?? []).map((p: { payment_method: string; total: number; count: number }) => ({
            payment_method: p.payment_method,
            total: p.total,
            count: p.count,
          })),
        });
      } else {
        setSalesAnalytics(null);
      }

      if (dailyRes.success && dailyRes.data) {
        setDailyData({
          dailySales: dailyRes.data.dailySales ?? [],
          categoryBreakdown: dailyRes.data.categoryBreakdown ?? [],
        });
      } else {
        setDailyData(null);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSales = profitData?.totalSales ?? 0;
  const totalProfit = profitData?.totalProfit ?? 0;
  const totalTransactions = profitData?.totalTransactions ?? 0;
  const profitMargin = profitData?.profitMargin ?? 0;

  const salesByType = salesAnalytics?.salesByItemType ?? [];
  const paymentMethods = salesAnalytics?.salesByPaymentMethod ?? [];
  const dailySales = dailyData?.dailySales ?? [];
  const categoryBreakdown = dailyData?.categoryBreakdown ?? [];

  const totalRevenue = salesByType.reduce((s, t) => s + t.revenue, 0) || totalSales;
  const totalByType = salesByType.reduce((s, t) => s + t.revenue, 0) || 1;

  const lineChartData = [...dailySales].reverse().map((d) => ({
    name: d.date_label,
    revenue: d.total_revenue,
    profit: d.total_profit,
  }));

  const TOP_PIE_SLICES = 8;
  const categoryWithRevenue = categoryBreakdown.filter((c) => c.total_revenue > 0);
  const sortedByRevenue = [...categoryWithRevenue].sort((a, b) => b.total_revenue - a.total_revenue);
  const topForPie = sortedByRevenue.slice(0, TOP_PIE_SLICES);
  const restRevenue = sortedByRevenue.slice(TOP_PIE_SLICES).reduce((s, c) => s + c.total_revenue, 0);
  const pieData = [
    ...topForPie.map((c) => ({ name: c.category_name, value: c.total_revenue })),
    ...(restRevenue > 0 ? [{ name: 'Other', value: restRevenue }] : []),
  ];

  const horizontalBarData = salesByType
    .filter((t) => t.revenue > 0)
    .map((t) => ({
      name: t.item_type.replace(/_/g, ' '),
      revenue: t.revenue,
      profit: t.profit,
      fill: CHART_COLORS[salesByType.indexOf(t) % CHART_COLORS.length],
    }));

  const paymentBarData = paymentMethods
    .filter((p) => p.total > 0)
    .map((p) => ({
      name: p.payment_method.charAt(0).toUpperCase() + p.payment_method.slice(1),
      amount: p.total,
      count: p.count,
    }));

  const topCategoriesBar = categoryBreakdown
    .filter((c) => c.total_revenue > 0)
    .slice(0, 6)
    .map((c) => ({ name: c.category_name.length > 12 ? c.category_name.slice(0, 12) + '…' : c.category_name, revenue: c.total_revenue }));

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#1c6a1e]" />
            <p className="text-slate-500 dark:text-slate-400">Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-lg bg-[#1c6a1e] text-white font-medium hover:bg-[#1a7a69]"
            >
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d]">
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c6a1e] flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                    Analytics
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Overview of sales, profit, and trends
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['7', '14', '30'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setPeriod(d)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      period === d
                        ? 'bg-[#1c6a1e] text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
          {/* Top row: Status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Revenue
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{formatPrice(totalSales)}</p>
                <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, (totalSales / (totalSales + 1)) * 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Profit
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    Margin
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{formatPrice(totalProfit)}</p>
                <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (profitMargin || 0) * 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Orders
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    Count
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{totalTransactions.toLocaleString()}</p>
                <div className="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(100, totalTransactions > 0 ? 100 : 0)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle row: Big stats + horizontal bar + vertical bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium truncate">Total Sales</p>
                    <p className="text-lg font-bold text-[#1c6a1e] truncate" title={formatPrice(totalSales)}>
                      {totalSales >= 1000 ? `${(totalSales / 1000).toFixed(1)}K` : formatPrice(totalSales)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium truncate">Total Profit</p>
                    <p className="text-lg font-bold text-blue-600 truncate" title={formatPrice(totalProfit)}>
                      {totalProfit >= 1000 ? `${(totalProfit / 1000).toFixed(1)}K` : formatPrice(totalProfit)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium truncate">Transactions</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{totalTransactions.toLocaleString()}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium truncate">Margin</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{((profitMargin || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Revenue by Type
                </CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-hidden">
                {horizontalBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={horizontalBarData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={tooltipFormatter} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="h-48 overflow-hidden">
                {paymentBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentBarData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                      <Tooltip formatter={tooltipFormatter} />
                      <Bar dataKey="amount" fill="#1c6a1e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom row: Pie + Line + Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Category Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="h-56 overflow-hidden">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-56 overflow-hidden">
                {lineChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lineChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1c6a1e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1c6a1e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                      <Tooltip formatter={tooltipFormatter} />
                      <Area type="monotone" dataKey="revenue" stroke="#1c6a1e" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Top Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="h-56 overflow-hidden">
                {topCategoriesBar.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCategoriesBar} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                      <Tooltip formatter={tooltipFormatter} />
                      <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
