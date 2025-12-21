'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, WifiOff, TrendingUp, TrendingDown, AlertTriangle, Download, ShoppingBag, Receipt, PieChart, Package, Target, CheckCircle2, XCircle, ChevronRight, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProfitCalendar } from './ProfitCalendar';

interface ProfitData {
  totalProfit: number;
  grossProfit: number;
  totalSales: number;
  totalCost: number;
  stockLosses?: {
    total: number;
    count: number;
    spoilage: number;
    theft: number;
    damage: number;
    other: number;
  };
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    return { start: today, end: today };
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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(todayStart);
    
    if (preset === 'week') {
      start.setDate(start.getDate() - 6);
    } else if (preset === 'month') {
      start.setDate(1);
    }
    
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    setDateRange({ start: formatDate(start), end: formatDate(todayStart) });
  }

  async function fetchProfitData() {
    try {
      setLoading(true);
      setError(null);
      
      const [startYear, startMonth, startDay] = dateRange.start.split('-').map(Number);
      const [endYear, endMonth, endDay] = dateRange.end.split('-').map(Number);
      
      const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
      const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
      
      const startTs = Math.floor(startDate.getTime() / 1000);
      const endTs = Math.floor(endDate.getTime() / 1000);
      
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
    const [startYear, startMonth, startDay] = dateRange.start.split('-').map(Number);
    const [endYear, endMonth, endDay] = dateRange.end.split('-').map(Number);
    
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
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
          <div className="w-10 h-10 mx-auto border-3 border-[#259783]/20 border-t-[#259783] animate-spin mb-3"></div>
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
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg px-4 py-4 border-b-2 border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white">Profit</h1>
              <p className="text-[10px] text-slate-500">Analytics & insights</p>
            </div>
          </div>
          <Link href="/admin" className="px-3 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
            Close
          </Link>
        </div>
      </div>

      {/* Offline */}
      {isOffline && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 w-fit mx-auto border-2 border-orange-200 dark:border-orange-800">
            <WifiOff className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-orange-700 text-xs font-bold">Offline</span>
          </div>
        </div>
      )}

      {/* Date Filter */}
      <div className="px-4 py-4">
        <div className="flex bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-1">
          {(['today', 'week', 'month'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-lg ${
                datePreset === preset
                  ? 'bg-[#259783] text-white shadow-md'
                  : 'text-slate-500'
              }`}
            >
              {preset === 'today' ? 'Today' : preset === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Profit Calendar Heatmap */}
      <div className="px-4 pb-4">
        <ProfitCalendar compact />
      </div>

      {/* Net Profit Status */}
      {hasExpenses && (
        <div className="px-4 pb-4">
          <div className={`p-3 border-2 flex items-center justify-between ${
            isProfitable 
              ? 'border-[#259783] bg-[#259783]' 
              : 'border-red-500 bg-red-500'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 flex items-center justify-center border-2 border-white/30">
                {isProfitable ? <CheckCircle2 className="w-4 h-4 text-white" /> : <XCircle className="w-4 h-4 text-white" />}
              </div>
              <div>
                <p className="text-white/80 text-[9px] font-black uppercase">{isProfitable ? 'Profitable' : 'At a Loss'}</p>
                <p className="text-white text-lg font-black">{isProfitable ? '+' : ''}{formatPrice(getNetProfit())}</p>
              </div>
            </div>
            <div className="text-right border-l-2 border-white/20 pl-3">
              <p className="text-white/60 text-[9px] uppercase font-bold">Safe to Bank</p>
              <p className="text-white text-base font-black">{formatPrice(Math.max(0, getNetProfit()))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Sales */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#259783]" />
              <span className="text-[9px] font-black text-slate-500 uppercase">Sales</span>
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(profitData?.totalSales || 0)}</p>
          </div>

          {/* COGS */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Receipt className="w-3.5 h-3.5 text-[#259783]" />
              <span className="text-[9px] font-black text-slate-500 uppercase">Cost</span>
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(profitData?.totalCost || 0)}</p>
          </div>

          {/* Gross Profit */}
          <div className="border-2 border-[#259783] bg-[#259783] p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-white/70" />
              <span className="text-[9px] font-black text-white/70 uppercase">Gross Profit</span>
            </div>
            <p className="text-xl font-black text-white">{formatPrice(profitData?.grossProfit || profitData?.totalProfit || 0)}</p>
          </div>

          {/* Margin */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <PieChart className="w-3.5 h-3.5 text-[#259783]" />
              <span className="text-[9px] font-black text-slate-500 uppercase">Margin</span>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {profitData?.profitMargin ? (profitData.profitMargin * 100).toFixed(0) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Stock Losses */}
      <div className="px-4 pb-4">
        {profitData?.stockLosses && profitData.stockLosses.total > 0 ? (
          <div className="p-3 border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[9px] font-black text-red-600 uppercase">Stock Losses</span>
                <span className="text-[8px] font-bold text-red-500 bg-red-100 px-1 rounded">
                  {profitData.stockLosses.count}
                </span>
              </div>
              <p className="text-base font-black text-red-600">-{formatPrice(profitData.stockLosses.total)}</p>
            </div>
            <div className="flex gap-2 text-[9px]">
              {profitData.stockLosses.spoilage > 0 && (
                <span className="text-red-600">Spoilage: {formatPrice(profitData.stockLosses.spoilage)}</span>
              )}
              {profitData.stockLosses.theft > 0 && (
                <span className="text-red-600">Theft: {formatPrice(profitData.stockLosses.theft)}</span>
              )}
              {profitData.stockLosses.damage > 0 && (
                <span className="text-red-600">Damage: {formatPrice(profitData.stockLosses.damage)}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2.5 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[9px] font-bold text-slate-500">Stock Losses</span>
              </div>
              <span className="text-sm font-black text-[#259783]">KES 0</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1">No spoilage, theft, or damage recorded</p>
          </div>
        )}
      </div>

      {/* Expenses Row */}
      {hasExpenses ? (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-black text-slate-900 dark:text-white">Operating Costs</h2>
            <Link href="/admin/expenses" className="text-[9px] font-bold text-[#259783] flex items-center gap-0.5">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="border-2 border-[#259783] bg-[#259783] p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Receipt className="w-3.5 h-3.5 text-white/70" />
                <span className="text-[9px] font-black text-white/70 uppercase">Expenses</span>
              </div>
              <p className="text-lg font-black text-white">{formatPrice(getDailyExpense())}</p>
              <p className="text-[9px] text-white/60">{getPeriodDays()} day{getPeriodDays() !== 1 ? 's' : ''}</p>
            </div>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-3.5 h-3.5 text-[#259783]" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Break-even</span>
              </div>
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(getBreakEvenSales())}</p>
              <p className="text-[9px] text-slate-500">Min. to survive</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <Link href="/admin/expenses">
            <div className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Receipt className="w-4 h-4 text-[#259783]" />
              <div className="flex-1">
                <p className="font-black text-xs text-slate-900 dark:text-white">Add Expenses</p>
                <p className="text-[9px] text-slate-500">See true profit</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#259783]" />
            </div>
          </Link>
        </div>
      )}

      {/* Top Items */}
      {topItems.length > 0 && (
        <div className="px-4 pb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2 pb-2 border-b-2 border-slate-200 dark:border-slate-800">
            <TrendingUp className="w-4 h-4 text-[#259783]" />
            Top Profit
          </h2>
          <div className="space-y-2.5">
            {topItems.map((item, i) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              return (
                <div key={item.item_id} className="flex items-center gap-3 p-3 border-2 border-[#259783]/20 bg-[#259783]/5">
                  <div className="w-8 h-8 border-2 border-[#259783] bg-[#259783] flex items-center justify-center">
                    <span className="text-xs font-black text-white">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}%</p>
                  </div>
                  <p className="text-sm font-black text-[#259783]">+{formatPrice(item.total_profit)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Least Profitable */}
      {leastItems.length > 0 && (
        <div className="px-4 pb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2 pb-2 border-b-2 border-slate-200 dark:border-slate-800">
            <TrendingDown className="w-4 h-4 text-[#259783]" />
            Least Profitable
          </h2>
          <div className="space-y-2.5">
            {leastItems.map((item, i) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const isNeg = item.total_profit < 0;
              return (
                <div key={item.item_id} className={`flex items-center gap-3 p-3 border-2 ${
                  isNeg ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}>
                  <div className={`w-8 h-8 border-2 flex items-center justify-center ${
                    isNeg ? 'border-red-500 bg-red-500' : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700'
                  }`}>
                    <span className={`text-xs font-black ${isNeg ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}%</p>
                  </div>
                  <p className={`text-sm font-black ${isNeg ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
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
        <div className="px-4 pb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2 pb-2 border-b-2 border-slate-200 dark:border-slate-800">
            <Package className="w-4 h-4 text-[#259783]" />
            All Items ({profitData.itemProfits.length})
          </h2>
          <div className="space-y-2.5">
            {profitData.itemProfits.sort((a, b) => b.total_profit - a.total_profit).map((item) => {
              const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
              const isPos = item.total_profit >= 0;
              return (
                <div key={item.item_id} className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className={`w-8 h-8 border-2 flex items-center justify-center ${
                    isPos ? 'border-[#259783] bg-[#259783]' : 'border-red-500 bg-red-500'
                  }`}>
                    {isPos ? <TrendingUp className="w-4 h-4 text-white" /> : <TrendingDown className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-slate-900 dark:text-white truncate">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold • {margin.toFixed(0)}% margin</p>
                  </div>
                  <p className={`text-sm font-black ${isPos ? 'text-[#259783]' : 'text-red-500'}`}>
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
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-[#259783]" />
              Restock Alerts
            </h2>
            <Link href="/admin/stock" className="text-[10px] font-bold text-[#259783]">View All</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {lowStockItems.map((item) => {
              const isCritical = item.current_stock <= 3;
              return (
                <div key={item.id} className={`flex-none w-36 p-3 border-2 ${
                  isCritical ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                }`}>
                  <p className="font-black text-sm text-slate-900 truncate mb-1">{item.name}</p>
                  <p className={`text-xs font-black ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
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
        <button className="shadow-lg shadow-[#259783]/30 flex items-center gap-2 bg-[#259783] active:scale-95 transition-transform text-white font-bold text-sm px-5 py-2.5 rounded-lg">
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
