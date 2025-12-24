'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Package, AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles, Search, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';

interface StockItem extends Item {
  category_name?: string;
  initial_stock: number;
  stock_change: number;
  stock_change_percent: number | null;
  initial_value: number;
  stock_value: number;
  sales_value: number;
  current_value: number; // Backward compatibility
  value_change: number;
  value_change_percent: number | null;
  trend: 'growing' | 'shrinking' | 'stable' | 'new';
}

const TREND_CONFIG = {
  growing: { 
    label: 'Growing', 
    shortLabel: '↑',
    icon: TrendingUp, 
    color: 'text-[#259783]', 
    bg: 'bg-[#259783]/10 dark:bg-[#259783]/20',
    ring: 'ring-[#259783]/20',
    gradient: 'from-[#259783] to-[#45d827]',
  },
  shrinking: { 
    label: 'Shrinking', 
    shortLabel: '↓',
    icon: TrendingDown, 
    color: 'text-rose-600', 
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    ring: 'ring-rose-500/20',
    gradient: 'from-rose-500 to-red-500',
  },
  stable: { 
    label: 'Stable', 
    shortLabel: '—',
    icon: Minus, 
    color: 'text-[#259783]', 
    bg: 'bg-[#259783]/10',
    ring: 'ring-[#259783]/20',
    gradient: 'from-[#259783] to-[#45d827]',
  },
  new: { 
    label: 'New', 
    shortLabel: '✦',
    icon: Sparkles, 
    color: 'text-violet-600', 
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    ring: 'ring-violet-500/20',
    gradient: 'from-violet-500 to-purple-500',
  },
};

