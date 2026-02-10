'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Leaf,
  Store,
  DollarSign,
  ShoppingCart,
  Receipt,
  Search,
  Package,
  BarChart3,
  Target,
  ChevronRight,
  Wallet,
  Eye,
  EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { ProfitCalendar } from '@/components/admin/ProfitCalendar';

// ─── Types ───────────────────────────────────────────────────────

interface ItemProfit {
  item_id: string;
  item_name: string;
  total_profit: number;
  total_sales: number;
  total_cost: number;
  quantity_sold: number;
  has_buy_price?: number;
}

interface ProfitData {
  totalProfit: number;
  grossProfit?: number;
  grossMargin?: number;
  totalSales: number;
  totalCost: number;
  profitMargin: number;
  totalTransactions: number;
  totalQuantitySold: number;
  uniqueItemsSold: number;
  totalCustomers: number;
  stockLosses?: { total: number; count: number; spoilage: number; theft: number; damage: number; other: number };
  itemProfits: ItemProfit[];
}

interface ExpenseSummary {
  dailyOperatingCost: number;
  expenseCount: number;
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

// ─── Helpers ─────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  `KES ${Math.abs(price).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatPriceSigned = (price: number) =>
  `${price < 0 ? '-' : ''}KES ${Math.abs(price).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const formatNumber = (num: number) =>
  num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

// ─── Page ────────────────────────────────────────────────────────

export default function ProfitHubPage() {
  const [allData, setAllData] = useState<ProfitData | null>(null);
  const [groceryData, setGroceryData] = useState<ProfitData | null>(null);
  const [retailData, setRetailData] = useState<ProfitData | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    return { start: today, end: today };
  });
  const [itemSearch, setItemSearch] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => { updateDateRange(datePreset); }, [datePreset]);
  useEffect(() => { fetchData(); fetchExpenseData(); }, [dateRange]);

  function updateDateRange(preset: DatePreset) {
    if (preset === 'custom') return;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(todayStart);
    if (preset === 'week') start.setDate(start.getDate() - 6);
    else if (preset === 'month') start.setDate(1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({ start: fmt(start), end: fmt(todayStart) });
  }

  async function fetchExpenseData() {
    try {
      const res = await fetch('/api/expenses/daily-cost');
      const result = await res.json();
      if (result.success) setExpenseData(result.data);
    } catch (err) { console.error('Error:', err); }
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [sY, sM, sD] = dateRange.start.split('-').map(Number);
      const [eY, eM, eD] = dateRange.end.split('-').map(Number);
      const startTs = Math.floor(new Date(sY, sM - 1, sD, 0, 0, 0, 0).getTime() / 1000);
      const endOfDayMs = new Date(eY, eM - 1, eD, 23, 59, 59, 999).getTime();
      const endTs = Math.floor(endOfDayMs / 1000);

      const [allRes, groceryRes, retailRes] = await Promise.all([
        fetch(`/api/profit?start=${startTs}&end=${endTs}`).then(r => r.json()),
        fetch(`/api/profit?start=${startTs}&end=${endTs}&itemType=grocery`).then(r => r.json()),
        fetch(`/api/profit?start=${startTs}&end=${endTs}&itemType=retail`).then(r => r.json()),
      ]);

      if (allRes.success) setAllData(allRes.data);
      if (groceryRes.success) setGroceryData(groceryRes.data);
      if (retailRes.success) setRetailData(retailRes.data);
    } catch {
      setError('Failed to load profit data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const getPeriodDays = () => {
    const [sY, sM, sD] = dateRange.start.split('-').map(Number);
    const [eY, eM, eD] = dateRange.end.split('-').map(Number);
    return Math.round(Math.abs(new Date(eY, eM - 1, eD).getTime() - new Date(sY, sM - 1, sD).getTime()) / 86400000) + 1;
  };
  const getTotalExpenses = () => expenseData ? expenseData.dailyOperatingCost * getPeriodDays() : 0;

  const grossProfit = allData?.grossProfit ?? 0;
  const grossMargin = allData?.grossMargin ?? (allData?.totalSales ? grossProfit / allData.totalSales : 0);
  const getNetProfit = () => grossProfit - getTotalExpenses();
  const hasExpenses = expenseData && expenseData.expenseCount > 0;
  const isProfitable = getNetProfit() >= 0;
  const netProfit = getNetProfit();
  const totalExpenses = getTotalExpenses();
  const periodDays = getPeriodDays();

  // Department data
  const totalSalesCombined = (groceryData?.totalSales ?? 0) + (retailData?.totalSales ?? 0);
  const groceryPct = totalSalesCombined > 0 ? ((groceryData?.totalSales ?? 0) / totalSalesCombined) * 100 : 0;
  const retailPct = totalSalesCombined > 0 ? ((retailData?.totalSales ?? 0) / totalSalesCombined) * 100 : 0;

  // Items
  const allItems: (ItemProfit & { department: 'grocery' | 'retail' })[] = useMemo(() => [
    ...(groceryData?.itemProfits ?? []).map(i => ({ ...i, department: 'grocery' as const })),
    ...(retailData?.itemProfits ?? []).map(i => ({ ...i, department: 'retail' as const })),
  ], [groceryData, retailData]);

  const groceryTopItems = useMemo(() => [...(groceryData?.itemProfits ?? [])].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5), [groceryData]);
  const retailTopItems = useMemo(() => [...(retailData?.itemProfits ?? [])].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5), [retailData]);

  const filteredItems = useMemo(() =>
    allItems
      .filter(i => i.item_name.toLowerCase().includes(itemSearch.toLowerCase()))
      .sort((a, b) => b.total_profit - a.total_profit),
    [allItems, itemSearch]
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#259783]" />
            <p className="text-slate-500 dark:text-slate-400">Loading profit overview...</p>
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

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#259783] flex items-center justify-center rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    Profit Overview
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Combined grocery &amp; retail profit analysis
                  </p>
                </div>
              </div>
              <Button onClick={fetchData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-5xl mx-auto space-y-6">
          {/* Date Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg">
              {(['today', 'week', 'month', 'custom'] as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${
                    datePreset === preset
                      ? 'bg-[#259783] text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-1.5 rounded-lg">
                <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="h-7 w-32 text-xs border-0 bg-transparent" />
                <span className="text-slate-400 text-xs">to</span>
                <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="h-7 w-32 text-xs border-0 bg-transparent" />
              </div>
            )}
            <span className="text-xs text-slate-400 font-medium">{periodDays} day{periodDays !== 1 ? 's' : ''}</span>
          </div>

          {/* Top Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={`border-0 shadow-lg ${isProfitable ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  {isProfitable ? <TrendingUp className="w-5 h-5 text-white/80" /> : <TrendingDown className="w-5 h-5 text-white/80" />}
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {isProfitable ? 'Profit' : 'Loss'}
                  </Badge>
                </div>
                <p className={`text-xs font-medium mb-1 ${isProfitable ? 'text-green-100' : 'text-red-100'}`}>Net Profit</p>
                <p className="text-xl font-black text-white">{formatPriceSigned(netProfit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {formatNumber(allData?.totalTransactions ?? 0)} orders
                  </Badge>
                </div>
                <p className="text-blue-100 text-xs font-medium mb-1">Total Revenue</p>
                <p className="text-xl font-black text-white">{formatPrice(allData?.totalSales ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {formatPercent(grossMargin)} margin
                  </Badge>
                </div>
                <p className="text-emerald-100 text-xs font-medium mb-1">Gross Profit</p>
                <p className="text-xl font-black text-white">{formatPrice(grossProfit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {formatNumber(allData?.totalQuantitySold ?? 0)} sold
                  </Badge>
                </div>
                <p className="text-purple-100 text-xs font-medium mb-1">Cost of Goods</p>
                <p className="text-xl font-black text-white">{formatPrice(allData?.totalCost ?? 0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* P&L Breakdown */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#259783]" />
                Profit &amp; Loss Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Revenue */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Revenue</span>
                    </div>
                    <span className="font-black text-sm text-slate-900 dark:text-white">{formatPrice(allData?.totalSales ?? 0)}</span>
                  </div>
                  <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-700" style={{ width: '100%' }} />
                  </div>
                </div>
                {/* Cost of Goods */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-orange-500" />
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Cost of Goods</span>
                    </div>
                    <span className="font-black text-sm text-slate-900 dark:text-white">&minus; {formatPrice(allData?.totalCost ?? 0)}</span>
                  </div>
                  <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-700"
                      style={{ width: `${(allData?.totalSales ?? 0) > 0 ? ((allData?.totalCost ?? 0) / (allData?.totalSales ?? 1)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {/* Gross Profit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Gross Profit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-emerald-600">{formatPrice(grossProfit)}</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">{formatPercent(grossMargin)}</span>
                    </div>
                  </div>
                  <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-700"
                      style={{ width: `${(allData?.totalSales ?? 0) > 0 ? (grossProfit / (allData?.totalSales ?? 1)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {/* Operating Expenses */}
                {hasExpenses && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-red-500" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Operating Expenses</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-white">&minus; {formatPrice(totalExpenses)}</span>
                        <span className="text-[10px] text-slate-400">{expenseData?.expenseCount} &times; {periodDays}d</span>
                      </div>
                    </div>
                    <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-400 to-rose-500 transition-all duration-700"
                        style={{ width: `${(allData?.totalSales ?? 0) > 0 ? (totalExpenses / (allData?.totalSales ?? 1)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Net Profit */}
                <div className="pt-3 border-t-2 border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900 dark:text-white">Net Profit</span>
                    <span className={`text-lg font-black ${isProfitable ? 'text-[#259783]' : 'text-red-600'}`}>
                      {formatPriceSigned(netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expenses & Banking Row */}
          {hasExpenses ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="border-2 border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Receipt className="w-5 h-5 text-[#259783]" />
                    <Link href="/admin/expenses" className="text-[10px] text-[#259783] hover:underline flex items-center gap-0.5">
                      Manage <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Operating Expenses</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(totalExpenses)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{expenseData?.expenseCount} expense{expenseData?.expenseCount !== 1 ? 's' : ''} &bull; {periodDays} day{periodDays !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <Target className="w-5 h-5 text-orange-500 mb-2" />
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Break-even Sales</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(grossMargin > 0 ? totalExpenses / grossMargin : 0)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Min. to cover costs</p>
                </CardContent>
              </Card>
              <Card className={`border-2 ${isProfitable ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
                <CardContent className="p-4">
                  <Wallet className={`w-5 h-5 mb-2 ${isProfitable ? 'text-[#259783]' : 'text-red-500'}`} />
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Safe to Bank</p>
                  <p className={`text-lg font-black ${isProfitable ? 'text-[#259783]' : 'text-red-600'}`}>
                    {formatPrice(Math.max(0, netProfit))}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isProfitable ? `Keep ${formatPrice(totalExpenses)} for expenses` : 'Costs exceed profit'}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Link href="/admin/expenses" className="block">
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#259783] transition-all group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-5 h-5 text-[#259783]" />
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">Add Operating Expenses</p>
                      <p className="text-xs text-slate-500">Track rent, salaries, and more to see your true net profit</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#259783] group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Department Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Grocery */}
            <Link href="/admin/profit/grocery" className="block group">
              <Card className="border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all hover:shadow-xl hover:shadow-green-500/10 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                      <Leaf className="w-7 h-7 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Grocery Profit</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Daily breakdowns, product performance, margin insights
                  </p>
                  {groceryData && groceryData.totalSales > 0 ? (
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Sales</p>
                        <p className="text-lg font-black text-green-600">{formatPrice(groceryData.totalSales)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Profit</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatPrice(groceryData.totalProfit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Margin</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatPercent(groceryData.grossMargin ?? groceryData.profitMargin)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-400">No grocery sales this period</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Retail */}
            <Link href="/admin/profit/retail" className="block group">
              <Card className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:shadow-xl hover:shadow-blue-500/10 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Store className="w-7 h-7 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Retail Profit</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Product analytics, stock performance, tracking
                  </p>
                  {retailData && retailData.totalSales > 0 ? (
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Sales</p>
                        <p className="text-lg font-black text-blue-600">{formatPrice(retailData.totalSales)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Profit</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatPrice(retailData.totalProfit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Margin</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatPercent(retailData.grossMargin ?? retailData.profitMargin)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-400">No retail sales this period</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Department Comparison */}
          {totalSalesCombined > 0 && (
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#259783]" />
                  Department Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Grocery */}
                  {groceryData && groceryData.totalSales > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-4 h-4 text-green-500" />
                          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Grocery</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-black text-slate-900 dark:text-white">{formatPrice(groceryData.totalSales)}</span>
                          <span className="text-slate-400">{groceryPct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-700"
                          style={{ width: `${groceryPct}%` }}
                        />
                      </div>
                      <div className="flex gap-6 text-xs text-slate-500">
                        <span>Profit: {formatPrice(groceryData.totalProfit)}</span>
                        <span>{formatNumber(groceryData.totalQuantitySold)} items</span>
                        <span>{groceryData.totalTransactions} orders</span>
                      </div>
                    </div>
                  )}
                  {/* Retail */}
                  {retailData && retailData.totalSales > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-blue-500" />
                          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Retail</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-black text-slate-900 dark:text-white">{formatPrice(retailData.totalSales)}</span>
                          <span className="text-slate-400">{retailPct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-700"
                          style={{ width: `${retailPct}%` }}
                        />
                      </div>
                      <div className="flex gap-6 text-xs text-slate-500">
                        <span>Profit: {formatPrice(retailData.totalProfit)}</span>
                        <span>{formatNumber(retailData.totalQuantitySold)} items</span>
                        <span>{retailData.totalTransactions} orders</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Earners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-green-500" />
                  Top Grocery Earners
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groceryTopItems.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">No data</p>
                ) : (
                  <div className="space-y-3">
                    {groceryTopItems.map((item, i) => {
                      const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                      return (
                        <div key={item.item_id} className="flex items-center gap-3">
                          <div className="w-6 h-6 flex items-center justify-center rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 text-[10px] font-black shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                            <p className="text-xs text-slate-500">{item.quantity_sold.toFixed(0)} sold &bull; {margin.toFixed(0)}% margin</p>
                          </div>
                          <p className="text-sm font-black text-green-600 shrink-0">+{formatPrice(item.total_profit)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Store className="w-4 h-4 text-blue-500" />
                  Top Retail Earners
                </CardTitle>
              </CardHeader>
              <CardContent>
                {retailTopItems.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 text-sm">No data</p>
                ) : (
                  <div className="space-y-3">
                    {retailTopItems.map((item, i) => {
                      const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                      return (
                        <div key={item.item_id} className="flex items-center gap-3">
                          <div className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] font-black shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                            <p className="text-xs text-slate-500">{item.quantity_sold.toFixed(0)} sold &bull; {margin.toFixed(0)}% margin</p>
                          </div>
                          <p className="text-sm font-black text-blue-600 shrink-0">+{formatPrice(item.total_profit)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Profit Calendar */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#259783]" />
                Daily Net Profit Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProfitCalendar />
            </CardContent>
          </Card>

          {/* All Items Table */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#259783]" />
                  All Items
                  <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-xs ml-1">
                    {filteredItems.length}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-9 h-9 w-48 text-sm border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setShowAllItems(!showAllItems)}>
                    {showAllItems ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                    {showAllItems ? 'Collapse' : 'Show All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500 text-sm">No sales in this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Item</th>
                        <th className="text-center px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Dept</th>
                        <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Qty</th>
                        <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Sales</th>
                        <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Cost</th>
                        <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Profit</th>
                        <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems
                        .slice(0, showAllItems ? undefined : 20)
                        .map((item) => {
                          const margin = item.total_sales > 0 ? item.total_profit / item.total_sales : 0;
                          const isPositive = item.total_profit >= 0;
                          const isGrocery = item.department === 'grocery';
                          return (
                            <tr key={`${item.department}-${item.item_id}`} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isPositive
                                    ? <TrendingUp className="h-3.5 w-3.5 text-[#259783] flex-shrink-0" />
                                    : <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  }
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">{item.item_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <Badge className={`text-[9px] border-0 ${isGrocery ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                  {isGrocery ? 'Grocery' : 'Retail'}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300 text-xs">{item.quantity_sold.toFixed(0)}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-slate-600 dark:text-slate-300">{formatPrice(item.total_sales)}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-slate-500">{formatPrice(item.total_cost)}</td>
                              <td className={`px-4 py-2.5 text-right font-black text-xs ${isPositive ? 'text-[#259783]' : 'text-red-500'}`}>{formatPriceSigned(item.total_profit)}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-[#259783]/10 text-[#259783]' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                  {formatPercent(margin)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {!showAllItems && filteredItems.length > 20 && (
                    <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setShowAllItems(true)} className="text-xs font-bold text-[#259783] hover:text-[#1a7a69]">
                        Show all {filteredItems.length} items
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
