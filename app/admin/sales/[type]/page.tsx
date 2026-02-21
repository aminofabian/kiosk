'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Loader2,
  Search,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  Clock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  PackageX,
  Scale,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils/api-client';
import Link from 'next/link';
import { useItemTypes } from '@/lib/hooks/use-item-types';

// ─── Types ───────────────────────────────────────────────────────

interface DailySales {
  date_label: string;
  date_key: string;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_items_sold: number;
  transaction_count: number;
}

interface HourlySales {
  hour: number;
  revenue: number;
  items_sold: number;
  transaction_count: number;
}

interface CategoryBreakdown {
  category_name: string;
  total_revenue: number;
  total_profit: number;
  total_items_sold: number;
  transaction_count: number;
}

interface DailyProduct {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  category_name: string;
  unit_type: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_profit: number;
  avg_sell_price: number;
  transaction_count: number;
  current_stock: number;
  min_stock_level: number | null;
}

interface StockAlert {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  current_stock: number;
  min_stock_level: number | null;
  unit_type: string;
}

interface GroceryAnalyticsData {
  dailySales: DailySales[];
  hourlySales: HourlySales[];
  categoryBreakdown: CategoryBreakdown[];
  dailyProducts: DailyProduct[];
  stockAlerts: StockAlert[];
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    totalItemsSold: number;
    totalTransactions: number;
    daysWithSales: number;
    avgDailyRevenue: number;
    profitMargin: number;
  };
  comparison: {
    todayRevenue: number;
    yesterdayRevenue: number;
    revenueChange: number;
    todayItems: number;
    todayTransactions: number;
    todayProfit: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatNumber = (num: number) =>
  num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const formatHour = (hour: number) => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  piece: 'pcs',
  bunch: 'bunches',
  tray: 'trays',
  litre: 'L',
  ml: 'ml',
};

// ─── Component ───────────────────────────────────────────────────

