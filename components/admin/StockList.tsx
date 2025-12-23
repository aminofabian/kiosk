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
  current_value: number;
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
    <div className="space-y-3">
      {/* Compact Stats Row */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(['growing', 'stable', 'shrinking', 'new'] as const).map((trend) => {
          const config = TREND_CONFIG[trend];
          const count = stats[trend];
          const isActive = selectedTrend === trend;
          const Icon = config.icon;
          
          return (
            <button
              key={trend}
              onClick={() => setSelectedTrend(isActive ? 'all' : trend)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                  : `${config.bg} ${config.color} hover:ring-2 ${config.ring}`
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{count}</span>
              <span className="hidden sm:inline">{config.label}</span>
            </button>
          );
        })}
        {selectedTrend !== 'all' && (
          <button
            onClick={() => setSelectedTrend('all')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stock Status Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setStockStatus('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
            stockStatus === 'all'
              ? 'bg-gradient-to-r from-[#259783] to-[#45d827] text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Package className="w-3 h-3" />
          <span>All</span>
          <span className="hidden sm:inline">({stats.total})</span>
        </button>
        <button
          onClick={() => setStockStatus('in_stock')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
            stockStatus === 'in_stock'
              ? 'bg-gradient-to-r from-[#259783] to-[#45d827] text-white shadow-md'
              : 'bg-[#259783]/10 dark:bg-[#259783]/20 text-[#259783] hover:ring-2 ring-[#259783]/20'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>In Stock</span>
          <span className="hidden sm:inline">({stats.inStock})</span>
        </button>
        <button
          onClick={() => setStockStatus('out_of_stock')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
            stockStatus === 'out_of_stock'
              ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <XCircle className="w-3 h-3" />
          <span>Out of Stock</span>
          <span className="hidden sm:inline">({stats.outOfStock})</span>
        </button>
      </div>

      {/* Search Row */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-10 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 focus:border-[#259783] shadow-sm w-full"
          style={{ fontSize: '16px', fontWeight: '500' }}
        />
      </div>

      {/* Filters Row */}
      <div className="flex gap-2 items-center">
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-12 pl-4 pr-10 font-semibold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 appearance-none cursor-pointer focus:ring-2 focus:ring-[#259783]/30 focus:border-[#259783] min-w-[160px] shadow-sm hover:border-[#259783]/50 transition-colors"
            style={{ fontSize: '16px', lineHeight: '1.5', fontWeight: '600' }}
          >
            <option value="all" style={{ fontSize: '24px', padding: '12px' }}>All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id} style={{ fontSize: '48px', padding: '32px' }}>{cat.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 dark:text-slate-300 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'stock' | 'growth')}
            className="h-12 pl-4 pr-10 font-semibold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 appearance-none cursor-pointer focus:ring-2 focus:ring-[#259783]/30 focus:border-[#259783] min-w-[150px] shadow-sm hover:border-[#259783]/50 transition-colors"
            style={{ fontSize: '16px', lineHeight: '1.5', fontWeight: '600' }}
          >
            <option value="growth" style={{ fontSize: '36px', padding: '24px' }}>By Growth</option>
            <option value="name" style={{ fontSize: '36px', padding: '24px' }}>By Name</option>
            <option value="stock" style={{ fontSize: '36px', padding: '24px' }}>By Stock</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 dark:text-slate-300 pointer-events-none" />
        </div>
      </div>

      {/* Items Count */}
      <p className="text-xs text-slate-500 px-1">
        {filteredItems.length} of {stats.total} items
      </p>

      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No items found</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Compact Cards */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {filteredItems.map((item) => {
              const low = isLowStock(item);
              const outOfStock = item.current_stock <= 0;
              const trendConfig = TREND_CONFIG[item.trend];
              const TrendIcon = trendConfig.icon;
              const isStable = item.trend === 'stable';
              
              return (
                <div
                  key={item.id}
                  className={`group relative bg-white dark:bg-[#1c2e18] p-2.5 border-2 transition-all hover:shadow-md hover:shadow-[#259783]/10 ${
                    outOfStock
                      ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1c2e18]'
                      : low
                      ? 'border-amber-300 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-[#1c2e18]'
                      : isStable
                      ? 'border-[#259783]/30 dark:border-[#259783]/40 bg-gradient-to-br from-[#259783]/5 to-white dark:from-[#259783]/10 dark:to-[#1c2e18] hover:border-[#259783]/50'
                      : 'border-slate-200 dark:border-slate-800 hover:border-[#259783]/30'
                  }`}
                >
                  {/* Theme accent bar */}
                  {!outOfStock && !low && (
                    <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${trendConfig.gradient}`} />
                  )}
                  
                  <div className="flex items-center gap-2">
                    {/* Trend Indicator */}
                    <div className={`w-10 h-10 flex items-center justify-center shadow-sm ${
                      isStable 
                        ? 'bg-gradient-to-br from-[#259783] to-[#45d827]' 
                        : outOfStock
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : trendConfig.bg
                    }`}>
                      <TrendIcon className={`w-5 h-5 ${isStable ? 'text-white' : outOfStock ? 'text-slate-400' : trendConfig.color}`} />
                    </div>
                    
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h3>
                        {outOfStock && <Badge className="h-3.5 text-[9px] px-1 font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">OUT</Badge>}
                        {!outOfStock && low && <Badge className="h-3.5 text-[9px] px-1 bg-amber-500 font-semibold">LOW</Badge>}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.category_name || 'Uncategorized'}</p>
                    </div>
                    
                    {/* Stock & Growth */}
                    <div className="text-right">
                      <div className="flex items-baseline gap-0.5 justify-end">
                        <span className={`text-base font-bold ${
                          outOfStock ? 'text-slate-400 dark:text-slate-500' : low ? 'text-amber-500' : isStable ? 'text-[#259783]' : 'text-slate-900 dark:text-white'
                        }`}>
                          {formatStock(item.current_stock, item.unit_type)}
                        </span>
                        <span className="text-[9px] text-slate-400">{item.unit_type}</span>
                      </div>
                      <div className={`text-[10px] font-semibold ${isStable ? 'text-[#259783]' : trendConfig.color}`}>
                        {formatChange(item.stock_change_percent)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stock Values */}
                  <div className="mt-2 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-1.5">
                      <p className="text-[9px] text-slate-400 mb-0.5 font-medium">Initial Value</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {formatCurrency(item.initial_value)}
                      </p>
                    </div>
                    <div className={`p-1.5 ${
                      isStable 
                        ? 'bg-gradient-to-br from-[#259783]/10 to-[#45d827]/10 dark:from-[#259783]/20 dark:to-[#45d827]/20' 
                        : 'bg-slate-50 dark:bg-slate-900/50'
                    }`}>
                      <p className="text-[9px] text-slate-400 mb-0.5 font-medium">Current Value</p>
                      <p className={`text-[10px] font-bold ${isStable ? 'text-[#259783]' : trendConfig.color}`}>
                        {formatCurrency(item.current_value)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 w-10 font-medium">{item.initial_stock.toFixed(0)}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden shadow-inner">
                      {item.initial_stock > 0 && (
                        <div
                          className={`h-full bg-gradient-to-r ${trendConfig.gradient} shadow-sm`}
                          style={{ 
                            width: `${Math.min(Math.max((item.current_stock / item.initial_stock) * 100, 0), 200)}%`,
                            maxWidth: '100%'
                          }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 w-10 text-right font-medium">{item.current_stock.toFixed(0)}</span>
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
                    <th className="text-center p-4 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Current Value</th>
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
                          <span className={`font-bold ${isStable ? 'text-[#259783]' : trendConfig.color}`}>
                            {formatCurrency(item.current_value)}
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
