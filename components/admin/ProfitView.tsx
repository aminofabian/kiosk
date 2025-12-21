'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Package,
  Users,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Receipt,
  Target,
  Wallet,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ProfitData {
  totalProfit: number;
  totalSales: number;
  totalCost: number;
  profitMargin: number;
  totalQuantitySold: number;
  totalTransactions: number;
  uniqueItemsSold: number;
  averageItemsPerSale: number;
  totalCustomers: number;
  creditCustomers: number;
  walkInCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  averageSalePerCustomer: number;
  itemProfits: Array<{
    item_id: string;
    item_name: string;
    total_profit: number;
    total_sales: number;
    total_cost: number;
    quantity_sold: number;
  }>;
}

interface ExpenseSummary {
  dailyOperatingCost: number;
  fixedDailyCost: number;
  variableDailyCost: number;
  weeklyOperatingCost: number;
  monthlyOperatingCost: number;
  expenseCount: number;
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

export function ProfitView() {
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    updateDateRangeFromPreset(datePreset);
  }, [datePreset]);

  useEffect(() => {
    fetchProfitData();
    fetchExpenseData();
  }, [dateRange]);

  async function fetchExpenseData() {
    try {
      const response = await fetch('/api/expenses/daily-cost');
      const result = await response.json();
      if (result.success) {
        setExpenseData(result.data);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
    }
  }

  function updateDateRangeFromPreset(preset: DatePreset) {
    const today = new Date();
    const start = new Date();

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setDate(1);
        break;
      case 'custom':
        return;
    }

    setDateRange({
      start: start.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    });
  }

  async function fetchProfitData() {
    try {
      setLoading(true);
      setError(null);
      const startTimestamp = Math.floor(
        new Date(dateRange.start).getTime() / 1000
      );
      const endTimestamp = Math.floor(
        new Date(dateRange.end + 'T23:59:59').getTime() / 1000
      );

      const response = await fetch(
        `/api/profit?start=${startTimestamp}&end=${endTimestamp}`
      );
      const result = await response.json();

      if (result.success) {
        setProfitData(result.data);
      } else {
        setError(result.message || 'Failed to load profit data');
      }
    } catch (err) {
      setError('Failed to load profit data');
      console.error('Error fetching profit:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Calculate period multiplier based on date range
  const getPeriodDays = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // Get daily expense scaled to the current period
  const getDailyExpense = () => {
    if (!expenseData) return 0;
    return expenseData.dailyOperatingCost * getPeriodDays();
  };

  // Net Profit = Gross Profit - Operating Expenses (scaled to period)
  const getNetProfit = () => {
    if (!profitData) return 0;
    return profitData.totalProfit - getDailyExpense();
  };

  // Break-even sales = Daily Operating Cost ÷ Average Margin
  const getBreakEvenSales = () => {
    if (!expenseData || !profitData) return 0;
    const avgMargin = profitData.profitMargin || 0.25; // Default 25% if no data
    if (avgMargin <= 0) return 0;
    return (expenseData.dailyOperatingCost * getPeriodDays()) / avgMargin;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#259783]/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-[#259783] animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading profit data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
          <Button onClick={fetchProfitData} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!profitData) {
    return null;
  }

  const topItems = profitData.itemProfits
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 5);

  const leastProfitItems = profitData.itemProfits
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 5);

  const lowProfitItems = profitData.itemProfits
    .filter((item) => {
      const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
      return item.total_profit < 0 || margin < 5;
    })
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Date Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-[#1c2e18] rounded-xl p-1 border border-slate-200 dark:border-slate-800">
          {(['today', 'week', 'month', 'custom'] as DatePreset[]).map((preset) => (
            <Button
              key={preset}
              variant={datePreset === preset ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDatePreset(preset)}
              className={`h-9 px-4 capitalize ${
                datePreset === preset
                  ? 'bg-[#259783] text-white hover:bg-[#45d827] shadow-md shadow-[#259783]/20'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {preset}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-[#1c2e18] rounded-xl p-2 border border-slate-200 dark:border-slate-800">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="h-9 w-36 text-sm border-0 bg-slate-50 dark:bg-slate-800/50"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="h-9 w-36 text-sm border-0 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>
          )}
          <Button
            onClick={() => console.log('Export CSV')}
            variant="outline"
            className="border-slate-200 dark:border-slate-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Profitability Status Banner */}
      {expenseData && expenseData.expenseCount > 0 && (
        <Card className={`border-2 ${
          getNetProfit() >= 0 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800' 
            : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800'
        }`}>
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  getNetProfit() >= 0 
                    ? 'bg-green-500 shadow-lg shadow-green-500/30' 
                    : 'bg-red-500 shadow-lg shadow-red-500/30'
                }`}>
                  {getNetProfit() >= 0 ? (
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  ) : (
                    <XCircle className="w-7 h-7 text-white" />
                  )}
                </div>
                <div>
                  <Badge className={`mb-1 ${
                    getNetProfit() >= 0 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {getNetProfit() >= 0 ? '🟢 PROFITABLE' : '🔴 RUNNING AT A LOSS'}
                  </Badge>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {datePreset === 'today' ? "Today's" : datePreset === 'week' ? 'This week\'s' : 'This period\'s'} net profit after operating expenses
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center lg:text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Net Profit</p>
                  <p className={`text-3xl font-black ${
                    getNetProfit() >= 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {getNetProfit() >= 0 ? '+' : ''}{formatPrice(getNetProfit())}
                  </p>
                </div>
                <div className="hidden lg:block w-px h-12 bg-slate-200 dark:bg-slate-700" />
                <div className="text-center lg:text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Safe to Bank</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatPrice(Math.max(0, getNetProfit()))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Profit Card */}
        <Card className="bg-[#259783] border-0 shadow-lg shadow-[#259783]/20 col-span-2 lg:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0">
                {formatPercent(profitData.profitMargin)} margin
              </Badge>
            </div>
            <p className="text-white/90 text-sm font-medium mb-1">Gross Profit</p>
            <p className="text-3xl font-black text-white">{formatPrice(profitData.totalProfit)}</p>
            <p className="text-white/70 text-xs mt-1">Sales - Cost of Goods</p>
          </CardContent>
        </Card>

        {/* Revenue Card */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Revenue</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(profitData.totalSales)}</p>
          </CardContent>
        </Card>

        {/* Cost of Goods Card */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-500" />
              </div>
              <ArrowDownRight className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Cost of Goods</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(profitData.totalCost)}</p>
          </CardContent>
        </Card>

        {/* Customers Card */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Customers</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{profitData.totalCustomers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Operating Expenses & Break-even Section */}
      {expenseData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daily Operating Cost */}
          <Card className="bg-gradient-to-br from-orange-500 to-red-600 border-0 shadow-lg shadow-orange-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <Link href="/admin/expenses">
                  <Badge className="bg-white/20 text-white border-0 hover:bg-white/30 cursor-pointer">
                    Manage →
                  </Badge>
                </Link>
              </div>
              <p className="text-white/90 text-sm font-medium mb-1">Daily Operating Cost</p>
              <p className="text-3xl font-black text-white">{formatPrice(getDailyExpense())}</p>
              <p className="text-white/70 text-xs mt-1">
                {expenseData.expenseCount} expense{expenseData.expenseCount !== 1 ? 's' : ''} configured
              </p>
            </CardContent>
          </Card>

          {/* Break-even Sales */}
          <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-amber-500" />
                </div>
                {profitData.totalSales >= getBreakEvenSales() && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    ✓ Achieved
                  </Badge>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Break-even Sales</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(getBreakEvenSales())}</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Min. daily sales to survive
              </p>
            </CardContent>
          </Card>

          {/* Safe to Bank */}
          <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Safe to Bank</p>
              <p className={`text-2xl font-bold ${
                getNetProfit() >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-500'
              }`}>
                {formatPrice(Math.max(0, getNetProfit()))}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Keep {formatPrice(getDailyExpense())} for expenses
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Expenses Configured Banner */}
      {(!expenseData || expenseData.expenseCount === 0) && (
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Set up your operating expenses
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Add expenses like rent, salaries, and utilities to see your true daily profit
                  </p>
                </div>
              </div>
              <Link href="/admin/expenses">
                <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                  <Receipt className="w-4 h-4 mr-2" />
                  Add Expenses
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Items Sold', value: profitData.totalQuantitySold.toLocaleString(), icon: Package, color: 'slate' },
          { label: 'Transactions', value: profitData.totalTransactions.toLocaleString(), icon: BarChart3, color: 'slate' },
          { label: 'Unique Items', value: profitData.uniqueItemsSold.toString(), icon: Package, color: 'slate' },
          { label: 'Credit Customers', value: profitData.creditCustomers.toString(), icon: Users, color: 'slate' },
          { label: 'Repeat Customers', value: profitData.repeatCustomers.toString(), icon: TrendingUp, color: 'slate' },
          { label: 'New Customers', value: profitData.newCustomers.toString(), icon: Users, color: 'slate' },
        ].map((stat, index) => (
          <Card key={index} className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <stat.icon className="w-4 h-4 text-slate-400 mb-2" />
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top, Least & Low Profit Items */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Top Profit Items</h3>
            </div>
            <div className="p-4">
              {topItems.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">No items yet</p>
              ) : (
                <div className="space-y-3">
                  {topItems.map((item, index) => {
                    const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                    const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                    const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                    const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
                    return (
                      <div
                        key={item.item_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{item.item_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.quantity_sold.toFixed(0)} sold • {margin.toFixed(1)}% margin
                          </p>
                          <div className="flex gap-2 mt-1 text-xs">
                            <span className="text-slate-500">Buy: {formatPrice(avgBuyPrice)}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-500">Sell: {formatPrice(avgSellPrice)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600 dark:text-green-400 text-sm">
                            +{formatPrice(item.total_profit)}
                          </p>
                          <p className="text-xs text-slate-400">({formatPrice(avgProfit)}/unit)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Least Profit Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-orange-500" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Least Profitable</h3>
            </div>
            <div className="p-4">
              {leastProfitItems.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">No items yet</p>
              ) : (
                <div className="space-y-3">
                  {leastProfitItems.map((item, index) => {
                    const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                    const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                    const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                    const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
                    const isNegative = item.total_profit < 0;
                    const bgColor = isNegative
                      ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20';
                    const textColor = isNegative
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-orange-600 dark:text-orange-400';

                    return (
                      <div
                        key={item.item_id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${bgColor}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isNegative ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                          <span className={`text-xs font-bold ${textColor}`}>{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{item.item_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.quantity_sold.toFixed(0)} sold • {margin.toFixed(1)}% margin
                          </p>
                          <div className="flex gap-2 mt-1 text-xs">
                            <span className="text-slate-500">Buy: {formatPrice(avgBuyPrice)}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-500">Sell: {formatPrice(avgSellPrice)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${textColor}`}>
                            {isNegative ? '-' : ''}{formatPrice(Math.abs(item.total_profit))}
                          </p>
                          <p className="text-xs text-slate-400">({formatPrice(avgProfit)}/unit)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Profit Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Low / Negative Profit</h3>
            </div>
            <div className="p-4">
              {lowProfitItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-green-600 dark:text-green-400 font-medium">All items profitable!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowProfitItems.map((item) => {
                    const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                    const isNegative = item.total_profit < 0;
                    const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                    const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                    const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
                    const bgColor = isNegative
                      ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20';
                    const textColor = isNegative
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-orange-600 dark:text-orange-400';

                    return (
                      <div
                        key={item.item_id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${bgColor}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isNegative ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                          <AlertCircle className={`w-4 h-4 ${textColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{item.item_name}</p>
                          <p className={`text-xs ${textColor} mt-0.5`}>
                            {isNegative ? 'Loss / Waste' : `${margin.toFixed(1)}% margin`} • {item.quantity_sold.toFixed(0)} sold
                          </p>
                          <div className="flex gap-2 mt-1 text-xs">
                            <span className="text-slate-500">Buy: {formatPrice(avgBuyPrice)}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-500">Sell: {formatPrice(avgSellPrice)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${textColor}`}>
                            {isNegative ? '-' : '+'}{formatPrice(Math.abs(item.total_profit))}
                          </p>
                          <p className={`text-xs ${textColor} opacity-70`}>({formatPrice(avgProfit)}/unit)</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Items Table */}
      <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">All Items Performance</h3>
            <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
              {profitData.itemProfits.length} items
            </Badge>
          </div>
          {profitData.itemProfits.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No sales in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                    <th className="text-left p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Item</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Quantity</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Buy Price</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Sell Price</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Profit/Unit</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Total Cost</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Total Sales</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Total Profit</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {profitData.itemProfits
                    .sort((a, b) => b.total_profit - a.total_profit)
                    .map((item) => {
                      const itemMargin = item.total_sales > 0 ? item.total_profit / item.total_sales : 0;
                      const isPositive = item.total_profit >= 0;
                      const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                      const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                      const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;

                      return (
                        <tr
                          key={item.item_id}
                          className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isPositive ? (
                                <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-slate-900 dark:text-white">{item.item_name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right text-slate-600 dark:text-slate-300 font-medium">
                            {item.quantity_sold.toFixed(1)}
                          </td>
                          <td className="p-4 text-right text-slate-600 dark:text-slate-300">
                            {formatPrice(avgBuyPrice)}
                          </td>
                          <td className="p-4 text-right text-slate-600 dark:text-slate-300">
                            {formatPrice(avgSellPrice)}
                          </td>
                          <td className={`p-4 text-right font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {formatPrice(avgProfit)}
                          </td>
                          <td className="p-4 text-right text-slate-500 dark:text-slate-400">
                            {formatPrice(item.total_cost)}
                          </td>
                          <td className="p-4 text-right text-slate-600 dark:text-slate-300">
                            {formatPrice(item.total_sales)}
                          </td>
                          <td className={`p-4 text-right font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {formatPrice(item.total_profit)}
                          </td>
                          <td className="p-4 text-right">
                            <Badge
                              className={isPositive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }
                            >
                              {formatPercent(itemMargin)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
