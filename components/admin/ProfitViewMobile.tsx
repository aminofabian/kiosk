'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, WifiOff, TrendingUp, TrendingDown, AlertTriangle, Download, ShoppingBag, Receipt, PieChart, Package, Target, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
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
  expenseCount: number;
}

interface LowStockItem {
  id: string;
  name: string;
  current_stock: number;
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
    return { start: todayStart.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => { updateDateRangeFromPreset(datePreset); }, [datePreset]);
  useEffect(() => { fetchProfitData(); fetchExpenseData(); }, [dateRange]);
  useEffect(() => { fetchLowStockItems(); }, []);

  async function fetchExpenseData() {
    try {
      const response = await fetch('/api/expenses/daily-cost');
      const result = await response.json();
      if (result.success) setExpenseData(result.data);
    } catch (err) { console.error('Error fetching expenses:', err); }
  }

  function updateDateRangeFromPreset(preset: DatePreset) {
    const today = new Date();
    const start = new Date();
    if (preset === 'today') start.setHours(0, 0, 0, 0);
    else if (preset === 'week') start.setDate(today.getDate() - 7);
    else start.setDate(1);
    setDateRange({ start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] });
  }

  async function fetchProfitData() {
    try {
      setLoading(true);
      setError(null);
      const startTs = Math.floor(new Date(dateRange.start).getTime() / 1000);
      const endTs = Math.floor(new Date(dateRange.end + 'T23:59:59').getTime() / 1000);
      const response = await fetch(`/api/profit?start=${startTs}&end=${endTs}`);
      const result = await response.json();
      if (result.success) setProfitData(result.data);
      else setError(result.message || 'Failed to load');
    } catch {
      setError('Failed to load');
      setIsOffline(true);
    } finally { setLoading(false); }
  }

  async function fetchLowStockItems() {
    try {
      const response = await fetch('/api/stock');
      const result = await response.json();
      if (result.success) {
        const lowStock = result.data
          .filter((item: { current_stock: number }) => item.current_stock > 0 && item.current_stock < 10)
          .sort((a: { current_stock: number }, b: { current_stock: number }) => a.current_stock - b.current_stock)
          .slice(0, 5);
        setLowStockItems(lowStock);
      }
    } catch (err) { console.error('Error:', err); }
  }

  const formatPrice = (price: number) => `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  
  const getPeriodDays = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getDailyExpense = () => expenseData ? expenseData.dailyOperatingCost * getPeriodDays() : 0;
  const getNetProfit = () => profitData ? profitData.totalProfit - getDailyExpense() : 0;
  const getBreakEvenSales = () => {
    if (!expenseData || !profitData) return 0;
    const margin = profitData.profitMargin || 0.25;
    return margin > 0 ? (expenseData.dailyOperatingCost * getPeriodDays()) / margin : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-[#0f1a0d]">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto border-3 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin mb-3"></div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !profitData) {
    return (
      <div className="flex items-center justify-center h-screen p-4 bg-slate-50 dark:bg-[#0f1a0d]">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const hasExpenses = expenseData && expenseData.expenseCount > 0;
  const isProfitable = getNetProfit() >= 0;
  const topItems = profitData?.itemProfits.filter(i => i.total_profit > 0).sort((a, b) => b.total_profit - a.total_profit).slice(0, 3) || [];
  const leastItems = profitData?.itemProfits.sort((a, b) => a.total_profit - b.total_profit).slice(0, 3) || [];

  return (
    <div className="bg-slate-50 dark:bg-[#0f1a0d] min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-50/95 dark:bg-[#0f1a0d]/95 backdrop-blur-sm px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Profit</h1>
          </div>
          <Link href="/admin" className="px-3 py-1.5 text-xs font-semibold bg-slate-200 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-300">
            Close
          </Link>
        </div>
      </div>

      {/* Offline */}
      {isOffline && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 w-fit mx-auto">
            <WifiOff className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-orange-700 text-xs font-medium">Offline</span>
          </div>
        </div>
      )}

      {/* Date Filter */}
      <div className="px-4 py-3">
        <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          {(['today', 'week', 'month'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`flex-1 py-2 text-xs font-semibold rounded-md capitalize transition-all ${
                datePreset === preset
                  ? 'bg-[#259783] text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {preset === 'today' ? 'Today' : preset === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Net Profit Status */}
      {hasExpenses && (
        <div className="px-4 pb-3">
          <div className={`p-3 rounded-xl flex items-center justify-between ${
            isProfitable 
              ? 'bg-green-500' 
              : 'bg-red-500'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                {isProfitable ? <CheckCircle2 className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className="text-white/80 text-[10px] font-bold uppercase">{isProfitable ? 'Profitable' : 'At a Loss'}</p>
                <p className="text-white text-xl font-black">{isProfitable ? '+' : ''}{formatPrice(getNetProfit())}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-[10px] uppercase font-medium">Safe to Bank</p>
              <p className="text-white text-lg font-bold">{formatPrice(Math.max(0, getNetProfit()))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Sales */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Sales</span>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{formatPrice(profitData?.totalSales || 0)}</p>
          </div>

          {/* COGS */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <Receipt className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Cost</span>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">{formatPrice(profitData?.totalCost || 0)}</p>
          </div>

          {/* Gross Profit */}
          <div className="bg-[#259783] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-white/70" />
              <span className="text-[10px] font-semibold text-white/70 uppercase">Gross Profit</span>
            </div>
            <p className="text-2xl font-black text-white">{formatPrice(profitData?.totalProfit || 0)}</p>
          </div>

          {/* Margin */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-1.5 mb-1">
              <PieChart className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Margin</span>
            </div>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
              {profitData?.profitMargin ? (profitData.profitMargin * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Expenses Row */}
      {hasExpenses ? (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Operating Costs</h2>
            <Link href="/admin/expenses" className="text-[10px] font-semibold text-[#259783] flex items-center gap-0.5">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Receipt className="w-3.5 h-3.5 text-white/70" />
                <span className="text-[10px] font-semibold text-white/70 uppercase">Expenses</span>
              </div>
              <p className="text-xl font-black text-white">{formatPrice(getDailyExpense())}</p>
              <p className="text-[10px] text-white/60">{getPeriodDays()} day{getPeriodDays() !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-semibold text-amber-600 uppercase">Break-even</span>
              </div>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300">{formatPrice(getBreakEvenSales())}</p>
              <p className="text-[10px] text-amber-600/70">Min. to survive</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <Link href="/admin/expenses">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Receipt className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Add Expenses</p>
                <p className="text-[10px] text-amber-700">See true profit</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500" />
            </div>
          </Link>
        </div>
      )}

      {/* Top Items */}
      {topItems.length > 0 && (
        <div className="px-4 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Top Profit
          </h2>
          <div className="space-y-2">
            {topItems.map((item, i) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const emojis = ['🥇', '🥈', '🥉'];
              return (
                <div key={item.item_id} className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-lg">{emojis[i]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}%</p>
                  </div>
                  <p className="text-sm font-bold text-green-600">+{formatPrice(item.total_profit)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Least Profitable */}
      {leastItems.length > 0 && (
        <div className="px-4 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-orange-500" />
            Least Profitable
          </h2>
          <div className="space-y-2">
            {leastItems.map((item, i) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const isNeg = item.total_profit < 0;
              return (
                <div key={item.item_id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                  isNeg ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30'
                }`}>
                  <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                    isNeg ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}%</p>
                  </div>
                  <p className={`text-sm font-bold ${isNeg ? 'text-red-600' : 'text-orange-600'}`}>
                    {isNeg ? '-' : ''}{formatPrice(Math.abs(item.total_profit))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Items */}
      {profitData && profitData.itemProfits.length > 0 && (
        <div className="px-4 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-slate-500" />
            All Items ({profitData.itemProfits.length})
          </h2>
          <div className="space-y-2">
            {profitData.itemProfits.sort((a, b) => b.total_profit - a.total_profit).map((item) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const isPos = item.total_profit >= 0;
              return (
                <div key={item.item_id} className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isPos ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isPos ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}% margin</p>
                  </div>
                  <p className={`text-sm font-bold ${isPos ? 'text-green-600' : 'text-red-500'}`}>
                    {isPos ? '+' : ''}{formatPrice(item.total_profit)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Restock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="px-4 pb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-500" />
              Restock Alerts
            </h2>
            <Link href="/admin/stock" className="text-[10px] font-semibold text-[#259783]">View All</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {lowStockItems.map((item) => {
              const isCritical = item.current_stock <= 3;
              return (
                <div key={item.id} className={`flex-none w-36 p-3 rounded-xl ${
                  isCritical ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100'
                } border`}>
                  <p className="font-semibold text-sm text-slate-900 truncate mb-1">{item.name}</p>
                  <p className={`text-xs font-bold ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}>
                    {item.current_stock} left
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export Button */}
      <div className="fixed bottom-20 left-0 w-full px-4 flex justify-center z-40">
        <button className="shadow-lg shadow-[#259783]/30 flex items-center gap-2 bg-[#259783] active:scale-95 transition-transform text-white font-semibold text-sm px-5 py-2.5 rounded-full">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
