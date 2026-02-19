'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Package,
  Download,
  Search,
  Leaf,
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  Eye,
  EyeOff,
  CheckCircle2,
  Hash,
  Percent,
  Users,
} from 'lucide-react';
import { ProfitCalendar } from '@/components/admin/ProfitCalendar';
import { LatestSalesCard } from '@/components/admin/LatestSalesCard';
import { apiPut, apiGet } from '@/lib/utils/api-client';
import { toast } from 'sonner';
import { Edit2, Check, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface ProfitData {
  totalProfit: number;
  totalSales: number;
  totalCost: number;
  grossMargin?: number;
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
    has_buy_price?: number;
  }>;
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

// ─── Helpers ─────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

// ─── Page ────────────────────────────────────────────────────────

export default function GroceryProfitPage() {
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    return { start: today, end: today };
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => { updateDateRange(datePreset); }, [datePreset]);
  useEffect(() => { fetchProfitData(); }, [dateRange]);

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

  async function fetchProfitData() {
    try {
      setLoading(true); setError(null);
      const [sY, sM, sD] = dateRange.start.split('-').map(Number);
      const [eY, eM, eD] = dateRange.end.split('-').map(Number);
      const startTs = Math.floor(new Date(sY, sM - 1, sD, 0, 0, 0).getTime() / 1000);
      const endTs = Math.floor(new Date(eY, eM - 1, eD, 23, 59, 59).getTime() / 1000);
      const res = await fetch(`/api/profit?start=${startTs}&end=${endTs}&itemType=grocery`);
      const result = await res.json();
      if (result.success) setProfitData(result.data);
      else setError(result.message || 'Failed to load');
    } catch { setError('Failed to load profit data'); }
    finally { setLoading(false); }
  }

  const handleStartEdit = (itemId: string, price: number) => { setEditingItemId(itemId); setEditBuyPrice(price.toString()); };
  const handleCancelEdit = () => { setEditingItemId(null); setEditBuyPrice(''); };
  const handleSaveBuyPrice = async (itemId: string) => {
    const price = parseFloat(editBuyPrice);
    if (isNaN(price) || price < 0) { toast.error('Please enter a valid price'); return; }
    setUpdatingPrice(itemId);
    try {
      const itemResult = await apiGet<{ id: string; name: string; category_id: string; unit_type: string; current_sell_price: number; parent_item_id: string | null; }>(`/api/items/${itemId}`);
      if (!itemResult.success || !itemResult.data) { toast.error('Failed to fetch item details'); return; }
      const item = itemResult.data;
      const result = await apiPut(`/api/items/${itemId}`, { name: item.name, categoryId: item.category_id, unitType: item.unit_type, sellPrice: item.current_sell_price, buyPrice: price });
      if (result.success) { setEditingItemId(null); setEditBuyPrice(''); await fetchProfitData(); toast.success('Buy price updated'); }
      else toast.error(result.message || 'Failed to update');
    } catch { toast.error('Failed to update buy price'); }
    finally { setUpdatingPrice(null); }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto" />
            <p className="text-slate-500 text-sm">Loading grocery profit...</p>
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
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-red-600 font-medium text-sm">{error}</p>
            <Button onClick={fetchProfitData} variant="outline" size="sm">Try Again</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!profitData) return null;

  const topItems = [...profitData.itemProfits].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5);
  const lossItems = profitData.itemProfits.filter(i => i.total_profit < 0 || (i.total_sales > 0 && (i.total_profit / i.total_sales) < 0.05)).sort((a, b) => a.total_profit - b.total_profit).slice(0, 5);
  const missingBuyPrice = profitData.itemProfits.filter(i => i.has_buy_price !== undefined ? i.has_buy_price === 0 : (i.quantity_sold > 0 && i.total_cost === 0));
  const maxItemProfit = topItems.length > 0 ? topItems[0].total_profit : 1;
  const avgProfitPerItem = profitData.totalQuantitySold > 0 ? profitData.totalProfit / profitData.totalQuantitySold : 0;

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-green-100 dark:border-green-900/50">
          <div className="px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/admin/profit" className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </Link>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Leaf className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">Grocery Items</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Item margins, performance, and pricing</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto pb-24 md:pb-6">
          {/* ─── Date Filter ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 pb-4 border-b-2 border-green-100 dark:border-green-900/30">
            <div className="flex items-center gap-1 p-1 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg">
              {(['today', 'week', 'month', 'custom'] as DatePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg ${
                    datePreset === preset
                      ? 'bg-green-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-green-700'
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
          </div>

          {/* ─── Department Stats ──────────────────────────────────── */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <div className="border-2 border-green-600 bg-green-600 p-3 text-center rounded-lg">
              <ShoppingCart className="w-4 h-4 text-white/70 mx-auto mb-1" />
              <p className="text-lg font-black text-white">{formatPrice(profitData.totalSales)}</p>
              <p className="text-[9px] text-white/70 uppercase font-bold">Total Sales</p>
            </div>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center rounded-lg">
              <Hash className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-900 dark:text-white">{profitData.totalQuantitySold.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold">Items Sold</p>
            </div>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center rounded-lg">
              <Package className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-900 dark:text-white">{profitData.uniqueItemsSold}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold">Unique Items</p>
            </div>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center rounded-lg">
              <Percent className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatPercent(profitData.grossMargin ?? profitData.profitMargin)}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold">Avg Margin</p>
            </div>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(avgProfitPerItem)}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold">Profit/Item</p>
            </div>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center rounded-lg">
              <Users className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-900 dark:text-white">{profitData.totalTransactions}</p>
              <p className="text-[9px] text-slate-500 uppercase font-bold">Transactions</p>
            </div>
          </div>

          {/* ─── Latest Sales & Top Earners & Needs Attention ───────── */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Latest Sales */}
            {(() => {
              const [sY, sM, sD] = dateRange.start.split('-').map(Number);
              const [eY, eM, eD] = dateRange.end.split('-').map(Number);
              const startTs = Math.floor(new Date(sY, sM - 1, sD, 0, 0, 0).getTime() / 1000);
              const endTs = Math.floor(new Date(eY, eM - 1, eD, 23, 59, 59).getTime() / 1000);
              return (
                <LatestSalesCard startTs={startTs} endTs={endTs} itemType="grocery" accentColor="green" />
              );
            })()}
            {/* Top Earners */}
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg">
              <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Top Earners</h3>
                  <Badge variant="outline" className="text-[10px] border-green-300 text-green-600">{topItems.length}</Badge>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {topItems.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-sm">No items yet</p>
                ) : topItems.map((item, i) => {
                  const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                  const barWidth = maxItemProfit > 0 ? (item.total_profit / maxItemProfit) * 100 : 0;
                  return (
                    <div key={item.item_id} className="p-2.5 border-2 border-green-100 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 rounded-lg">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 flex items-center justify-center border-2 border-green-600 bg-green-600 rounded">
                          <span className="text-xs font-black text-white">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.item_name}</p>
                          <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold &bull; {margin.toFixed(0)}% margin</p>
                        </div>
                        <p className="text-xs font-black text-green-600">+{formatPrice(item.total_profit)}</p>
                      </div>
                      <div className="h-1.5 bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Needs Attention */}
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg">
              <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Needs Attention</h3>
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">{lossItems.length}</Badge>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Low margin or loss-making items</p>
              </div>
              <div className="p-3 space-y-2">
                {lossItems.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <p className="text-green-600 text-sm font-bold">All items profitable!</p>
                  </div>
                ) : lossItems.map((item, i) => {
                  const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                  const isNeg = item.total_profit < 0;
                  return (
                    <div key={item.item_id} className={`flex items-center gap-2 p-2.5 border-2 rounded-lg ${isNeg ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'}`}>
                      <div className={`w-6 h-6 flex items-center justify-center rounded border-2 ${isNeg ? 'border-red-500 bg-red-500' : 'border-amber-500 bg-amber-500'}`}>
                        <span className="text-xs font-black text-white">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.item_name}</p>
                        <p className="text-[10px] text-slate-500">{item.quantity_sold.toFixed(0)} sold &bull; {margin.toFixed(0)}% margin</p>
                      </div>
                      <p className={`text-xs font-black ${isNeg ? 'text-red-600' : 'text-amber-600'}`}>
                        {isNeg ? '-' : ''}{formatPrice(Math.abs(item.total_profit))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── Missing Buy Prices ─────────────────────────────────── */}
          {missingBuyPrice.length > 0 && (
            <div className="border-2 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <h3 className="font-black text-sm text-yellow-700 dark:text-yellow-400">Missing Buy Prices ({missingBuyPrice.length})</h3>
              </div>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-500 mb-3">
                These items don&apos;t have buy prices set, so their profit is shown as 0. Set buy prices in the table below.
              </p>
              <div className="flex flex-wrap gap-2">
                {missingBuyPrice.slice(0, 10).map(item => (
                  <span key={item.item_id} className="px-2 py-1 text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded border border-yellow-300 dark:border-yellow-700">
                    {item.item_name}
                  </span>
                ))}
                {missingBuyPrice.length > 10 && (
                  <span className="px-2 py-1 text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded border border-yellow-300 dark:border-yellow-700">
                    +{missingBuyPrice.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ─── Profit Calendar ────────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Grocery Profit Calendar
            </h2>
            <ProfitCalendar itemType="grocery" />
          </div>

          {/* ─── All Items Table ────────────────────────────────────── */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg">
            <div className="p-4 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-green-600" />
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">All Grocery Items</h3>
                  <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-xs">
                    {profitData.itemProfits.filter(i => i.item_name.toLowerCase().includes(itemSearch.toLowerCase())).length} items
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input type="text" placeholder="Search..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700" />
                  </div>
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setShowAllItems(!showAllItems)}>
                    {showAllItems ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                    {showAllItems ? 'Collapse' : 'Show All'}
                  </Button>
                </div>
              </div>
            </div>
            {profitData.itemProfits.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">No grocery sales in this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-50 dark:bg-green-900/10 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs">Item</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs">Qty</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs" title="Buy price per unit">Buy/unit</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs" title="Cost for quantity sold (qty × buy price)">Cost</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs">Sell Price</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs">Profit/Unit</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs">Total Profit</th>
                      <th className="text-right px-4 py-3 font-black text-slate-700 dark:text-slate-300 text-xs">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitData.itemProfits
                      .filter(i => i.item_name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .sort((a, b) => b.total_profit - a.total_profit)
                      .slice(0, showAllItems ? undefined : 15)
                      .map((item) => {
                        const margin = item.total_sales > 0 ? item.total_profit / item.total_sales : 0;
                        const isPositive = item.total_profit >= 0;
                        const avgBuy = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                        const avgSell = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                        const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
                        const hasBuyPrice = item.has_buy_price !== undefined ? item.has_buy_price === 1 : avgBuy > 0;
                        return (
                          <tr key={item.item_id} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 ${!hasBuyPrice ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isPositive ? <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                                <span className="font-bold text-slate-900 dark:text-white text-xs">{item.item_name}</span>
                                {!hasBuyPrice && <Badge variant="outline" className="text-[9px] border-yellow-400 text-yellow-700">No Buy Price</Badge>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-300 text-xs">{item.quantity_sold.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500">
                              {editingItemId === item.item_id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input type="number" value={editBuyPrice} onChange={(e) => setEditBuyPrice(e.target.value)} className="w-20 h-7 text-xs text-right" step="0.01" min="0" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBuyPrice(item.item_id); else if (e.key === 'Escape') handleCancelEdit(); }} />
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveBuyPrice(item.item_id)} disabled={updatingPrice === item.item_id}>
                                    {updatingPrice === item.item_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCancelEdit}><X className="h-3 w-3 text-red-600" /></Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5 group">
                                  <span>{formatPrice(avgBuy)}</span>
                                  <button onClick={() => handleStartEdit(item.item_id, avgBuy)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title="Edit buy price">
                                    <Edit2 className="h-3 w-3 text-slate-400 hover:text-green-600" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500" title="qty × buy price">{formatPrice(item.total_cost)}</td>
                            <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">{formatPrice(avgSell)}</td>
                            <td className={`px-4 py-3 text-right font-bold text-xs ${isPositive ? 'text-green-600' : 'text-red-500'}`}>{formatPrice(avgProfit)}</td>
                            <td className={`px-4 py-3 text-right font-black text-xs ${isPositive ? 'text-green-600' : 'text-red-500'}`}>{formatPrice(item.total_profit)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                {formatPercent(margin)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {!showAllItems && profitData.itemProfits.filter(i => i.item_name.toLowerCase().includes(itemSearch.toLowerCase())).length > 15 && (
                  <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setShowAllItems(true)} className="text-xs font-bold text-green-600 hover:text-green-700">
                      Show all {profitData.itemProfits.filter(i => i.item_name.toLowerCase().includes(itemSearch.toLowerCase())).length} items
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
