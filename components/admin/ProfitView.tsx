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
  Receipt,
  Target,
  Wallet,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
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
      const startTimestamp = Math.floor(new Date(dateRange.start).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(dateRange.end + 'T23:59:59').getTime() / 1000);

      const response = await fetch(`/api/profit?start=${startTimestamp}&end=${endTimestamp}`);
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

  const getPeriodDays = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getDailyExpense = () => {
    if (!expenseData) return 0;
    return expenseData.dailyOperatingCost * getPeriodDays();
  };

  const getNetProfit = () => {
    if (!profitData) return 0;
    return profitData.totalProfit - getDailyExpense();
  };

  const getBreakEvenSales = () => {
    if (!expenseData || !profitData) return 0;
    const avgMargin = profitData.profitMargin || 0.25;
    if (avgMargin <= 0) return 0;
    return (expenseData.dailyOperatingCost * getPeriodDays()) / avgMargin;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-[#259783] animate-spin mx-auto" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400 font-medium text-sm">{error}</p>
          <Button onClick={fetchProfitData} variant="outline" size="sm" className="rounded-lg">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!profitData) return null;

  const topItems = profitData.itemProfits.sort((a, b) => b.total_profit - a.total_profit).slice(0, 5);
  const leastProfitItems = profitData.itemProfits.sort((a, b) => a.total_profit - b.total_profit).slice(0, 5);
  const lowProfitItems = profitData.itemProfits
    .filter((item) => {
      const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
      return item.total_profit < 0 || margin < 5;
    })
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 5);

  const hasExpenses = expenseData && expenseData.expenseCount > 0;
  const isProfitable = getNetProfit() >= 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header with Date Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b-2 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700">
          {(['today', 'week', 'month', 'custom'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${
                datePreset === preset
                  ? 'bg-[#259783] text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-1.5">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="h-7 w-32 text-xs border-0 bg-transparent"
              />
              <span className="text-slate-400 text-xs">→</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="h-7 w-32 text-xs border-0 bg-transparent"
              />
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Profitability Status Banner */}
      {hasExpenses && (
        <div className={`flex items-center justify-between p-5 border-2 ${
          isProfitable 
            ? 'border-[#259783] bg-[#259783]/5' 
            : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 flex items-center justify-center border-2 ${
              isProfitable ? 'border-[#259783] bg-[#259783]' : 'border-red-500 bg-red-500'
            }`}>
              {isProfitable ? <CheckCircle2 className="w-6 h-6 text-white" /> : <XCircle className="w-6 h-6 text-white" />}
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-wide mb-1 ${
                isProfitable ? 'text-[#259783]' : 'text-red-600 dark:text-red-400'
              }`}>
                {isProfitable ? '✓ PROFITABLE' : '✗ AT A LOSS'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Net profit after {getPeriodDays()} day{getPeriodDays() !== 1 ? 's' : ''} expenses
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right border-r-2 border-slate-200 dark:border-slate-700 pr-6">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Net Profit</p>
              <p className={`text-2xl font-black ${isProfitable ? 'text-[#259783]' : 'text-red-600 dark:text-red-400'}`}>
                {isProfitable ? '+' : ''}{formatPrice(getNetProfit())}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Safe to Bank</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {formatPrice(Math.max(0, getNetProfit()))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats - 4 Column Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border-2 border-[#259783] bg-[#259783] p-5">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-5 h-5 text-white" />
            <span className="text-white/70 text-[10px] font-bold bg-white/20 px-1.5 py-0.5">
              {formatPercent(profitData.profitMargin)}
            </span>
          </div>
          <p className="text-white/80 text-[10px] font-bold uppercase tracking-wide mb-1">Gross Profit</p>
          <p className="text-3xl font-black text-white">{formatPrice(profitData.totalProfit)}</p>
          <p className="text-white/60 text-xs mt-1">Sales - Cost of Goods</p>
        </div>

        <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <ShoppingCart className="w-5 h-5 text-[#259783]" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Revenue</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{formatPrice(profitData.totalSales)}</p>
        </div>

        <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-5 h-5 text-[#259783]" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Cost of Goods</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{formatPrice(profitData.totalCost)}</p>
        </div>

        <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-5 h-5 text-[#259783]" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Customers</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{profitData.totalCustomers}</p>
        </div>
      </div>

      {/* Operating Expenses Row */}
      {hasExpenses ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="border-2 border-[#259783] bg-[#259783] p-5">
            <div className="flex items-center justify-between mb-3">
              <Receipt className="w-5 h-5 text-white" />
              <Link href="/admin/expenses" className="text-white/70 text-[10px] hover:text-white flex items-center gap-0.5">
                Manage <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-white/80 text-[10px] font-bold uppercase tracking-wide mb-1">Operating Expenses</p>
            <p className="text-3xl font-black text-white">{formatPrice(getDailyExpense())}</p>
            <p className="text-white/60 text-[10px] mt-1">{expenseData?.expenseCount} expense{expenseData?.expenseCount !== 1 ? 's' : ''} • {getPeriodDays()} days</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <Target className="w-5 h-5 text-[#259783]" />
              {profitData.totalSales >= getBreakEvenSales() && (
                <span className="text-[10px] font-bold text-[#259783] bg-[#259783]/10 px-1.5 py-0.5">✓</span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Break-even Sales</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{formatPrice(getBreakEvenSales())}</p>
            <p className="text-slate-400 text-[10px] mt-1">Min. to survive</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <Wallet className="w-5 h-5 text-[#259783]" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Safe to Bank</p>
            <p className={`text-3xl font-black ${isProfitable ? 'text-[#259783]' : 'text-red-500'}`}>
              {formatPrice(Math.max(0, getNetProfit()))}
            </p>
            <p className="text-slate-400 text-[10px] mt-1">Keep {formatPrice(getDailyExpense())} for expenses</p>
          </div>
        </div>
      ) : (
        <Link href="/admin/expenses" className="block">
          <div className="flex items-center justify-between p-5 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5 text-[#259783]" />
              <div>
                <p className="font-black text-sm text-slate-900 dark:text-white">Add Operating Expenses</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">See true profit after rent, salaries, etc.</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#259783]" />
          </div>
        </Link>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Items Sold', value: profitData.totalQuantitySold.toLocaleString() },
          { label: 'Transactions', value: profitData.totalTransactions.toLocaleString() },
          { label: 'Unique Items', value: profitData.uniqueItemsSold.toString() },
          { label: 'Credit', value: profitData.creditCustomers.toString() },
          { label: 'Repeat', value: profitData.repeatCustomers.toString() },
          { label: 'New', value: profitData.newCustomers.toString() },
        ].map((stat, index) => (
          <div key={index} className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
            <p className="text-xl font-black text-slate-900 dark:text-white mb-1">{stat.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Item Performance Cards */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Items */}
        <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#259783]" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Top Profit Items</h3>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {topItems.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">No items yet</p>
            ) : (
              topItems.map((item, index) => (
                <ItemRow key={item.item_id} item={item} index={index} type="top" formatPrice={formatPrice} />
              ))
            )}
          </div>
        </div>

        {/* Least Profit */}
        <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#259783]" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Least Profitable</h3>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {leastProfitItems.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">No items yet</p>
            ) : (
              leastProfitItems.map((item, index) => (
                <ItemRow key={item.item_id} item={item} index={index} type="least" formatPrice={formatPrice} />
              ))
            )}
          </div>
        </div>

        {/* Low/Negative */}
        <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#259783]" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white">Low / Negative</h3>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {lowProfitItems.length === 0 ? (
              <div className="text-center py-6">
                <TrendingUp className="w-6 h-6 text-[#259783] mx-auto mb-2" />
                <p className="text-[#259783] text-sm font-bold">All items profitable!</p>
              </div>
            ) : (
              lowProfitItems.map((item, index) => (
                <ItemRow key={item.item_id} item={item} index={index} type="low" formatPrice={formatPrice} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* All Items Table */}
      <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#259783]" />
              <h3 className="font-black text-sm text-slate-900 dark:text-white">All Items</h3>
            </div>
            <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-xs">
              {profitData.itemProfits.length} items
            </Badge>
          </div>
        </div>
        {profitData.itemProfits.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">No sales in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                  <th className="text-left px-6 py-3 font-black text-slate-700 dark:text-slate-300">Item</th>
                  <th className="text-right px-6 py-3 font-black text-slate-700 dark:text-slate-300">Qty</th>
                  <th className="text-right px-6 py-3 font-black text-slate-700 dark:text-slate-300">Buy</th>
                  <th className="text-right px-6 py-3 font-black text-slate-700 dark:text-slate-300">Sell</th>
                  <th className="text-right px-6 py-3 font-black text-slate-700 dark:text-slate-300">Profit/Unit</th>
                  <th className="text-right px-6 py-3 font-black text-slate-700 dark:text-slate-300">Total Profit</th>
                  <th className="text-right px-6 py-3 font-black text-slate-700 dark:text-slate-300">Margin</th>
                </tr>
              </thead>
              <tbody>
                {profitData.itemProfits.sort((a, b) => b.total_profit - a.total_profit).map((item) => {
                  const margin = item.total_sales > 0 ? item.total_profit / item.total_sales : 0;
                  const isPositive = item.total_profit >= 0;
                  const avgBuy = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                  const avgSell = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                  const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;

                  return (
                    <tr 
                      key={item.item_id} 
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {isPositive ? <TrendingUp className="h-4 w-4 text-[#259783]" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                          <span className="font-bold text-slate-900 dark:text-white">{item.item_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">{item.quantity_sold.toFixed(1)}</td>
                      <td className="px-6 py-3 text-right text-slate-500">{formatPrice(avgBuy)}</td>
                      <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">{formatPrice(avgSell)}</td>
                      <td className={`px-6 py-3 text-right font-bold ${isPositive ? 'text-[#259783]' : 'text-red-500'}`}>
                        {formatPrice(avgProfit)}
                      </td>
                      <td className={`px-6 py-3 text-right font-black ${isPositive ? 'text-[#259783]' : 'text-red-500'}`}>
                        {formatPrice(item.total_profit)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={`text-xs font-bold px-1.5 py-0.5 ${isPositive ? 'bg-[#259783]/10 text-[#259783] border border-[#259783]/20' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                          {formatPercent(margin)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact Item Row Component
function ItemRow({ item, index, type, formatPrice }: {
  item: { item_id: string; item_name: string; total_profit: number; total_sales: number; total_cost: number; quantity_sold: number };
  index: number;
  type: 'top' | 'least' | 'low';
  formatPrice: (n: number) => string;
}) {
  const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
  const isNegative = item.total_profit < 0;
  
  const bgColor = type === 'top' 
    ? 'bg-[#259783]/5 border-[#259783]/20' 
    : isNegative 
    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' 
    : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800';
  
  const textColor = type === 'top' 
    ? 'text-[#259783]' 
    : isNegative 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-orange-600 dark:text-orange-400';

  return (
    <div className={`flex items-center gap-2 p-2.5 border-2 ${bgColor}`}>
      <div className={`w-6 h-6 flex items-center justify-center border-2 ${type === 'top' ? 'border-[#259783] bg-[#259783]' : isNegative ? 'border-red-500 bg-red-500' : 'border-orange-500 bg-orange-500'}`}>
        <span className="text-xs font-black text-white">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.item_name}</p>
        <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}%</p>
      </div>
      <p className={`text-xs font-black ${textColor}`}>
        {type === 'top' ? '+' : isNegative ? '-' : ''}{formatPrice(Math.abs(item.total_profit))}
      </p>
    </div>
  );
}