export default function SalesByTypePage() {
  const params = useParams();
  const router = useRouter();
  const type = (params?.type as string) ?? '';
  const { productTypes, itemTypeKeys, loading: typesLoading } = useItemTypes();
  const typeConfig = productTypes.find((t) => t.key === type);
  const typeLabel = typeConfig?.label ?? type;
  const typeEmoji = typeConfig?.emoji ?? '📦';
  const typeColor = typeConfig?.color ?? '#22c55e';

  const [data, setData] = useState<GroceryAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dayProducts, setDayProducts] = useState<Record<string, DailyProduct[]>>({});
  const [loadingDayProducts, setLoadingDayProducts] = useState<string | null>(null);

  useEffect(() => {
    if (!typesLoading && itemTypeKeys.length > 0 && type && !itemTypeKeys.includes(type)) {
      router.replace('/admin/sales');
    }
  }, [type, itemTypeKeys, typesLoading, router]);

  const fetchData = useCallback(async () => {
    if (!type) return;
    try {
      setLoading(true);
      setError(null);
      let url = `/api/sales/analytics/daily?itemType=${encodeURIComponent(type)}&days=${days}`;
      if (selectedDate) url += `&date=${selectedDate}`;
      const result = await apiFetch<GroceryAnalyticsData>(url, { cache: 'no-store' });
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load sales data');
      }
    } catch {
      setError('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, [type, days, selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchDayProducts = useCallback(async (dateKey: string) => {
    if (dayProducts[dateKey] || !type) return;
    try {
      setLoadingDayProducts(dateKey);
      const result = await apiFetch<GroceryAnalyticsData>(
        `/api/sales/analytics/daily?itemType=${encodeURIComponent(type)}&days=1&date=${dateKey}`,
        { cache: 'no-store' }
      );
      if (result.success && result.data) {
        setDayProducts(prev => ({ ...prev, [dateKey]: result.data!.dailyProducts }));
      }
    } catch {
      // silently fail
    } finally {
      setLoadingDayProducts(null);
    }
  }, [dayProducts, type]);

  const toggleDay = (dateKey: string) => {
    if (expandedDay === dateKey) {
      setExpandedDay(null);
    } else {
      setExpandedDay(dateKey);
      fetchDayProducts(dateKey);
    }
  };

  if (!typeConfig && itemTypeKeys.length > 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <p className="text-slate-600 dark:text-slate-400">Unknown product type. Redirecting...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // ─── Loading / Error States ───
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-600" />
            <p className="text-slate-500 dark:text-slate-400">Loading {typeLabel} analytics...</p>
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

  const { summary, comparison, dailySales, hourlySales, categoryBreakdown, dailyProducts: todayProducts, stockAlerts } = data;

  // Filter today's products by search
  const filteredProducts = todayProducts.filter(p =>
    p.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.variant_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.category_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Best hour
  const bestHour = hourlySales.reduce<HourlySales | null>(
    (best, h) => (!best || h.revenue > best.revenue ? h : best), null
  );
  const maxHourlyRevenue = hourlySales.length > 0 ? Math.max(...hourlySales.map(h => h.revenue)) : 1;

  // Max daily revenue for bar sizing
  const maxDailyRevenue = dailySales.length > 0 ? Math.max(...dailySales.map(d => d.total_revenue)) : 1;

  // Max category revenue
  const maxCategoryRevenue = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map(c => c.total_revenue)) : 1;

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-green-100 dark:border-green-900">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Link href="/admin/sales" className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div
                  className="w-10 h-10 flex items-center justify-center rounded-lg shadow-lg text-2xl"
                  style={{ background: `linear-gradient(135deg, ${typeColor}, ${typeColor}dd)`, boxShadow: `0 4px 14px ${typeColor}40` }}
                >
                  {typeEmoji}
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    {typeLabel} Sales
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Last {days} days &bull; {formatNumber(summary.totalTransactions)} transactions
                  </p>
                </div>
              </div>
              <Button onClick={fetchData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {/* Period Selector */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: '7 Days', value: 7 },
                { label: '14 Days', value: 14 },
                { label: '30 Days', value: 30 },
              ].map(opt => (
                <Button
                  key={opt.value}
                  variant={days === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setDays(opt.value); setSelectedDate(null); }}
                  className={`h-8 text-xs ${days === opt.value ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  <CalendarDays className="w-3.5 h-3.5 mr-1" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-6xl mx-auto space-y-6">

          {/* ═══ TODAY'S HIGHLIGHT ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 shadow-lg shadow-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-white/80" />
                  {comparison.revenueChange !== 0 && (
                    <Badge className={`border-0 text-[10px] ${
                      comparison.revenueChange > 0
                        ? 'bg-white/20 text-white'
                        : 'bg-red-500/30 text-red-100'
                    }`}>
                      {comparison.revenueChange > 0 ? (
                        <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      )}
                      {Math.abs(comparison.revenueChange).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <p className="text-green-100 text-xs font-medium mb-1">Today&apos;s Revenue</p>
                <p className="text-2xl font-black text-white">{formatPrice(comparison.todayRevenue)}</p>
                <p className="text-[10px] text-green-200 mt-1">Yesterday: {formatPrice(comparison.yesterdayRevenue)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <TrendingUp className="w-5 h-5 text-white/80 mb-2" />
                <p className="text-teal-100 text-xs font-medium mb-1">Today&apos;s Profit</p>
                <p className="text-2xl font-black text-white">{formatPrice(comparison.todayProfit)}</p>
                <p className="text-[10px] text-teal-200 mt-1">Margin: {comparison.todayRevenue > 0 ? ((comparison.todayProfit / comparison.todayRevenue) * 100).toFixed(1) : 0}%</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <ShoppingCart className="w-5 h-5 text-white/80 mb-2" />
                <p className="text-violet-100 text-xs font-medium mb-1">Items Sold Today</p>
                <p className="text-2xl font-black text-white">{formatNumber(comparison.todayItems)}</p>
                <p className="text-[10px] text-violet-200 mt-1">{comparison.todayTransactions} transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <BarChart3 className="w-5 h-5 text-white/80 mb-2" />
                <p className="text-amber-100 text-xs font-medium mb-1">Daily Average</p>
                <p className="text-2xl font-black text-white">{formatPrice(summary.avgDailyRevenue)}</p>
                <p className="text-[10px] text-amber-200 mt-1">{summary.daysWithSales} active days / {days}</p>
              </CardContent>
            </Card>
          </div>

          {/* ═══ PERIOD SUMMARY BAR ═══ */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Period Revenue</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(summary.totalRevenue)}</p>
                  </div>
                  <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Period Profit</p>
                    <p className="text-lg font-black text-green-600">{formatPrice(summary.totalProfit)}</p>
                  </div>
                  <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Margin</p>
                    <p className="text-lg font-black text-slate-700 dark:text-slate-300">{summary.profitMargin.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Items</p>
                    <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatNumber(summary.totalItemsSold)}</p>
                  </div>
                  <div className="w-px h-10 bg-slate-200 dark:bg-slate-700" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Orders</p>
                    <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatNumber(summary.totalTransactions)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ═══ DAILY TIMELINE ═══ */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-green-600" />
                Daily Sales Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dailySales.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No sales data for this period</p>
              ) : (
                dailySales.map((day) => {
                  const barWidth = maxDailyRevenue > 0 ? (day.total_revenue / maxDailyRevenue) * 100 : 0;
                  const profitMargin = day.total_revenue > 0 ? (day.total_profit / day.total_revenue) * 100 : 0;
                  const isExpanded = expandedDay === day.date_key;
                  const products = dayProducts[day.date_key];

                  return (
                    <div key={day.date_key} className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                      <button
                        onClick={() => toggleDay(day.date_key)}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black ${
                              day.date_label === 'Today'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {day.date_key.slice(-2)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900 dark:text-white">{day.date_label}</p>
                              <p className="text-[10px] text-slate-400">{day.transaction_count} orders &bull; {formatNumber(day.total_items_sold)} items</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-black text-base text-green-600">{formatPrice(day.total_revenue)}</p>
                              <p className="text-[10px] text-slate-400">Profit: {formatPrice(day.total_profit)} ({profitMargin.toFixed(0)}%)</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                        <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </button>

                      {/* Expanded Day Products */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                          {loadingDayProducts === day.date_key ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                            </div>
                          ) : products && products.length > 0 ? (
                            <div className="p-3">
                              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pb-2">
                                <div className="col-span-4">Product</div>
                                <div className="col-span-2 text-right">Qty</div>
                                <div className="col-span-2 text-right">Revenue</div>
                                <div className="col-span-2 text-right">Profit</div>
                                <div className="col-span-2 text-right">Avg Price</div>
                              </div>
                              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                {products.map((p) => (
                                  <div key={p.item_id} className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-sm">
                                    <div className="col-span-4 min-w-0">
                                      <p className="font-semibold text-slate-900 dark:text-white truncate text-xs">
                                        {p.item_name}
                                        {p.variant_name && <span className="text-slate-400 ml-1">({p.variant_name})</span>}
                                      </p>
                                      <p className="text-[10px] text-slate-400">{p.category_name}</p>
                                    </div>
                                    <div className="col-span-2 text-right">
                                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                                        {formatNumber(p.total_quantity_sold)}
                                      </span>
                                      <span className="text-[10px] text-slate-400 ml-0.5">
                                        {UNIT_LABELS[p.unit_type] || p.unit_type}
                                      </span>
                                    </div>
                                    <div className="col-span-2 text-right font-bold text-xs text-green-600">
                                      {formatPrice(p.total_revenue)}
                                    </div>
                                    <div className="col-span-2 text-right font-semibold text-xs text-slate-600 dark:text-slate-400">
                                      {formatPrice(p.total_profit)}
                                    </div>
                                    <div className="col-span-2 text-right text-xs text-slate-500">
                                      {formatPrice(p.avg_sell_price)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 py-4 text-center">No products sold</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* ═══ HOURLY BREAKDOWN ═══ */}
          {hourlySales.length > 0 && (
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-600" />
                    Hourly Sales Pattern {selectedDate ? '' : '(Today)'}
                  </span>
                  {bestHour && (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0 text-[10px]">
                      Peak: {formatHour(bestHour.hour)} ({formatPrice(bestHour.revenue)})
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {hourlySales.map((h) => {
                    const barHeight = maxHourlyRevenue > 0 ? (h.revenue / maxHourlyRevenue) * 100 : 0;
                    const isPeak = bestHour?.hour === h.hour;
                    return (
                      <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="w-full relative" style={{ height: '100px' }}>
                          <div
                            className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-300 ${
                              isPeak
                                ? 'bg-gradient-to-t from-green-500 to-green-400'
                                : 'bg-gradient-to-t from-green-200 to-green-100 dark:from-green-800 dark:to-green-700'
                            }`}
                            style={{ height: `${Math.max(barHeight, 2)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-slate-400 font-medium">{h.hour}h</span>
                        {/* Tooltip */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {formatHour(h.hour)}: {formatPrice(h.revenue)}
                          <br />{formatNumber(h.items_sold)} items, {h.transaction_count} orders
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ CATEGORY PERFORMANCE ═══ */}
          {categoryBreakdown.length > 0 && (
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-600" />
                  Category Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryBreakdown.map((cat) => {
                  const barWidth = maxCategoryRevenue > 0 ? (cat.total_revenue / maxCategoryRevenue) * 100 : 0;
                  const profitMargin = cat.total_revenue > 0 ? (cat.total_profit / cat.total_revenue) * 100 : 0;
                  return (
                    <div key={cat.category_name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-900 dark:text-white">{cat.category_name}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-400">{formatNumber(cat.total_items_sold)} items</span>
                          <span className="font-black text-green-600 min-w-[80px] text-right">{formatPrice(cat.total_revenue)}</span>
                        </div>
                      </div>
                      <div className="relative h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-400">
                        <span>Profit: {formatPrice(cat.total_profit)}</span>
                        <span>Margin: {profitMargin.toFixed(1)}%</span>
                        <span>{cat.transaction_count} orders</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* ═══ TODAY'S PRODUCTS SOLD ═══ */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-green-600" />
                  Today&apos;s Products ({todayProducts.length})
                </span>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 h-8 text-xs border-slate-200 dark:border-slate-700"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <PackageX className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">
                    {searchQuery ? 'No products match your search' : `No ${typeLabel.toLowerCase()} products sold today`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-y border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5">Product</th>
                        <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5">Qty Sold</th>
                        <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5">Revenue</th>
                        <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5">Profit</th>
                        <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5">Avg Price</th>
                        <th className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, idx) => {
                        const isLowStock = p.min_stock_level !== null && p.current_stock > 0 && p.current_stock <= p.min_stock_level;
                        const isOutOfStock = p.current_stock <= 0;
                        return (
                          <tr key={p.item_id} className={`border-b border-slate-50 dark:border-slate-800/50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/20'}`}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-[10px] font-black text-green-600">
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                    {p.item_name}
                                    {p.variant_name && <span className="text-slate-400 text-xs ml-1">({p.variant_name})</span>}
                                  </p>
                                  <p className="text-[10px] text-slate-400">{p.category_name} &bull; {p.transaction_count} orders</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {formatNumber(p.total_quantity_sold)}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-0.5">
                                {UNIT_LABELS[p.unit_type] || p.unit_type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="font-bold text-sm text-green-600">{formatPrice(p.total_revenue)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-semibold text-sm ${p.total_profit > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-500'}`}>
                                {formatPrice(p.total_profit)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-sm text-slate-500">
                              {formatPrice(p.avg_sell_price)}/{UNIT_LABELS[p.unit_type] || p.unit_type}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {isOutOfStock ? (
                                <Badge className="bg-red-500 text-white text-[9px]">Out</Badge>
                              ) : isLowStock ? (
                                <Badge className="bg-orange-500 text-white text-[9px]">
                                  {formatNumber(p.current_stock)} {UNIT_LABELS[p.unit_type] || p.unit_type}
                                </Badge>
                              ) : (
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                  {formatNumber(p.current_stock)} {UNIT_LABELS[p.unit_type] || p.unit_type}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Totals Row */}
                  <div className="flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t-2 border-green-200 dark:border-green-800">
                    <span className="font-bold text-sm text-green-700 dark:text-green-300">
                      Total ({filteredProducts.length} products)
                    </span>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-green-600 font-medium">Revenue</p>
                        <p className="font-black text-sm text-green-700 dark:text-green-300">
                          {formatPrice(filteredProducts.reduce((sum, p) => sum + p.total_revenue, 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-green-600 font-medium">Profit</p>
                        <p className="font-black text-sm text-green-700 dark:text-green-300">
                          {formatPrice(filteredProducts.reduce((sum, p) => sum + p.total_profit, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ TOP PRODUCTS (Period) ═══ */}
          {(() => {
            // Get top products from daily products across the period
            // We use period summary data
            const topProducts = [...todayProducts].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5);
            if (topProducts.length === 0) return null;

            return (
              <Card className="border-2 border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                    Top Earners Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {topProducts.map((item, index) => {
                      const margin = item.total_revenue > 0 ? (item.total_profit / item.total_revenue) * 100 : 0;
                      return (
                        <div key={item.item_id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <Badge variant="outline" className="text-[9px]">{item.category_name}</Badge>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {item.item_name}
                          </h4>
                          {item.variant_name && (
                            <p className="text-[10px] text-slate-400 truncate">{item.variant_name}</p>
                          )}
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Sold</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatNumber(item.total_quantity_sold)} {UNIT_LABELS[item.unit_type] || item.unit_type}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Revenue</span>
                              <span className="font-bold text-green-600">{formatPrice(item.total_revenue)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Margin</span>
                              <span className="font-bold text-slate-600 dark:text-slate-400">{margin.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ═══ STOCK ALERTS ═══ */}
          {stockAlerts.length > 0 && (
            <Card className="border-2 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="w-4 h-4" />
                  {typeLabel} Stock Alerts ({stockAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {stockAlerts.map((alert) => {
                    const isOut = alert.current_stock <= 0;
                    return (
                      <div
                        key={alert.item_id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isOut
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {alert.item_name}
                            {alert.variant_name && <span className="text-slate-400 text-xs ml-1">({alert.variant_name})</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Scale className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-500">
                              Stock: {formatNumber(alert.current_stock)} {UNIT_LABELS[alert.unit_type] || alert.unit_type}
                              {alert.min_stock_level !== null && ` / Min: ${formatNumber(alert.min_stock_level)}`}
                            </span>
                          </div>
                        </div>
                        <Badge className={`text-[9px] shrink-0 ml-2 ${isOut ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                          {isOut ? 'OUT' : 'LOW'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