export function StockList() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTrend, setSelectedTrend] = useState<string>('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'growth'>('growth');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [itemsRes, categoriesRes] = await Promise.all([
          fetch('/api/stock'),
          fetch('/api/categories'),
        ]);

        const itemsResult = await itemsRes.json();
        const categoriesResult = await categoriesRes.json();

        if (itemsResult.success) {
          setItems(itemsResult.data);
        } else {
          setError(itemsResult.message || 'Failed to load stock');
        }

        if (categoriesResult.success) {
          setCategories(categoriesResult.data);
        }
      } catch (err) {
        setError('Failed to load stock');
        console.error('Error fetching stock:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatStock = (stock: number, unitType: UnitType) => {
    if (stock <= 0) return '0';
    return stock.toFixed(1);
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatChange = (change: number | null) => {
    if (change === null) return '—';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(0)}%`;
  };

  const isLowStock = (item: StockItem) => {
    if (!item.min_stock_level) return false;
    return item.current_stock <= item.min_stock_level;
  };

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!item.name.toLowerCase().includes(query) && !item.category_name?.toLowerCase().includes(query)) {
            return false;
          }
        }
        if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
        if (selectedTrend !== 'all' && item.trend !== selectedTrend) return false;
        if (stockStatus === 'out_of_stock' && item.current_stock > 0) return false;
        if (stockStatus === 'in_stock' && item.current_stock <= 0) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'stock') return a.current_stock - b.current_stock;
        if (sortBy === 'growth') return (b.stock_change_percent ?? -999) - (a.stock_change_percent ?? -999);
        return a.name.localeCompare(b.name);
      });
  }, [items, searchQuery, selectedCategory, selectedTrend, stockStatus, sortBy]);

  const stats = useMemo(() => ({
    growing: items.filter(i => i.trend === 'growing').length,
    stable: items.filter(i => i.trend === 'stable').length,
    shrinking: items.filter(i => i.trend === 'shrinking').length,
    new: items.filter(i => i.trend === 'new').length,
    inStock: items.filter(i => i.current_stock > 0).length,
    outOfStock: items.filter(i => i.current_stock <= 0).length,
    total: items.length,
    totalInitialValue: items.reduce((sum, i) => sum + i.initial_value, 0),
    totalStockValue: items.reduce((sum, i) => sum + (i.stock_value || 0), 0),
    totalSalesValue: items.reduce((sum, i) => sum + (i.sales_value || i.current_value || 0), 0),
  }), [items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-[#259783] animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Loading stock...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="text-2xl mb-2 block">⚠️</span>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile: Value Summary Cards */}
      <div className="md:hidden grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 shadow-lg shadow-blue-500/25">
          <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide mb-1">Stock Value</p>
          <p className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(stats.totalStockValue)}
          </p>
          <p className="text-[9px] text-white/60 mt-0.5">Cost Basis</p>
        </div>
        <div className="bg-gradient-to-br from-[#259783] to-[#45d827] rounded-2xl p-4 shadow-lg shadow-[#259783]/25">
          <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide mb-1">Sales Value</p>
          <p className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(stats.totalSalesValue)}
          </p>
          <p className="text-[9px] text-white/60 mt-0.5">Potential Revenue</p>
        </div>
      </div>

      {/* Mobile: Summary Stats Cards */}
      <div className="md:hidden grid grid-cols-4 gap-2">
        <button
          onClick={() => setStockStatus('all')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
            stockStatus === 'all'
              ? 'bg-gradient-to-br from-[#259783] to-[#45d827] shadow-lg shadow-[#259783]/25'
              : 'bg-white dark:bg-slate-800/80'
          }`}
        >
          <span className={`text-lg font-bold ${stockStatus === 'all' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
            {stats.total}
          </span>
          <span className={`text-[10px] font-medium ${stockStatus === 'all' ? 'text-white/80' : 'text-slate-500'}`}>
            Total
          </span>
        </button>
        <button
          onClick={() => setStockStatus('in_stock')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
            stockStatus === 'in_stock'
              ? 'bg-gradient-to-br from-[#259783] to-[#45d827] shadow-lg shadow-[#259783]/25'
              : 'bg-white dark:bg-slate-800/80'
          }`}
        >
          <span className={`text-lg font-bold ${stockStatus === 'in_stock' ? 'text-white' : 'text-[#259783]'}`}>
            {stats.inStock}
          </span>
          <span className={`text-[10px] font-medium ${stockStatus === 'in_stock' ? 'text-white/80' : 'text-slate-500'}`}>
            In Stock
          </span>
        </button>
        <button
          onClick={() => setStockStatus('out_of_stock')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
            stockStatus === 'out_of_stock'
              ? 'bg-gradient-to-br from-slate-600 to-slate-800 shadow-lg'
              : 'bg-white dark:bg-slate-800/80'
          }`}
        >
          <span className={`text-lg font-bold ${stockStatus === 'out_of_stock' ? 'text-white' : 'text-slate-400'}`}>
            {stats.outOfStock}
          </span>
          <span className={`text-[10px] font-medium ${stockStatus === 'out_of_stock' ? 'text-white/80' : 'text-slate-500'}`}>
            Out
          </span>
        </button>
        <button
          onClick={() => setSelectedTrend(selectedTrend === 'shrinking' ? 'all' : 'shrinking')}
          className={`flex flex-col items-center p-3 rounded-2xl transition-all ${
            selectedTrend === 'shrinking'
              ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/25'
              : 'bg-white dark:bg-slate-800/80'
          }`}
        >
          <span className={`text-lg font-bold ${selectedTrend === 'shrinking' ? 'text-white' : 'text-rose-500'}`}>
            {stats.shrinking}
          </span>
          <span className={`text-[10px] font-medium ${selectedTrend === 'shrinking' ? 'text-white/80' : 'text-slate-500'}`}>
            Low
          </span>
        </button>
      </div>


      {/* Desktop: Value Summary Cards */}
      <div className="hidden md:grid grid-cols-2 gap-4 mb-4">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 shadow-lg shadow-blue-500/25">
          <CardContent className="p-6">
            <p className="text-xs font-medium text-white/80 uppercase tracking-wide mb-2">Total Stock Value</p>
            <p className="text-3xl font-bold text-white tabular-nums">
              {formatCurrency(stats.totalStockValue)}
            </p>
            <p className="text-xs text-white/60 mt-1">Cost Basis (Current Buy Price)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#259783] to-[#45d827] border-0 shadow-lg shadow-[#259783]/25">
          <CardContent className="p-6">
            <p className="text-xs font-medium text-white/80 uppercase tracking-wide mb-2">Total Sales Value</p>
            <p className="text-3xl font-bold text-white tabular-nums">
              {formatCurrency(stats.totalSalesValue)}
            </p>
            <p className="text-xs text-white/60 mt-1">Potential Revenue (Current Sell Price)</p>
          </CardContent>
        </Card>
      </div>

      {/* Desktop: Original Filters */}
      <div className="hidden md:block space-y-3">
        {/* Desktop Stock Status */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setStockStatus('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              stockStatus === 'all'
                ? 'bg-gradient-to-r from-[#259783] to-[#45d827] text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Package className="w-3 h-3" />
            All ({stats.total})
          </button>
          <button
            onClick={() => setStockStatus('in_stock')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              stockStatus === 'in_stock'
                ? 'bg-gradient-to-r from-[#259783] to-[#45d827] text-white shadow-md'
                : 'bg-[#259783]/10 text-[#259783]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            In Stock ({stats.inStock})
          </button>
          <button
            onClick={() => setStockStatus('out_of_stock')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              stockStatus === 'out_of_stock'
                ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <XCircle className="w-3 h-3" />
            Out ({stats.outOfStock})
          </button>
        </div>

      </div>


      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No items found</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Clean App-Style Cards */}
          <div className="md:hidden space-y-2">
            {filteredItems.map((item) => {
              const low = isLowStock(item);
              const outOfStock = item.current_stock <= 0;
              const trendConfig = TREND_CONFIG[item.trend];
              const TrendIcon = trendConfig.icon;
              const isStable = item.trend === 'stable';
              const stockPercentage = item.initial_stock > 0 
                ? Math.min((item.current_stock / item.initial_stock) * 100, 100) 
                : 0;
              
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm"
                >
                  {/* Top Row: Name, Category, Stock */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h3>
                        {outOfStock && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-full">
                            OUT
                          </span>
                        )}
                        {!outOfStock && low && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full">
                            LOW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.category_name || 'Uncategorized'}
                      </p>
                    </div>
                    
                    {/* Stock Amount */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className={`text-xl font-bold tabular-nums ${
                          outOfStock 
                            ? 'text-slate-300 dark:text-slate-600' 
                            : low 
                            ? 'text-amber-500' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {formatStock(item.current_stock, item.unit_type)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">{item.unit_type}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          outOfStock
                            ? 'bg-slate-300 dark:bg-slate-600'
                            : low
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : 'bg-gradient-to-r from-[#259783] to-[#45d827]'
                        }`}
                        style={{ width: `${stockPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Bottom Row: Values & Trend */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Stock Value</p>
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(item.stock_value || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Sales Value</p>
                        <p className="text-sm font-semibold text-[#259783]">
                          {formatCurrency(item.sales_value || item.current_value || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Change</p>
                        <p className={`text-sm font-semibold ${
                          item.stock_change_percent === null 
                            ? 'text-slate-400' 
                            : item.stock_change_percent >= 0 
                            ? 'text-[#259783]' 
                            : 'text-rose-500'
                        }`}>
                          {formatChange(item.stock_change_percent)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Trend Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                      isStable
                        ? 'bg-gradient-to-r from-[#259783]/10 to-[#45d827]/10'
                        : trendConfig.bg
                    }`}>
                      <TrendIcon className={`w-3.5 h-3.5 ${trendConfig.color}`} />
                      <span className={`text-xs font-semibold ${trendConfig.color}`}>
                        {trendConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Compact Table */}
          <Card className="hidden md:block bg-white dark:bg-[#1c2e18] border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-[#1c2e18]">
                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Item</th>
                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Category</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Initial Stock</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Initial Value</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Current Stock</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Stock Value</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Sales Value</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-32">Growth</th>
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, i) => {
                    const low = isLowStock(item);
                    const outOfStock = item.current_stock <= 0;
                    const trendConfig = TREND_CONFIG[item.trend];
                    const TrendIcon = trendConfig.icon;
                    const isStable = item.trend === 'stable';
                    
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-gradient-to-r hover:from-[#259783]/5 hover:to-transparent dark:hover:from-[#259783]/10 dark:hover:to-transparent transition-all ${
                          i % 2 === 0 ? 'bg-white dark:bg-[#1c2e18]' : 'bg-slate-50/30 dark:bg-slate-900/20'
                        } ${isStable ? 'hover:border-l-2 hover:border-l-[#259783]' : ''}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 flex items-center justify-center shadow-sm ${
                              outOfStock ? 'bg-slate-100 dark:bg-slate-800' 
                              : low ? 'bg-amber-100 dark:bg-amber-900/30' 
                              : isStable
                              ? 'bg-gradient-to-br from-[#259783] to-[#45d827]'
                              : trendConfig.bg
                            }`}>
                              {outOfStock || low ? (
                                <AlertTriangle className={`w-4 h-4 ${outOfStock ? 'text-slate-400' : 'text-amber-500'}`} />
                              ) : (
                                <TrendIcon className={`w-4 h-4 ${isStable ? 'text-white' : trendConfig.color}`} />
                              )}
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">{item.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-400">{item.category_name || '—'}</td>
                        <td className="p-4 text-center text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-medium">{item.initial_stock.toFixed(1)}</span> <span className="text-slate-400">{item.unit_type}</span>
                        </td>
                        <td className="p-4 text-center text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold">{formatCurrency(item.initial_value)}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-bold text-sm ${
                            outOfStock ? 'text-slate-400 dark:text-slate-500' : low ? 'text-amber-500' : isStable ? 'text-[#259783]' : 'text-slate-900 dark:text-white'
                          }`}>
                            {formatStock(item.current_stock, item.unit_type)}
                          </span>
                          <span className="text-slate-400 text-xs ml-1">{item.unit_type}</span>
                        </td>
                        <td className="p-4 text-center text-xs">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.stock_value || 0)}
                          </span>
                        </td>
                        <td className="p-4 text-center text-xs">
                          <span className={`font-bold ${isStable ? 'text-[#259783]' : trendConfig.color}`}>
                            {formatCurrency(item.sales_value || item.current_value || 0)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-inner">
                              {item.initial_stock > 0 && (
                                <div
                                  className={`h-full bg-gradient-to-r ${trendConfig.gradient} shadow-sm`}
                                  style={{ 
                                    width: `${Math.min(Math.max((item.current_stock / item.initial_stock) * 100, 0), 100)}%`
                                  }}
                                />
                              )}
                            </div>
                            <span className={`text-xs font-bold w-12 text-right ${isStable ? 'text-[#259783]' : trendConfig.color}`}>
                              {formatChange(item.stock_change_percent)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold shadow-sm ${
                            isStable
                              ? 'bg-gradient-to-r from-[#259783] to-[#45d827] text-white'
                              : `${trendConfig.bg} ${trendConfig.color}`
                          }`}>
                            <TrendIcon className="w-3 h-3" />
                            {trendConfig.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
