'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Package, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Sparkles, Search, CheckCircle2, XCircle, X, SlidersHorizontal,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw,
  Boxes, Scale, DollarSign, ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import { StockItemEditDrawer } from '@/components/admin/StockItemEditDrawer';
import { InlineEditableCell } from '@/components/admin/InlineEditableCell';
import type { Item, Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';
import { isDiscreteUnitType } from '@/lib/constants';

interface StockItem extends Item {
  category_name?: string;
  current_buy_price?: number | null;
  initial_stock: number;
  stock_change: number;
  stock_change_percent: number | null;
  initial_value: number;
  initial_sales_value: number;
  stock_value: number;
  sales_value: number;
  current_value: number;
  value_change: number;
  value_change_percent: number | null;
  trend: 'growing' | 'shrinking' | 'stable' | 'new';
}

type SortField = 'name' | 'stock' | 'value' | 'growth' | 'sales';
type SortDir = 'asc' | 'desc';
type StockStatus = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';

const TREND_CONFIG = {
  growing: {
    label: 'Growing',
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    dotColor: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-green-500',
  },
  shrinking: {
    label: 'Declining',
    icon: TrendingDown,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    dotColor: 'bg-rose-500',
    gradient: 'from-rose-500 to-red-500',
  },
  stable: {
    label: 'Stable',
    icon: Minus,
    color: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    dotColor: 'bg-sky-500',
    gradient: 'from-sky-500 to-blue-500',
  },
  new: {
    label: 'New',
    icon: Sparkles,
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    dotColor: 'bg-violet-500',
    gradient: 'from-violet-500 to-purple-500',
  },
};

const UNIT_LABELS: Record<string, string> = {
  kg: 'Kilograms',
  g: 'Grams',
  piece: 'Pieces',
  bunch: 'Bunches',
  tray: 'Trays',
  litre: 'Litres',
  ml: 'Millilitres',
};

export function StockList() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedTrend, setSelectedTrend] = useState<string>('all');
  const [stockStatus, setStockStatus] = useState<StockStatus>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Edit drawer
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  // Inline edits
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState('');
  const [savingStockId, setSavingStockId] = useState<string | null>(null);

  const [editingCostValueId, setEditingCostValueId] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState('');
  const [savingCostValueId, setSavingCostValueId] = useState<string | null>(null);

  const [editingSalesValueId, setEditingSalesValueId] = useState<string | null>(null);
  const [editingSalesValue, setEditingSalesValue] = useState('');
  const [savingSalesValueId, setSavingSalesValueId] = useState<string | null>(null);

  const fetchData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const [itemsRes, categoriesRes] = await Promise.all([
        fetch('/api/stock'),
        fetch('/api/categories'),
      ]);
      const itemsResult = await itemsRes.json();
      const categoriesResult = await categoriesRes.json();
      if (itemsResult.success) setItems(itemsResult.data);
      else setError(itemsResult.message || 'Failed to load stock');
      if (categoriesResult.success) setCategories(categoriesResult.data);
    } catch {
      setError('Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEditDrawer = useCallback((item: StockItem) => {
    setEditItem(item);
    setEditDrawerOpen(true);
  }, []);

  const itemTypes = useMemo(() => {
    const types = new Set(items.map(i => i.item_type).filter(Boolean));
    return Array.from(types).sort();
  }, [items]);

  const unitTypes = useMemo(() => {
    const units = new Set(items.map(i => i.unit_type).filter(Boolean));
    return Array.from(units).sort();
  }, [items]);

  const isLowStock = useCallback((item: StockItem) => {
    if (!item.min_stock_level) return false;
    return item.current_stock > 0 && item.current_stock <= item.min_stock_level;
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedType !== 'all') count++;
    if (selectedUnit !== 'all') count++;
    if (selectedTrend !== 'all') count++;
    if (stockStatus !== 'all') count++;
    if (searchQuery) count++;
    return count;
  }, [selectedCategory, selectedType, selectedUnit, selectedTrend, stockStatus, searchQuery]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedUnit('all');
    setSelectedTrend('all');
    setStockStatus('all');
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  }, [sortField]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const match = item.name.toLowerCase().includes(q)
            || item.category_name?.toLowerCase().includes(q)
            || item.variant_name?.toLowerCase().includes(q)
            || item.barcode?.includes(q);
          if (!match) return false;
        }
        if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
        if (selectedType !== 'all' && item.item_type !== selectedType) return false;
        if (selectedUnit !== 'all' && item.unit_type !== selectedUnit) return false;
        if (selectedTrend !== 'all' && item.trend !== selectedTrend) return false;
        if (stockStatus === 'out_of_stock' && item.current_stock > 0) return false;
        if (stockStatus === 'in_stock' && item.current_stock <= 0) return false;
        if (stockStatus === 'low_stock' && !isLowStock(item)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortField) {
          case 'stock': return (a.current_stock - b.current_stock) * dir;
          case 'value': return ((a.stock_value || 0) - (b.stock_value || 0)) * dir;
          case 'growth': return ((a.stock_change_percent ?? -999) - (b.stock_change_percent ?? -999)) * dir;
          case 'sales': return ((a.sales_value || 0) - (b.sales_value || 0)) * dir;
          default: return a.name.localeCompare(b.name) * dir;
        }
      });
  }, [items, searchQuery, selectedCategory, selectedType, selectedUnit, selectedTrend, stockStatus, sortField, sortDir, isLowStock]);

  const stats = useMemo(() => {
    const lowStock = items.filter(i => isLowStock(i)).length;
    return {
      total: items.length,
      inStock: items.filter(i => i.current_stock > 0).length,
      outOfStock: items.filter(i => i.current_stock <= 0).length,
      lowStock,
      totalCurrentStock: items.reduce((s, i) => s + i.current_stock, 0),
      totalStockValue: items.reduce((s, i) => s + (i.stock_value || 0), 0),
      totalSalesValue: items.reduce((s, i) => s + (i.sales_value || i.current_value || 0), 0),
      growing: items.filter(i => i.trend === 'growing').length,
      stable: items.filter(i => i.trend === 'stable').length,
      shrinking: items.filter(i => i.trend === 'shrinking').length,
      new: items.filter(i => i.trend === 'new').length,
    };
  }, [items, isLowStock]);

  const formatStock = (stock: number, _unitType: UnitType) => {
    if (stock <= 0) return '0';
    if (stock === Math.floor(stock)) return stock.toLocaleString();
    return stock.toFixed(1);
  };

  const formatCurrency = (amount: number) =>
    `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatChange = (change: number | null) => {
    if (change === null) return '—';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(0)}%`;
  };

  const formatStockQty = (stock: number, unitType: UnitType) =>
    isDiscreteUnitType(unitType) ? Math.round(stock).toString() : stock.toFixed(2);

  const getUnitBuyPrice = (item: StockItem) => {
    if (item.current_buy_price != null && item.current_buy_price > 0) return item.current_buy_price;
    if (item.current_stock > 0 && item.stock_value > 0) return item.stock_value / item.current_stock;
    return 0;
  };

  const startStockEdit = (item: StockItem) => {
    setEditingCostValueId(null);
    setEditingSalesValueId(null);
    setEditingStockId(item.id);
    setEditingStockValue(formatStockQty(item.current_stock, item.unit_type));
  };

  const startCostValueEdit = (item: StockItem) => {
    setEditingStockId(null);
    setEditingSalesValueId(null);
    setEditingCostValueId(item.id);
    setEditingCostValue(String(Math.round(item.stock_value || 0)));
  };

  const startSalesValueEdit = (item: StockItem) => {
    setEditingStockId(null);
    setEditingCostValueId(null);
    setEditingSalesValueId(item.id);
    setEditingSalesValue(String(Math.round(item.sales_value || item.current_value || 0)));
  };

  const saveInlineStock = async (item: StockItem) => {
    const isDiscrete = isDiscreteUnitType(item.unit_type);
    const target = isDiscrete ? parseInt(editingStockValue, 10) : parseFloat(editingStockValue);

    if (!editingStockValue || isNaN(target) || target < 0) {
      toast.error('Enter a valid stock level');
      setEditingStockId(null);
      setEditingStockValue('');
      return;
    }

    const diff = target - item.current_stock;
    if (diff === 0) {
      setEditingStockId(null);
      setEditingStockValue('');
      return;
    }

    setSavingStockId(item.id);
    setEditingStockId(null);
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          adjustmentType: diff > 0 ? 'increase' : 'decrease',
          quantity: Math.abs(diff),
          reason: 'counting_error',
          notes: null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Stock updated');
        fetchData(false);
      } else {
        toast.error(result.message || 'Failed to update stock');
        setEditingStockId(item.id);
        setEditingStockValue(formatStockQty(target, item.unit_type));
      }
    } catch {
      toast.error('Failed to update stock');
      setEditingStockId(item.id);
      setEditingStockValue(formatStockQty(target, item.unit_type));
    } finally {
      setSavingStockId(null);
      if (!editingStockId) setEditingStockValue('');
    }
  };

  const saveInlineCostValue = async (item: StockItem) => {
    const total = parseFloat(editingCostValue);
    if (!editingCostValue || isNaN(total) || total < 0) {
      toast.error('Enter a valid cost value');
      setEditingCostValueId(null);
      setEditingCostValue('');
      return;
    }

    const buyPrice =
      item.current_stock > 0 ? total / item.current_stock : total;
    const currentBuy = getUnitBuyPrice(item);
    if (Math.abs(buyPrice - currentBuy) < 0.01) {
      setEditingCostValueId(null);
      setEditingCostValue('');
      return;
    }

    setSavingCostValueId(item.id);
    setEditingCostValueId(null);
    try {
      const res = await fetch(`/api/items/${item.id}/prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyPrice }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Cost value updated');
        fetchData(false);
      } else {
        toast.error(result.message || 'Failed to update cost');
        setEditingCostValueId(item.id);
      }
    } catch {
      toast.error('Failed to update cost');
      setEditingCostValueId(item.id);
    } finally {
      setSavingCostValueId(null);
      if (!editingCostValueId) setEditingCostValue('');
    }
  };

  const saveInlineSalesValue = async (item: StockItem) => {
    const total = parseFloat(editingSalesValue);
    if (!editingSalesValue || isNaN(total) || total < 0) {
      toast.error('Enter a valid sales value');
      setEditingSalesValueId(null);
      setEditingSalesValue('');
      return;
    }

    const sellPrice =
      item.current_stock > 0 ? total / item.current_stock : total;
    if (Math.abs(sellPrice - item.current_sell_price) < 0.01) {
      setEditingSalesValueId(null);
      setEditingSalesValue('');
      return;
    }

    setSavingSalesValueId(item.id);
    setEditingSalesValueId(null);
    try {
      const res = await fetch(`/api/items/${item.id}/prices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellPrice }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Sales value updated');
        fetchData(false);
      } else {
        toast.error(result.message || 'Failed to update sales value');
        setEditingSalesValueId(item.id);
      }
    } catch {
      toast.error('Failed to update sales value');
      setEditingSalesValueId(item.id);
    } finally {
      setSavingSalesValueId(null);
      if (!editingSalesValueId) setEditingSalesValue('');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#1c6a1e]" />
      : <ArrowDown className="w-3 h-3 text-[#1c6a1e]" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-[#1c6a1e] animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {/* ═══════════════ SUMMARY CARDS ═══════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {/* Total Items */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center">
              <Boxes className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#1c6a1e]" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stats.total.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] md:text-xs text-emerald-600 font-medium">{stats.inStock} in stock</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-[10px] md:text-xs text-slate-400">{stats.outOfStock} out</span>
          </div>
        </div>
        {/* Stock Quantity */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Scale className="w-3.5 h-3.5 md:w-4 md:h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Qty</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stats.totalCurrentStock.toLocaleString('en-KE', { maximumFractionDigits: 0 })}</p>
          {stats.lowStock > 0 && (
            <p className="text-[10px] md:text-xs text-amber-500 font-medium mt-1">{stats.lowStock} low stock</p>
          )}
        </div>
        {/* Stock Value */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost Value</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(stats.totalStockValue)}</p>
        </div>
        {/* Sales Value */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#1c6a1e]" />
            </div>
            <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sales Value</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(stats.totalSalesValue)}</p>
          {stats.totalStockValue > 0 && (
            <p className="text-[10px] md:text-xs text-emerald-600 font-medium mt-1">
              {((stats.totalSalesValue - stats.totalStockValue) / stats.totalStockValue * 100).toFixed(0)}% margin
            </p>
          )}
        </div>
      </div>

      {/* ═══════════════ SEARCH + FILTER BAR ═══════════════ */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        {/* Search row */}
        <div className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name, category, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9 md:h-10 text-sm bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-900"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={`md:hidden flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-semibold transition-all ${
              activeFilterCount > 0
                ? 'border-[#1c6a1e] bg-[#1c6a1e]/5 text-[#1c6a1e]'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-[#1c6a1e] text-white text-[10px] flex items-center justify-center font-bold">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-2 px-4 pb-4 flex-wrap">
          {/* Stock Status pills */}
          <div className="flex items-center gap-1 mr-1">
            {([
              { key: 'all', label: 'All', count: stats.total, icon: Package },
              { key: 'in_stock', label: 'In Stock', count: stats.inStock, icon: CheckCircle2 },
              { key: 'out_of_stock', label: 'Out', count: stats.outOfStock, icon: XCircle },
              { key: 'low_stock', label: 'Low', count: stats.lowStock, icon: AlertTriangle },
            ] as const).map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setStockStatus(stockStatus === key ? 'all' : key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  stockStatus === key
                    ? 'bg-[#1c6a1e] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={`tabular-nums font-semibold ${stockStatus === key ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Category */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 text-xs min-w-[120px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.filter(c => c.active).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Item Type */}
          {itemTypes.length > 1 && (
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-8 text-xs min-w-[100px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {itemTypes.map(t => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Unit Type */}
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="h-8 text-xs min-w-[110px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {unitTypes.map(u => (
                <SelectItem key={u} value={u}>{UNIT_LABELS[u] || u}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Trend */}
          <Select value={selectedTrend} onValueChange={setSelectedTrend}>
            <SelectTrigger className="h-8 text-xs min-w-[100px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <SelectValue placeholder="Trend" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trends</SelectItem>
              {(Object.entries(TREND_CONFIG) as [keyof typeof TREND_CONFIG, typeof TREND_CONFIG[keyof typeof TREND_CONFIG]][]).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                    {cfg.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <div className="ml-auto flex items-center gap-1.5">
            <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => {
              const [f, d] = v.split('-') as [SortField, SortDir];
              setSortField(f); setSortDir(d);
            }}>
              <SelectTrigger className="h-8 text-xs min-w-[130px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <ArrowUpDown className="w-3 h-3 mr-1 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Name A–Z</SelectItem>
                <SelectItem value="name-desc">Name Z–A</SelectItem>
                <SelectItem value="stock-asc">Stock: Low → High</SelectItem>
                <SelectItem value="stock-desc">Stock: High → Low</SelectItem>
                <SelectItem value="value-desc">Value: High → Low</SelectItem>
                <SelectItem value="value-asc">Value: Low → High</SelectItem>
                <SelectItem value="sales-desc">Sales: High → Low</SelectItem>
                <SelectItem value="growth-desc">Growth: High → Low</SelectItem>
                <SelectItem value="growth-asc">Growth: Low → High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-red-500 transition-colors">
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Mobile filters panel */}
        {mobileFiltersOpen && (
          <div className="md:hidden border-t border-slate-100 dark:border-slate-700/50 p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
            {/* Stock status row */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {([
                { key: 'all', label: 'All', count: stats.total },
                { key: 'in_stock', label: 'In Stock', count: stats.inStock },
                { key: 'out_of_stock', label: 'Out', count: stats.outOfStock },
                { key: 'low_stock', label: 'Low', count: stats.lowStock },
              ] as const).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setStockStatus(key)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    stockStatus === key
                      ? 'bg-[#1c6a1e] text-white'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label} <span className="tabular-nums opacity-70">{count}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-700 rounded-lg">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.filter(c => c.active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {itemTypes.length > 1 ? (
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-700 rounded-lg">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {itemTypes.map(t => (
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-700 rounded-lg">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    {unitTypes.map(u => (
                      <SelectItem key={u} value={u}>{UNIT_LABELS[u] || u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {itemTypes.length > 1 && (
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-700 rounded-lg">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    {unitTypes.map(u => (
                      <SelectItem key={u} value={u}>{UNIT_LABELS[u] || u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={selectedTrend} onValueChange={setSelectedTrend}>
                <SelectTrigger className="h-9 text-xs border-slate-200 dark:border-slate-700 rounded-lg">
                  <SelectValue placeholder="Trend" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trends</SelectItem>
                  {(Object.entries(TREND_CONFIG) as [keyof typeof TREND_CONFIG, typeof TREND_CONFIG[keyof typeof TREND_CONFIG]][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort + Clear */}
            <div className="flex items-center gap-2">
              <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => {
                const [f, d] = v.split('-') as [SortField, SortDir];
                setSortField(f); setSortDir(d);
              }}>
                <SelectTrigger className="h-9 text-xs flex-1 border-slate-200 dark:border-slate-700 rounded-lg">
                  <ArrowUpDown className="w-3 h-3 mr-1 text-slate-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A–Z</SelectItem>
                  <SelectItem value="name-desc">Name Z–A</SelectItem>
                  <SelectItem value="stock-asc">Stock: Low → High</SelectItem>
                  <SelectItem value="stock-desc">Stock: High → Low</SelectItem>
                  <SelectItem value="value-desc">Value: High → Low</SelectItem>
                  <SelectItem value="sales-desc">Sales: High → Low</SelectItem>
                  <SelectItem value="growth-desc">Growth: Best</SelectItem>
                  <SelectItem value="growth-asc">Growth: Worst</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 hover:text-red-500 hover:border-red-200 transition-all flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results bar */}
        {(activeFilterCount > 0 || searchQuery) && (
          <div className="px-3 md:px-4 pb-3 md:pb-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="w-3 h-3" />
              <span>
                Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredItems.length}</span> of {items.length} items
              </span>
              {activeFilterCount > 0 && (
                <span className="text-slate-300 dark:text-slate-600">·</span>
              )}
              {activeFilterCount > 0 && (
                <span>{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ ITEMS LIST ═══════════════ */}
      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center h-48 md:h-56">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
              <Package className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No items found</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-[#1c6a1e] font-medium mt-1 hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ═══ Mobile Cards ═══ */}
          <div className="md:hidden space-y-2">
            {filteredItems.map((item) => {
              const low = isLowStock(item);
              const outOfStock = item.current_stock <= 0;
              const trendConfig = TREND_CONFIG[item.trend];
              const TrendIcon = trendConfig.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => openEditDrawer(item)}
                  className={`bg-white dark:bg-slate-800/80 rounded-xl p-3.5 border transition-all cursor-pointer active:scale-[0.99] ${
                    outOfStock
                      ? 'border-slate-200/80 dark:border-slate-700/30 opacity-60'
                      : low
                      ? 'border-amber-200 dark:border-amber-800/40'
                      : 'border-slate-200/80 dark:border-slate-700/30 hover:border-[#1c6a1e]/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {item.name}
                          {item.variant_name && (
                            <span className="font-normal text-slate-400 dark:text-slate-500"> · {item.variant_name}</span>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.category_name || 'Uncategorized'}</span>
                        {item.item_type && item.item_type !== 'retail' && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium capitalize">{item.item_type}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <InlineEditableCell
                        displayValue={`${formatStock(item.current_stock, item.unit_type)} ${item.unit_type}`}
                        isEditing={editingStockId === item.id}
                        value={editingStockValue}
                        isSaving={savingStockId === item.id}
                        unitType={item.unit_type}
                        onStartEdit={() => startStockEdit(item)}
                        onChange={setEditingStockValue}
                        onSave={() => void saveInlineStock(item)}
                        onCancel={() => { setEditingStockId(null); setEditingStockValue(''); }}
                        className={`text-lg font-bold ${
                          outOfStock ? 'text-slate-300 dark:text-slate-600' : low ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                        }`}
                      />
                      {outOfStock ? (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Out of stock</span>
                      ) : low ? (
                        <span className="text-[10px] font-bold text-amber-500 uppercase">Low stock</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[11px]" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <span className="text-slate-400">Cost </span>
                        <InlineEditableCell
                          displayValue={formatCurrency(item.stock_value || 0)}
                          isEditing={editingCostValueId === item.id}
                          value={editingCostValue}
                          isSaving={savingCostValueId === item.id}
                          valueKind="price"
                          align="left"
                          inline
                          onStartEdit={() => startCostValueEdit(item)}
                          onChange={setEditingCostValue}
                          onSave={() => void saveInlineCostValue(item)}
                          onCancel={() => { setEditingCostValueId(null); setEditingCostValue(''); }}
                          className="inline font-semibold text-slate-600 dark:text-slate-300"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400">Sale </span>
                        <InlineEditableCell
                          displayValue={formatCurrency(item.sales_value || item.current_value || 0)}
                          isEditing={editingSalesValueId === item.id}
                          value={editingSalesValue}
                          isSaving={savingSalesValueId === item.id}
                          valueKind="price"
                          align="left"
                          inline
                          onStartEdit={() => startSalesValueEdit(item)}
                          onChange={setEditingSalesValue}
                          onSave={() => void saveInlineSalesValue(item)}
                          onCancel={() => { setEditingSalesValueId(null); setEditingSalesValue(''); }}
                          className="inline font-semibold text-[#1c6a1e] dark:text-emerald-400"
                        />
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${trendConfig.bg}`}>
                      <TrendIcon className={`w-3 h-3 ${trendConfig.color}`} />
                      <span className={`text-[10px] font-semibold ${trendConfig.color}`}>
                        {item.stock_change_percent !== null ? formatChange(item.stock_change_percent) : trendConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ Desktop Table ═══ */}
          <Card className="hidden md:block bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/50">
                      <th className="text-left py-3 px-4">
                        <button onClick={() => handleSort('name')} className="group flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                          Item <SortIcon field="name" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="text-right py-3 px-4">
                        <button onClick={() => handleSort('stock')} className="group flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                          Stock <SortIcon field="stock" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-4">
                        <button onClick={() => handleSort('value')} className="group flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                          Cost Value <SortIcon field="value" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-4">
                        <button onClick={() => handleSort('sales')} className="group flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                          Sales Value <SortIcon field="sales" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-4">
                        <button onClick={() => handleSort('growth')} className="group flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto">
                          Growth <SortIcon field="growth" />
                        </button>
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {filteredItems.map((item) => {
                      const low = isLowStock(item);
                      const outOfStock = item.current_stock <= 0;
                      const trendConfig = TREND_CONFIG[item.trend];
                      const TrendIcon = trendConfig.icon;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => openEditDrawer(item)}
                          className={`group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                            outOfStock ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                outOfStock ? 'bg-slate-100 dark:bg-slate-800'
                                : low ? 'bg-amber-50 dark:bg-amber-900/20'
                                : trendConfig.bg
                              }`}>
                                {outOfStock ? (
                                  <XCircle className="w-4 h-4 text-slate-400" />
                                ) : low ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <TrendIcon className={`w-4 h-4 ${trendConfig.color}`} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 dark:text-white text-sm truncate block">
                                  {item.name}
                                </span>
                                {item.variant_name && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500">{item.variant_name}</span>
                                )}
                              </div>
                              {low && !outOfStock && (
                                <span className="flex-shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600">Low</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">{item.category_name || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs capitalize text-slate-500 dark:text-slate-400">{item.item_type || '—'}</span>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <InlineEditableCell
                              displayValue={`${formatStock(item.current_stock, item.unit_type)} ${item.unit_type}`}
                              isEditing={editingStockId === item.id}
                              value={editingStockValue}
                              isSaving={savingStockId === item.id}
                              unitType={item.unit_type}
                              onStartEdit={() => startStockEdit(item)}
                              onChange={setEditingStockValue}
                              onSave={() => void saveInlineStock(item)}
                              onCancel={() => { setEditingStockId(null); setEditingStockValue(''); }}
                              className={`font-bold text-sm ${
                                outOfStock ? 'text-slate-300 dark:text-slate-600' : low ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                              }`}
                            />
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <InlineEditableCell
                              displayValue={formatCurrency(item.stock_value || 0)}
                              isEditing={editingCostValueId === item.id}
                              value={editingCostValue}
                              isSaving={savingCostValueId === item.id}
                              valueKind="price"
                              onStartEdit={() => startCostValueEdit(item)}
                              onChange={setEditingCostValue}
                              onSave={() => void saveInlineCostValue(item)}
                              onCancel={() => { setEditingCostValueId(null); setEditingCostValue(''); }}
                              className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                            />
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <InlineEditableCell
                              displayValue={formatCurrency(item.sales_value || item.current_value || 0)}
                              isEditing={editingSalesValueId === item.id}
                              value={editingSalesValue}
                              isSaving={savingSalesValueId === item.id}
                              valueKind="price"
                              onStartEdit={() => startSalesValueEdit(item)}
                              onChange={setEditingSalesValue}
                              onSave={() => void saveInlineSalesValue(item)}
                              onCancel={() => { setEditingSalesValueId(null); setEditingSalesValue(''); }}
                              className="text-xs font-semibold text-[#1c6a1e] dark:text-emerald-400"
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`text-xs font-bold tabular-nums ${
                              item.stock_change_percent === null ? 'text-slate-300 dark:text-slate-600'
                                : item.stock_change_percent >= 0 ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-500'
                            }`}>
                              {formatChange(item.stock_change_percent)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${trendConfig.bg} ${trendConfig.color}`}>
                              <TrendIcon className="w-3 h-3" />
                              {trendConfig.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Drawer */}
      <StockItemEditDrawer
        item={editItem}
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        categories={categories}
        itemTypes={itemTypes}
        onSaved={() => fetchData(false)}
      />
    </div>
  );
}
