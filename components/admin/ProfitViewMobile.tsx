'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, WifiOff, TrendingUp, TrendingDown, AlertTriangle, Download, ShoppingBag, Receipt, PieChart, Package, Target, Wallet, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProfitData {
  totalProfit: number;
  totalSales: number;
  totalCost: number;
  profitMargin: number;
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

interface LowStockItem {
  id: string;
  name: string;
  current_stock: number;
  unit_type: string;
}

type DatePreset = 'today' | 'week' | 'month';

export function ProfitViewMobile() {
  const router = useRouter();
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseSummary | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      start: todayStart.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };
  });
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    updateDateRangeFromPreset(datePreset);
  }, [datePreset]);

  useEffect(() => {
    fetchProfitData();
    fetchExpenseData();
  }, [dateRange]);

  useEffect(() => {
    fetchLowStockItems();
  }, []);

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
      setIsOffline(true);
      console.error('Error fetching profit:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLowStockItems() {
    try {
      const response = await fetch('/api/stock');
      const result = await response.json();

      if (result.success) {
        const lowStock = result.data
          .filter((item: any) => item.current_stock > 0 && item.current_stock < 10)
          .sort((a: any, b: any) => a.current_stock - b.current_stock)
          .slice(0, 5)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            current_stock: item.current_stock,
            unit_type: item.unit_type,
          }));
        setLowStockItems(lowStock);
      }
    } catch (err) {
      console.error('Error fetching low stock items:', err);
    }
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
    const avgMargin = profitData.profitMargin || 0.25;
    if (avgMargin <= 0) return 0;
    return (expenseData.dailyOperatingCost * getPeriodDays()) / avgMargin;
  };

  const getStockStatus = (stock: number) => {
    if (stock <= 3) return { label: 'Critical', color: 'red', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-900/30' };
    if (stock <= 5) return { label: 'Low', color: 'yellow', bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-100 dark:border-yellow-900/30' };
    return { label: 'Low', color: 'yellow', bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-100 dark:border-yellow-900/30' };
  };

  const topProfitItems = profitData?.itemProfits
    .filter(item => item.total_profit > 0)
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 3) || [];

  const leastProfitItems = profitData?.itemProfits
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 3) || [];

  const lowProfitItems = profitData?.itemProfits
    .filter(item => {
      const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
      return item.total_profit < 0 || margin < 5;
    })
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 3) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading profit data...</p>
        </div>
      </div>
    );
  }

  if (error && !profitData) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-red-600 font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  const salesValue = profitData?.totalSales || 0;
  const costValue = profitData?.totalCost || 0;
  const profitValue = profitData?.totalProfit || 0;
  const marginPercent = profitData?.profitMargin ? (profitData.profitMargin * 100).toFixed(0) : '0';

  return (
    <div className="bg-[#f6f8f6] dark:bg-[#132210] min-h-screen pb-28">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Top App Bar */}
      <div className="sticky top-0 z-50 flex items-center bg-[#f6f8f6]/95 dark:bg-[#132210]/95 backdrop-blur-sm p-4 justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-900 dark:text-white" />
          </button>
          <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
            Profit Dashboard
          </h2>
        </div>
        <Link
          href="/admin"
          className="flex px-4 py-2 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 active:scale-95 transition-transform"
        >
          <p className="text-slate-900 dark:text-white text-sm font-bold leading-normal tracking-[0.015em]">
            Close
          </p>
        </Link>
      </div>

      {/* Offline Indicator */}
      {isOffline && (
        <div className="w-full flex justify-center py-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800">
            <WifiOff className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <p className="text-orange-800 dark:text-orange-200 text-xs font-medium">
              Offline Mode: Showing local data
            </p>
          </div>
        </div>
      )}

      {/* Date Filter (Segmented Buttons) */}
      <div className="px-4 py-2">
        <div className="flex h-12 w-full items-center justify-center rounded-full bg-white dark:bg-[#1c2e18] p-1 shadow-sm border border-slate-100 dark:border-slate-800">
          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 transition-all duration-200">
            <input
              checked={datePreset === 'today'}
              className="hidden peer"
              name="date-filter"
              type="radio"
              value="today"
              onChange={() => setDatePreset('today')}
            />
            <span
              className={`truncate text-sm font-bold z-10 ${
                datePreset === 'today'
                  ? 'text-white bg-[#259783] rounded-full px-2 py-1 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Today
            </span>
          </label>
          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 transition-all duration-200">
            <input
              checked={datePreset === 'week'}
              className="hidden peer"
              name="date-filter"
              type="radio"
              value="week"
              onChange={() => setDatePreset('week')}
            />
            <span
              className={`truncate text-sm font-bold z-10 ${
                datePreset === 'week'
                  ? 'text-white bg-[#259783] rounded-full px-2 py-1 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              This Week
            </span>
          </label>
          <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-full px-2 transition-all duration-200">
            <input
              checked={datePreset === 'month'}
              className="hidden peer"
              name="date-filter"
              type="radio"
              value="month"
              onChange={() => setDatePreset('month')}
            />
            <span
              className={`truncate text-sm font-bold z-10 ${
                datePreset === 'month'
                  ? 'text-white bg-[#259783] rounded-full px-2 py-1 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              This Month
            </span>
          </label>
        </div>
      </div>

      {/* Profitability Status Banner */}
      {expenseData && expenseData.expenseCount > 0 && (
        <div className="px-4 pt-4">
          <div className={`p-4 rounded-2xl ${
            getNetProfit() >= 0 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
              : 'bg-gradient-to-r from-red-500 to-orange-600'
          } shadow-lg relative overflow-hidden`}>
            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  {getNetProfit() >= 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <XCircle className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-white/90 text-xs font-bold uppercase tracking-wider mb-0.5">
                    {getNetProfit() >= 0 ? '🟢 PROFITABLE' : '🔴 AT A LOSS'}
                  </p>
                  <p className="text-white text-2xl font-black">
                    {getNetProfit() >= 0 ? '+' : ''}{formatPrice(getNetProfit())}
                  </p>
                  <p className="text-white/70 text-xs">Net Profit</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs font-semibold uppercase mb-1">Safe to Bank</p>
                <p className="text-white text-xl font-bold">
                  {formatPrice(Math.max(0, getNetProfit()))}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Today at a Glance */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-slate-900 dark:text-white tracking-tight text-lg font-bold leading-tight mb-3">
          {datePreset === 'today' ? 'Today' : datePreset === 'week' ? 'This Week' : 'This Month'} at a Glance
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Sales */}
          <div className="flex flex-col p-4 bg-white dark:bg-[#1c2e18] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingBag className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                Sales
              </span>
            </div>
            <span className="text-slate-900 dark:text-white text-2xl font-black">
              {formatPrice(salesValue)}
            </span>
          </div>

          {/* Cost of Goods */}
          <div className="flex flex-col p-4 bg-white dark:bg-[#1c2e18] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 mb-1">
              <Receipt className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                COGS
              </span>
            </div>
            <span className="text-slate-900 dark:text-white text-2xl font-black">
              {formatPrice(costValue)}
            </span>
          </div>

          {/* Gross Profit */}
          <div className="flex flex-col p-4 bg-[#259783] rounded-2xl shadow-lg shadow-[#259783]/20 relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] w-16 h-16 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
            <div className="flex items-center gap-1.5 mb-1 z-10">
              <TrendingUp className="w-4 h-4 text-white/90" />
              <span className="text-white/90 text-xs font-bold uppercase tracking-wider">
                Gross Profit
              </span>
            </div>
            <span className="text-white text-3xl font-black z-10">
              {formatPrice(profitValue)}
            </span>
          </div>

          {/* Margin */}
          <div className="flex flex-col p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-1.5 mb-1">
              <PieChart className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                Margin
              </span>
            </div>
            <span className="text-blue-800 dark:text-blue-200 text-3xl font-black">
              {marginPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Operating Expenses Section */}
      {expenseData && expenseData.expenseCount > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-900 dark:text-white tracking-tight text-lg font-bold leading-tight">
              Operating Costs
            </h2>
            <Link
              href="/admin/expenses"
              className="text-[#259783] text-xs font-bold bg-[#259783]/10 px-3 py-1.5 rounded-full flex items-center gap-1"
            >
              Manage
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Daily Operating Cost */}
            <div className="flex flex-col p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg shadow-orange-500/20 relative overflow-hidden">
              <div className="absolute right-[-10px] top-[-10px] w-16 h-16 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center gap-1.5 mb-1 z-10">
                <Receipt className="w-4 h-4 text-white/90" />
                <span className="text-white/90 text-xs font-bold uppercase tracking-wider">
                  Expenses
                </span>
              </div>
              <span className="text-white text-2xl font-black z-10">
                {formatPrice(getDailyExpense())}
              </span>
              <span className="text-white/70 text-xs z-10">
                {getPeriodDays()} day{getPeriodDays() !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Break-even Sales */}
            <div className="flex flex-col p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                  Break-even
                </span>
              </div>
              <span className="text-amber-800 dark:text-amber-200 text-2xl font-black">
                {formatPrice(getBreakEvenSales())}
              </span>
              <span className="text-amber-600/70 dark:text-amber-400/70 text-xs">
                Min. to survive
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No Expenses Banner */}
      {(!expenseData || expenseData.expenseCount === 0) && (
        <div className="px-4 pt-4">
          <Link href="/admin/expenses">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-800 dark:text-amber-200 text-sm">
                  Add Operating Expenses
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-xs">
                  See your true profit after rent, salaries, etc.
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500 flex-shrink-0" />
            </div>
          </Link>
        </div>
      )}

      {/* Top Profit Items */}
      {topProfitItems.length > 0 && (
        <div className="mt-6 px-4">
          <h3 className="text-slate-900 dark:text-white text-lg font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Top Profit Items
          </h3>
          <div className="flex flex-col gap-3">
            {topProfitItems.map((item, index) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
              const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
              const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
              const emojis = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={item.item_id}
                  className="flex flex-col p-4 rounded-xl bg-white dark:bg-[#1c2e18] shadow-sm border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-xl shrink-0">
                      {emojis[index] || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white font-bold text-base">
                        {item.item_name}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                        {item.quantity_sold.toFixed(0)} sold • {margin.toFixed(1)}% margin
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-600 dark:text-green-400 font-bold text-lg">
                        +{formatPrice(item.total_profit)}
                      </p>
                      <p className="text-green-600/70 dark:text-green-400/70 text-xs font-medium">
                        {formatPrice(avgProfit)}/unit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Buy Price</p>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgBuyPrice)}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sell Price</p>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgSellPrice)}</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Profit/Unit</p>
                      <p className="text-green-600 dark:text-green-400 font-semibold text-sm">+{formatPrice(avgProfit)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Least Profitable Items */}
      {leastProfitItems.length > 0 && (
        <div className="mt-6 px-4">
          <h3 className="text-slate-900 dark:text-white text-lg font-bold mb-3 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-orange-500" />
            Least Profitable
          </h3>
          <div className="flex flex-col gap-3">
            {leastProfitItems.map((item, index) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
              const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
              const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
              const isNegative = item.total_profit < 0;
              const bgColor = isNegative
                ? 'bg-red-50 dark:bg-red-900/10'
                : 'bg-orange-50 dark:bg-orange-900/10';
              const borderColor = isNegative
                ? 'border-red-100 dark:border-red-900/30'
                : 'border-orange-100 dark:border-orange-900/30';
              const textColor = isNegative
                ? 'text-red-600 dark:text-red-400'
                : 'text-orange-600 dark:text-orange-400';
              
              return (
                <div
                  key={item.item_id}
                  className={`flex flex-col p-4 rounded-xl ${bgColor} shadow-sm border ${borderColor}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${isNegative ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white font-bold text-base">
                        {item.item_name}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                        {item.quantity_sold.toFixed(0)} sold • {margin.toFixed(1)}% margin
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`${textColor} font-bold text-lg`}>
                        {isNegative ? '-' : ''}{formatPrice(Math.abs(item.total_profit))}
                      </p>
                      <p className={`${textColor}/70 text-xs font-medium`}>
                        {formatPrice(avgProfit)}/unit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Buy Price</p>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgBuyPrice)}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sell Price</p>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgSellPrice)}</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Profit/Unit</p>
                      <p className={`${textColor} font-semibold text-sm`}>{formatPrice(avgProfit)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low / Negative Profit */}
      {lowProfitItems.length > 0 && (
        <div className="mt-6 px-4">
          <h3 className="text-slate-900 dark:text-white text-lg font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Low / Negative Profit
          </h3>
          <div className="flex flex-col gap-3">
            {lowProfitItems.map((item) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const isNegative = item.total_profit < 0;
              const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
              const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
              const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
              const bgColor = isNegative
                ? 'bg-red-50 dark:bg-red-900/10'
                : 'bg-orange-50 dark:bg-orange-900/10';
              const borderColor = isNegative
                ? 'border-red-100 dark:border-red-900/30'
                : 'border-orange-100 dark:border-orange-900/30';
              const textColor = isNegative
                ? 'text-red-600 dark:text-red-400'
                : 'text-orange-600 dark:text-orange-400';
              const iconColor = isNegative
                ? 'text-red-600 dark:text-red-400'
                : 'text-orange-600 dark:text-orange-400';

              return (
                <div
                  key={item.item_id}
                  className={`flex flex-col p-4 rounded-xl ${bgColor} shadow-sm border ${borderColor}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-full bg-white dark:bg-opacity-30 flex items-center justify-center ${iconColor} shrink-0`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white font-bold text-base">
                        {item.item_name}
                      </p>
                      <p className={`${textColor}/80 text-xs font-bold`}>
                        {isNegative
                          ? 'Spoilage / Waste'
                          : `Very Low Margin (${margin.toFixed(1)}%)`} • {item.quantity_sold.toFixed(0)} sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`${textColor} font-bold text-lg`}>
                        {isNegative ? '-' : '+'}{formatPrice(Math.abs(item.total_profit))}
                      </p>
                      <p className={`${textColor}/70 text-xs font-medium`}>
                        {formatPrice(avgProfit)}/unit
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Buy Price</p>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgBuyPrice)}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sell Price</p>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgSellPrice)}</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Profit/Unit</p>
                      <p className={`${textColor} font-semibold text-sm`}>{formatPrice(avgProfit)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Items List */}
      {profitData && profitData.itemProfits.length > 0 && (
        <div className="mt-6 px-4 mb-6">
          <h3 className="text-slate-900 dark:text-white text-lg font-bold mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-slate-500" />
            All Items ({profitData.itemProfits.length})
          </h3>
          <div className="flex flex-col gap-3">
            {profitData.itemProfits
              .sort((a, b) => b.total_profit - a.total_profit)
              .map((item) => {
                const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                const isPositive = item.total_profit >= 0;
                const avgBuyPrice = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;

                return (
                  <div
                    key={item.item_id}
                    className="flex flex-col p-4 rounded-xl bg-white dark:bg-[#1c2e18] shadow-sm border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isPositive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        {isPositive ? (
                          <TrendingUp className={`w-5 h-5 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white font-bold text-base">
                          {item.item_name}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                          {item.quantity_sold.toFixed(0)} sold • {margin.toFixed(1)}% margin
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {isPositive ? '+' : ''}{formatPrice(item.total_profit)}
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
                          {formatPrice(avgProfit)}/unit
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Buy Price</p>
                        <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgBuyPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sell Price</p>
                        <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">{formatPrice(avgSellPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Profit/Unit</p>
                        <p className={`font-semibold text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {isPositive ? '+' : ''}{formatPrice(avgProfit)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Cost</p>
                        <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">{formatPrice(item.total_cost)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Sales</p>
                        <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">{formatPrice(item.total_sales)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Margin</p>
                        <p className={`font-medium text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Restock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="mt-8 px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-900 dark:text-white text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              Restock Alerts
            </h3>
            <Link
              href="/admin/stock"
              className="text-[#3abd21] dark:text-[#259783] text-xs font-bold bg-[#259783]/10 dark:bg-[#259783]/20 px-3 py-1.5 rounded-full"
            >
              See All Inventory
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 snap-x">
            {lowStockItems.map((item) => {
              const status = getStockStatus(item.current_stock);
              const isCritical = status.color === 'red';
              const indicatorColor = isCritical ? 'bg-red-500' : 'bg-yellow-500';
              const ringColor = isCritical
                ? 'ring-red-200 dark:ring-red-900'
                : 'ring-yellow-200 dark:ring-yellow-900';
              const stockTextColor = isCritical
                ? 'text-red-700 dark:text-red-400'
                : 'text-yellow-700 dark:text-yellow-500';

              return (
                <div
                  key={item.id}
                  className={`snap-start flex-none w-[180px] p-4 rounded-xl ${status.bg} border-2 ${status.border} flex flex-col justify-between h-[140px]`}
                >
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-opacity-40 flex items-center justify-center shadow-sm text-lg">
                      📦
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${indicatorColor} ${isCritical ? 'animate-pulse' : ''} ring-2 ${ringColor}`}
                    ></div>
                  </div>
                  <div>
                    <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight mb-1">
                      {item.name}
                    </p>
                    <p className={`${stockTextColor} text-sm font-extrabold`}>
                      {item.current_stock} REMAINING
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Action Button / Bottom Bar */}
      <div className="fixed bottom-20 left-0 w-full px-4 flex justify-center z-40 pointer-events-none">
        <button
          onClick={() => {
            // TODO: Implement CSV export
            console.log('Export report');
          }}
          className="pointer-events-auto shadow-xl shadow-[#259783]/30 flex items-center gap-2 bg-[#259783] hover:bg-[#3abd21] active:scale-95 transition-all text-white font-bold text-base px-6 py-3.5 rounded-full"
        >
          <Download className="w-5 h-5" />
          Export Report (CSV)
        </button>
      </div>
    </div>
  );
}
