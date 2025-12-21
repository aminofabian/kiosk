'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Package, AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles, Search, ChevronDown } from 'lucide-react';
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
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    ring: 'ring-emerald-500/20',
    gradient: 'from-emerald-500 to-green-500',
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
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'stock') return a.current_stock - b.current_stock;
        if (sortBy === 'growth') return (b.stock_change_percent ?? -999) - (a.stock_change_percent ?? -999);
        return a.name.localeCompare(b.name);
      });
  }, [items, searchQuery, selectedCategory, selectedTrend, sortBy]);

  const stats = useMemo(() => ({
    growing: items.filter(i => i.trend === 'growing').length,
    stable: items.filter(i => i.trend === 'stable').length,
    shrinking: items.filter(i => i.trend === 'shrinking').length,
    new: items.filter(i => i.trend === 'new').length,
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
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
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search & Filters Row */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          />
        </div>
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 pl-2 pr-6 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md appearance-none cursor-pointer focus:ring-2 focus:ring-[#259783]/20 focus:border-[#259783]"
          >
            <option value="all">All</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'stock' | 'growth')}
            className="h-8 pl-2 pr-6 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md appearance-none cursor-pointer focus:ring-2 focus:ring-[#259783]/20 focus:border-[#259783]"
          >
            <option value="growth">By Growth</option>
            <option value="name">By Name</option>
            <option value="stock">By Stock</option>
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
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
              
              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-[#1c2e18] rounded-xl p-3 border transition-all ${
                    outOfStock
                      ? 'border-rose-200 dark:border-rose-800/50'
                      : low
                      ? 'border-amber-200 dark:border-amber-800/50'
                      : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Trend Indicator */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trendConfig.bg}`}>
                      <TrendIcon className={`w-5 h-5 ${trendConfig.color}`} />
                    </div>
                    
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h3>
                        {outOfStock && <Badge variant="destructive" className="h-4 text-[10px] px-1">OUT</Badge>}
                        {!outOfStock && low && <Badge className="h-4 text-[10px] px-1 bg-amber-500">LOW</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{item.category_name || 'Uncategorized'}</p>
                    </div>
                    
                    {/* Stock & Growth */}
                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className={`text-lg font-bold ${
                          outOfStock ? 'text-rose-500' : low ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                        }`}>
                          {formatStock(item.current_stock, item.unit_type)}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.unit_type}</span>
                      </div>
                      <div className={`text-xs font-medium ${trendConfig.color}`}>
                        {formatChange(item.stock_change_percent)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stock Values */}
                  <div className="mt-2 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Initial Value</p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {formatCurrency(item.initial_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Current Value</p>
                      <p className={`text-xs font-semibold ${trendConfig.color}`}>
                        {formatCurrency(item.current_value)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-12">{item.initial_stock.toFixed(0)}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      {item.initial_stock > 0 && (
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${trendConfig.gradient}`}
                          style={{ 
                            width: `${Math.min(Math.max((item.current_stock / item.initial_stock) * 100, 0), 200)}%`,
                            maxWidth: '100%'
                          }}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 w-12 text-right">{item.current_stock.toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Compact Table */}
          <Card className="hidden md:block bg-white dark:bg-[#1c2e18] border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="text-left p-3 font-medium text-slate-500 text-xs">Item</th>
                    <th className="text-left p-3 font-medium text-slate-500 text-xs">Category</th>
                    <th className="text-center p-3 font-medium text-slate-500 text-xs">Initial Stock</th>
                    <th className="text-center p-3 font-medium text-slate-500 text-xs">Initial Value</th>
                    <th className="text-center p-3 font-medium text-slate-500 text-xs">Current Stock</th>
                    <th className="text-center p-3 font-medium text-slate-500 text-xs">Current Value</th>
                    <th className="text-center p-3 font-medium text-slate-500 text-xs w-32">Growth</th>
                    <th className="text-center p-3 font-medium text-slate-500 text-xs">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, i) => {
                    const low = isLowStock(item);
                    const outOfStock = item.current_stock <= 0;
                    const trendConfig = TREND_CONFIG[item.trend];
                    const TrendIcon = trendConfig.icon;
                    
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-slate-25 dark:bg-slate-900/20'
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              outOfStock ? 'bg-rose-100 dark:bg-rose-900/30' 
                              : low ? 'bg-amber-100 dark:bg-amber-900/30' 
                              : trendConfig.bg
                            }`}>
                              {outOfStock || low ? (
                                <AlertTriangle className={`w-3 h-3 ${outOfStock ? 'text-rose-500' : 'text-amber-500'}`} />
                              ) : (
                                <TrendIcon className={`w-3 h-3 ${trendConfig.color}`} />
                              )}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white text-xs">{item.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-500">{item.category_name || '—'}</td>
                        <td className="p-3 text-center text-xs text-slate-500">
                          {item.initial_stock.toFixed(1)} <span className="text-slate-400">{item.unit_type}</span>
                        </td>
                        <td className="p-3 text-center text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-medium">{formatCurrency(item.initial_value)}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-semibold text-xs ${
                            outOfStock ? 'text-rose-500' : low ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                          }`}>
                            {formatStock(item.current_stock, item.unit_type)}
                          </span>
                          <span className="text-slate-400 text-xs ml-0.5">{item.unit_type}</span>
                        </td>
                        <td className="p-3 text-center text-xs">
                          <span className={`font-semibold ${trendConfig.color}`}>
                            {formatCurrency(item.current_value)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              {item.initial_stock > 0 && (
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${trendConfig.gradient}`}
                                  style={{ 
                                    width: `${Math.min(Math.max((item.current_stock / item.initial_stock) * 100, 0), 100)}%`
                                  }}
                                />
                              )}
                            </div>
                            <span className={`text-xs font-semibold w-10 text-right ${trendConfig.color}`}>
                              {formatChange(item.stock_change_percent)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${trendConfig.bg} ${trendConfig.color}`}>
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
