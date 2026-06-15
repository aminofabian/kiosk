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
  Pencil,
  Layers,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { ProfitCalendar } from '@/components/admin/ProfitCalendar';
import { LatestSalesCard } from '@/components/admin/LatestSalesCard';
import {
  getLocalPeriodDayCount,
  getLocalTodayDateString,
  getProfitPresetDateRange,
  localDateStringsToTimestamps,
  type ProfitDatePreset,
} from '@/lib/utils/local-date-range';

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
  paidRevenue?: number;
  creditRevenue?: number;
  totalOutstandingCredit?: number;
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

interface BatchProfit {
  batchId: string;
  batchNumber: string;
  itemId: string;
  itemName: string;
  variantName: string | null;
  parentName: string | null;
  supplierName: string | null;
  quantitySold: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
}

type DatePreset = ProfitDatePreset;

const DATE_PRESET_ORDER: DatePreset[] = ['today', 'yesterday', 'last3days', 'last7days', 'month', 'custom'];

const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last3days: 'Last 3 days',
  last7days: 'Last 7 days',
  month: 'Month',
  custom: 'Custom',
};

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
  const { productTypes, itemTypeKeys } = useItemTypes();
  const [allData, setAllData] = useState<ProfitData | null>(null);
  const [typeData, setTypeData] = useState<Record<string, ProfitData | null>>({});
  const [expenseData, setExpenseData] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState(() => {
    const today = getLocalTodayDateString();
    return { start: today, end: today };
  });
  const [itemSearch, setItemSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [batchView, setBatchView] = useState(false);
  const [batchData, setBatchData] = useState<BatchProfit[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ item_id: string; item_name: string } | null>(null);
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { updateDateRange(datePreset); }, [datePreset]);

  async function openEditPrices(item: ItemProfit & { department: string }) {
    setEditingItem({ item_id: item.item_id, item_name: item.item_name });
    setEditSellPrice('');
    setEditBuyPrice('');
    setEditPriceOpen(true);
    setEditLoading(true);
    try {
      const res = await fetch(`/api/items/${item.item_id}`);
      const result = await res.json();
      if (result.success && result.data) {
        const sell = result.data.current_sell_price ?? (item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0);
        const buy = result.data.buy_price ?? (item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0);
        setEditSellPrice(String(sell));
        setEditBuyPrice(String(buy));
      }
    } catch {
      toast.error('Failed to load item');
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEditPrices() {
    if (!editingItem) return;
    const sellNum = parseFloat(editSellPrice);
    const buyNum = parseFloat(editBuyPrice);
    if (isNaN(sellNum) || sellNum < 0) {
      toast.error('Invalid sell price');
      return;
    }
    if (isNaN(buyNum) || buyNum < 0) {
      toast.error('Invalid cost price');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/items/${editingItem.item_id}/prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellPrice: sellNum, buyPrice: buyNum }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Prices updated');
        setEditPriceOpen(false);
        setEditingItem(null);
        fetchData();
      } else {
        toast.error(result.message ?? 'Failed to update');
      }
    } catch {
      toast.error('Failed to update prices');
    } finally {
      setEditSaving(false);
    }
  }

  function updateDateRange(preset: DatePreset) {
    const range = getProfitPresetDateRange(preset);
    if (range) setDateRange(range);
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
      const { start: startTs, end: endTs } = localDateStringsToTimestamps(dateRange.start, dateRange.end);

      const allRes = await fetch(`/api/profit?start=${startTs}&end=${endTs}`).then((r) => r.json());
      if (allRes.success) setAllData(allRes.data);

      const typeResList = await Promise.all(
        itemTypeKeys.map((key) =>
          fetch(`/api/profit?start=${startTs}&end=${endTs}&itemType=${encodeURIComponent(key)}`).then((r) => r.json())
        )
      );
      const next: Record<string, ProfitData | null> = {};
      itemTypeKeys.forEach((key, i) => {
        next[key] = typeResList[i]?.success ? typeResList[i].data : null;
      });
      setTypeData(next);
    } catch {
      setError('Failed to load profit data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, itemTypeKeys]);

  useEffect(() => {
    fetchData();
    fetchExpenseData();
  }, [fetchData]);

  // Fetch batch profit when batch view is on
  const fetchBatchData = useCallback(async () => {
    if (!batchView) return;
    setBatchLoading(true);
    try {
      const { start: startTs, end: endTs } = localDateStringsToTimestamps(dateRange.start, dateRange.end);
      const params = new URLSearchParams({ start: String(startTs), end: String(endTs) });
      if (itemSearch) params.set('itemSearch', itemSearch);
      if (batchFilter) params.set('batchFilter', batchFilter);
      const res = await fetch(`/api/profit/batches?${params}`).then((r) => r.json());
      if (res.success) setBatchData(res.data ?? []);
      else setBatchData([]);
    } catch {
      setBatchData([]);
    } finally {
      setBatchLoading(false);
    }
  }, [batchView, dateRange, itemSearch, batchFilter]);

  useEffect(() => {
    if (!batchView) return;
    const t = setTimeout(fetchBatchData, 200);
    return () => clearTimeout(t);
  }, [batchView, fetchBatchData]);

  const getPeriodDays = () => getLocalPeriodDayCount(dateRange.start, dateRange.end);
  const getTotalExpenses = () => expenseData ? expenseData.dailyOperatingCost * getPeriodDays() : 0;

  const grossProfit = allData?.grossProfit ?? 0;
  const grossMargin = allData?.grossMargin ?? (allData?.totalSales ? grossProfit / allData.totalSales : 0);
  const getNetProfit = () => grossProfit - getTotalExpenses();
  const hasExpenses = expenseData && expenseData.expenseCount > 0;
  const isProfitable = getNetProfit() >= 0;
  const netProfit = getNetProfit();
  const totalExpenses = getTotalExpenses();
  const periodDays = getPeriodDays();

  // Department data (dynamic by product types)
  const totalSalesCombined = useMemo(
    () => itemTypeKeys.reduce((sum, key) => sum + (typeData[key]?.totalSales ?? 0), 0),
    [itemTypeKeys, typeData]
  );
  const getTypePct = (key: string) =>
    totalSalesCombined > 0 ? ((typeData[key]?.totalSales ?? 0) / totalSalesCombined) * 100 : 0;

  // Items (department = type key). Fallback to allData.itemProfits if per-type fetches return empty.
  const allItems: (ItemProfit & { department: string })[] = useMemo(() => {
    const fromTypes = itemTypeKeys.flatMap((key) =>
      (typeData[key]?.itemProfits ?? []).map((i) => ({ ...i, department: key }))
    );
    if (fromTypes.length > 0) return fromTypes;
    return (allData?.itemProfits ?? []).map((i) => ({ ...i, department: 'retail' }));
  }, [itemTypeKeys, typeData, allData]);

  const topItemsByType = useMemo(
    () =>
      Object.fromEntries(
        itemTypeKeys.map((key) => [
          key,
          [...(typeData[key]?.itemProfits ?? [])].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5),
        ])
      ),
    [itemTypeKeys, typeData]
  );

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
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
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
        {/* Compact Header with inline date filter */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1c6a1e] flex items-center justify-center rounded-lg shrink-0">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white">Profit Overview</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Profit by department</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                  {DATE_PRESET_ORDER.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setDatePreset(preset)}
                      className={`px-2.5 py-1 text-[11px] font-bold transition-all rounded ${
                        datePreset === preset ? 'bg-[#1c6a1e] text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {DATE_PRESET_LABEL[preset]}
                    </button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-md">
                    <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="h-6 w-28 text-[11px] border-0 bg-transparent p-1" />
                    <span className="text-slate-400 text-[10px]">to</span>
                    <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="h-6 w-28 text-[11px] border-0 bg-transparent p-1" />
                  </div>
                )}
                <span className="text-[10px] text-slate-400 font-medium">{periodDays}d</span>
                <Button onClick={fetchData} variant="outline" size="sm" className="h-7 text-[11px] px-2">
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 pb-24 md:pb-6 max-w-5xl mx-auto space-y-4">
          {/* Compact Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Card className={`border-0 shadow-md ${isProfitable ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  {isProfitable ? <TrendingUp className="w-4 h-4 text-white/80" /> : <TrendingDown className="w-4 h-4 text-white/80" />}
                  <Badge className="bg-white/20 text-white border-0 text-[9px] px-1">{isProfitable ? 'Profit' : 'Loss'}</Badge>
                </div>
                <p className={`text-[10px] font-medium ${isProfitable ? 'text-green-100' : 'text-red-100'}`}>Net Profit</p>
                <p className="text-base font-black text-white leading-tight">{formatPriceSigned(netProfit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-md">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <ShoppingCart className="w-4 h-4 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[9px] px-1">{formatNumber(allData?.totalTransactions ?? 0)} orders</Badge>
                </div>
                <p className="text-blue-100 text-[10px] font-medium">Total Revenue</p>
                <p className="text-base font-black text-white leading-tight">{formatPrice(allData?.totalSales ?? 0)}</p>
                {(allData?.creditRevenue ?? 0) > 0 && (
                  <p className="text-[9px] text-blue-100/90 mt-0.5" title={`Revenue for ${dateRange.start}${dateRange.start !== dateRange.end ? ` to ${dateRange.end}` : ''}`}>
                    Paid: {formatPrice(allData?.paidRevenue ?? 0)} · Credit: {formatPrice(allData?.creditRevenue ?? 0)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-md">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <TrendingUp className="w-4 h-4 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[9px] px-1">{formatPercent(grossMargin)} margin</Badge>
                </div>
                <p className="text-emerald-100 text-[10px] font-medium">Gross Profit</p>
                <p className="text-base font-black text-white leading-tight">{formatPrice(grossProfit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-md">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <DollarSign className="w-4 h-4 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[9px] px-1">{formatNumber(allData?.totalQuantitySold ?? 0)} sold</Badge>
                </div>
                <p className="text-purple-100 text-[10px] font-medium">Cost of Goods</p>
                <p className="text-base font-black text-white leading-tight">{formatPrice(allData?.totalCost ?? 0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Latest Sales + P&L Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-1">
              {(() => {
                const { start: startTs, end: endTs } = localDateStringsToTimestamps(dateRange.start, dateRange.end);
                return (
                  <LatestSalesCard startTs={startTs} endTs={endTs} accentColor="teal" compact />
                );
              })()}
            </div>
            <div className="lg:col-span-2">
              <Card className="border border-slate-200 dark:border-slate-700">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-[#1c6a1e]" />
                    P&amp;L Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="space-y-2.5">
                {/* Revenue */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Revenue</span>
                    </div>
                    <span className="font-black text-xs text-slate-900 dark:text-white">{formatPrice(allData?.totalSales ?? 0)}</span>
                  </div>
                  {(allData?.paidRevenue ?? 0) > 0 && (
                    <div className="flex items-center justify-between pl-4 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">Paid (cash/mpesa)</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{formatPrice(allData?.paidRevenue ?? 0)}</span>
                    </div>
                  )}
                  {(allData?.creditRevenue ?? 0) > 0 && (
                    <div className="flex items-center justify-between pl-4 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">Credit</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-500">{formatPrice(allData?.creditRevenue ?? 0)}</span>
                    </div>
                  )}
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-400 to-blue-500" style={{ width: '100%' }} />
                  </div>
                </div>
                {/* Outstanding credit - separate from revenue */}
                {/* Cost of Goods */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-orange-500" />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Cost of Goods</span>
                    </div>
                    <span className="font-black text-xs text-slate-900 dark:text-white">&minus; {formatPrice(allData?.totalCost ?? 0)}</span>
                  </div>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 to-amber-500" style={{ width: `${(allData?.totalSales ?? 0) > 0 ? ((allData?.totalCost ?? 0) / (allData?.totalSales ?? 1)) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Gross Profit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Gross Profit</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-emerald-600">{formatPrice(grossProfit)}</span>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1 py-0.5 rounded">{formatPercent(grossMargin)}</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-green-500" style={{ width: `${(allData?.totalSales ?? 0) > 0 ? (grossProfit / (allData?.totalSales ?? 1)) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Operating Expenses */}
                {hasExpenses && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-red-500" />
                        <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Operating Expenses</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-slate-900 dark:text-white">&minus; {formatPrice(totalExpenses)}</span>
                        <span className="text-[9px] text-slate-400">{expenseData?.expenseCount}&times;{periodDays}d</span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-400 to-rose-500" style={{ width: `${(allData?.totalSales ?? 0) > 0 ? (totalExpenses / (allData?.totalSales ?? 1)) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
                {/* Net Profit */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900 dark:text-white">Net Profit</span>
                    <span className={`text-sm font-black ${isProfitable ? 'text-[#1c6a1e]' : 'text-red-600'}`}>{formatPriceSigned(netProfit)}</span>
                  </div>
                </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Expenses & Banking Row */}
          {hasExpenses ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Card className="border border-slate-200 dark:border-slate-700">
                <CardContent className="p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <Receipt className="w-4 h-4 text-[#1c6a1e]" />
                    <Link href="/admin/expenses" className="text-[9px] text-[#1c6a1e] hover:underline flex items-center gap-0.5">Manage <ChevronRight className="w-2.5 h-2.5" /></Link>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium uppercase">Operating Expenses</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatPrice(totalExpenses)}</p>
                  <p className="text-[10px] text-slate-400">{expenseData?.expenseCount} expense{expenseData?.expenseCount !== 1 ? 's' : ''} &bull; {periodDays}d</p>
                </CardContent>
              </Card>
              <Card className="border border-slate-200 dark:border-slate-700">
                <CardContent className="p-2.5">
                  <Target className="w-4 h-4 text-orange-500 mb-0.5" />
                  <p className="text-[9px] text-slate-400 font-medium uppercase">Break-even Sales</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatPrice(grossMargin > 0 ? totalExpenses / grossMargin : 0)}</p>
                  <p className="text-[10px] text-slate-400">Min. to cover costs</p>
                </CardContent>
              </Card>
              <Card className={`border ${isProfitable ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
                <CardContent className="p-2.5">
                  <Wallet className={`w-4 h-4 mb-0.5 ${isProfitable ? 'text-[#1c6a1e]' : 'text-red-500'}`} />
                  <p className="text-[9px] text-slate-400 font-medium uppercase">Safe to Bank</p>
                  <p className={`text-sm font-black ${isProfitable ? 'text-[#1c6a1e]' : 'text-red-600'}`}>{formatPrice(Math.max(0, netProfit))}</p>
                  <p className="text-[10px] text-slate-400">{isProfitable ? `Keep ${formatPrice(totalExpenses)} for expenses` : 'Costs exceed profit'}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Link href="/admin/expenses" className="block">
              <Card className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#1c6a1e] transition-all group">
                <CardContent className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#1c6a1e]" />
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">Add Operating Expenses</p>
                      <p className="text-[10px] text-slate-500">Track rent, salaries to see true net profit</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1c6a1e] group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Department Cards - compact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {productTypes.map((t) => {
              const data = typeData[t.key];
              const color = t.color ?? '#22c55e';
              const pct = data?.totalSales ? getTypePct(t.key) : 0;
              return (
                <Link key={t.key} href={`/admin/profit/${t.key}`} className="block group">
                  <Card className="border transition-all hover:shadow-md h-full" style={{ borderColor: `${color}40` }}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
                          {t.emoji}
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0" style={{ color: data?.totalSales ? color : undefined }} />
                      </div>
                      <h2 className="text-sm font-black text-slate-900 dark:text-white mb-0.5">{t.label}</h2>
                      {data && data.totalSales > 0 ? (
                        <>
                          <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                            <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase">Sales</p>
                              <p className="text-xs font-black truncate" style={{ color }} title={formatPrice(data.totalSales)}>{formatPrice(data.totalSales)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase">Profit</p>
                              <p className="text-xs font-black text-slate-700 dark:text-slate-300 truncate" title={formatPrice(data.totalProfit)}>{formatPrice(data.totalProfit)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-400 uppercase">Margin</p>
                              <p className="text-xs font-black text-slate-700 dark:text-slate-300">{formatPercent(data.grossMargin ?? data.profitMargin)}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-400">No sales this period</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Top Earners by type - compact grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productTypes.map((t) => {
              const topItems = topItemsByType[t.key] ?? [];
              const color = t.color ?? '#22c55e';
              return (
                <Card key={t.key} className="border border-slate-200 dark:border-slate-700">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                      <span className="text-base" aria-hidden>{t.emoji}</span>
                      Top {t.label} Earners
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    {topItems.length === 0 ? (
                      <p className="text-center text-slate-400 py-3 text-xs">No data</p>
                    ) : (
                      <div className="space-y-1.5">
                        {topItems.slice(0, 3).map((item, i) => {
                          const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                          return (
                            <div key={item.item_id} className="flex items-center gap-2 py-1">
                              <div className="w-5 h-5 flex items-center justify-center rounded text-[9px] font-black shrink-0" style={{ backgroundColor: `${color}20`, color }}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.item_name}</p>
                                <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold &bull; {margin.toFixed(0)}%</p>
                              </div>
                              <p className="text-xs font-black shrink-0" style={{ color }}>+{formatPrice(item.total_profit)}</p>
                            </div>
                          );
                        })}
                        {topItems.length > 3 && (
                          <Link href={`/admin/profit/${t.key}`} className="block text-center text-[10px] font-bold text-[#1c6a1e] hover:underline pt-1">
                            View all &rarr;
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Profit Calendar - compact */}
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#1c6a1e]" />
                Daily Net Profit Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <ProfitCalendar compact />
            </CardContent>
          </Card>

          {/* View toggle: By Item | By Stock Lot */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
            <button
              onClick={() => setBatchView(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${!batchView ? 'bg-[#1c6a1e] text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              <Package className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              By Item
            </button>
            <button
              onClick={() => setBatchView(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${batchView ? 'bg-[#1c6a1e] text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
            >
              <Layers className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              By Stock Lot
            </button>
          </div>

          {/* All Items Table - compact (when batchView=false) */}
          {!batchView && (
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardHeader className="py-2 px-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#1c6a1e]" />
                  All Items
                  <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-[10px]">
                    {filteredItems.length}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search product..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-8 h-7 w-40 text-xs border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => setShowAllItems(!showAllItems)}>
                    {showAllItems ? <EyeOff className="w-3 h-3 mr-0.5" /> : <Eye className="w-3 h-3 mr-0.5" />}
                    {showAllItems ? 'Collapse' : 'Show All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                  <p className="text-slate-500 text-xs">No sales in this period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700">
                        <th className="text-left px-3 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Item</th>
                        <th className="text-center px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Dept</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Qty</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Sales</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Cost</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Profit</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Margin</th>
                        <th className="w-9 px-1 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems
                        .slice(0, showAllItems ? undefined : 10)
                        .map((item) => {
                          const margin = item.total_sales > 0 ? item.total_profit / item.total_sales : 0;
                          const isPositive = item.total_profit >= 0;
                          const deptConfig = productTypes.find((x) => x.key === item.department);
                          const deptLabel = deptConfig?.label ?? item.department;
                          const deptColor = deptConfig?.color ?? '#22c55e';
                          return (
                            <tr key={`${item.department}-${item.item_id}`} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  {isPositive
                                    ? <TrendingUp className="h-3.5 w-3.5 text-[#1c6a1e] flex-shrink-0" />
                                    : <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  }
                                  <span className="font-bold text-[11px] text-slate-900 dark:text-white">{item.item_name}</span>
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <Badge className="text-[9px] border-0" style={{ backgroundColor: `${deptColor}20`, color: deptColor }}>
                                  {deptLabel}
                                </Badge>
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-slate-600 dark:text-slate-300 text-[11px]">{item.quantity_sold.toFixed(0)}</td>
                              <td className="px-2 py-1.5 text-right text-[11px] text-slate-600 dark:text-slate-300">{formatPrice(item.total_sales)}</td>
                              <td className="px-2 py-1.5 text-right text-[11px] text-slate-500">{formatPrice(item.total_cost)}</td>
                              <td className={`px-2 py-1.5 text-right font-black text-[11px] ${isPositive ? 'text-[#1c6a1e]' : 'text-red-500'}`}>{formatPriceSigned(item.total_profit)}</td>
                              <td className="px-2 py-1.5 text-right">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-[#1c6a1e]/10 text-[#1c6a1e]' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                  {formatPercent(margin)}
                                </span>
                              </td>
                              <td className="px-1 py-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-[#1c6a1e]"
                                  onClick={() => openEditPrices(item)}
                                  title="Edit prices"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {!showAllItems && filteredItems.length > 10 && (
                    <div className="p-2 text-center border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setShowAllItems(true)} className="text-[11px] font-bold text-[#1c6a1e] hover:text-[#1a7a69]">
                        Show all {filteredItems.length} items
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* By Stock Lot - batch-level profit tracking */}
          {batchView && (
          <Card className="border border-slate-200 dark:border-slate-700">
            <CardHeader className="py-2 px-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#1c6a1e]" />
                  Profit by Stock Lot
                  <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-[10px]">
                    {batchData.length}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search product..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-8 h-7 w-36 text-xs border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="relative">
                    <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Filter by batch..."
                      value={batchFilter}
                      onChange={(e) => setBatchFilter(e.target.value)}
                      className="pl-8 h-7 w-36 text-xs border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={fetchBatchData} disabled={batchLoading}>
                    {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {batchLoading ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1c6a1e]" />
                  <p className="text-xs text-slate-500">Loading batch data...</p>
                </div>
              ) : batchData.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                  <p className="text-slate-500 text-xs">
                    {itemSearch || batchFilter ? 'No batches match your filters' : 'No batch sales in this period'}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">Sales with batch tracking appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-700">
                        <th className="text-left px-3 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Product</th>
                        <th className="text-left px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px] font-mono">Batch</th>
                        <th className="text-left px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Supplier</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Qty</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Sales</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Cost</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Profit</th>
                        <th className="text-right px-2 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px]">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchData.map((row) => {
                        const displayName = row.variantName ? `${row.parentName || row.itemName} › ${row.variantName}` : row.itemName;
                        const isPositive = row.totalProfit >= 0;
                        const margin = row.totalSales > 0 ? row.totalProfit / row.totalSales : 0;
                        return (
                          <tr key={row.batchId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="px-3 py-1.5">
                              <span className="font-bold text-[11px] text-slate-900 dark:text-white">{displayName}</span>
                            </td>
                            <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">{row.batchNumber}</td>
                            <td className="px-2 py-1.5 text-[11px] text-slate-500">{row.supplierName || '—'}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-slate-600 dark:text-slate-300 text-[11px]">{row.quantitySold.toFixed(0)}</td>
                            <td className="px-2 py-1.5 text-right text-[11px] text-slate-600 dark:text-slate-300">{formatPrice(row.totalSales)}</td>
                            <td className="px-2 py-1.5 text-right text-[11px] text-slate-500">{formatPrice(row.totalCost)}</td>
                            <td className={`px-2 py-1.5 text-right font-black text-[11px] ${isPositive ? 'text-[#1c6a1e]' : 'text-red-500'}`}>{formatPriceSigned(row.totalProfit)}</td>
                            <td className="px-2 py-1.5 text-right">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-[#1c6a1e]/10 text-[#1c6a1e]' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
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
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      <Dialog open={editPriceOpen} onOpenChange={(open) => { if (!open) { setEditPriceOpen(false); setEditingItem(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit prices</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{editingItem.item_name}</p>
              {editLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1c6a1e]" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sell">Sell price (KES)</Label>
                    <Input
                      id="edit-sell"
                      type="number"
                      min={0}
                      step={0.01}
                      value={editSellPrice}
                      onChange={(e) => setEditSellPrice(e.target.value)}
                      placeholder="0"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-buy">Cost price (KES)</Label>
                    <Input
                      id="edit-buy"
                      type="number"
                      min={0}
                      step={0.01}
                      value={editBuyPrice}
                      onChange={(e) => setEditBuyPrice(e.target.value)}
                      placeholder="0"
                      className="h-9"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPriceOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEditPrices} disabled={editLoading || editSaving}>
              {editSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
