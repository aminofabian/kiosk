'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchFilterSection } from './SearchFilterSection';
import { Loader2, Package, AlertTriangle } from 'lucide-react';
import type { Item, Category } from '@/lib/db/types';
import type { UnitType } from '@/lib/constants';

interface StockItem extends Item {
  category_name?: string;
}

export function StockList() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock'>('name');

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
    if (stock <= 0) return 'Out of stock';
    return `${stock.toFixed(2)} ${unitType}`;
  };

  const isLowStock = (item: StockItem) => {
    if (!item.min_stock_level) return false;
    return item.current_stock <= item.min_stock_level;
  };

  const filteredItems = items
    .filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !item.name.toLowerCase().includes(query) &&
          !item.category_name?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'stock') {
        return a.current_stock - b.current_stock;
      }
      return a.name.localeCompare(b.name);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading stock...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SearchFilterSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search items by name or category..."
        filters={[
          {
            label: 'Category',
            value: selectedCategory,
            options: [
              { value: 'all', label: 'All Categories' },
              ...categories.map((cat) => ({
                value: cat.id,
                label: cat.name,
              })),
            ],
            onChange: setSelectedCategory,
          },
        ]}
        sortOptions={[
          { value: 'name', label: 'Sort by Name' },
          { value: 'stock', label: 'Sort by Stock (Lowest)' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as 'name' | 'stock')}
      />

      {filteredItems.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No items found</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredItems.map((item) => {
              const low = isLowStock(item);
              const outOfStock = item.current_stock <= 0;
              return (
                <Card
                  key={item.id}
                  className={`bg-white dark:bg-[#1c2e18] border transition-all ${
                    outOfStock
                      ? 'border-red-200 dark:border-red-800'
                      : low
                      ? 'border-orange-200 dark:border-orange-800'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          outOfStock
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : low
                            ? 'bg-orange-50 dark:bg-orange-900/20'
                            : 'bg-[#4bee2b]/10'
                        }`}>
                          {outOfStock || low ? (
                            <AlertTriangle className={`w-5 h-5 ${outOfStock ? 'text-red-500' : 'text-orange-500'}`} />
                          ) : (
                            <Package className="w-5 h-5 text-[#4bee2b]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-white truncate">{item.name}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {item.category_name || 'Uncategorized'}
                          </p>
                        </div>
                      </div>
                      {outOfStock ? (
                        <Badge variant="destructive">Out</Badge>
                      ) : low ? (
                        <Badge className="bg-orange-500 hover:bg-orange-600">Low</Badge>
                      ) : (
                        <Badge className="bg-[#4bee2b] hover:bg-[#45d827] text-[#101b0d]">OK</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Stock</p>
                        <p className={`font-bold ${
                          outOfStock ? 'text-red-500' : low ? 'text-orange-500' : 'text-[#4bee2b]'
                        }`}>
                          {formatStock(item.current_stock, item.unit_type)}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Min Level</p>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {item.min_stock_level ? `${item.min_stock_level} ${item.unit_type}` : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                      <th className="text-left p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Item Name</th>
                      <th className="text-left p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Category</th>
                      <th className="text-right p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Current Stock</th>
                      <th className="text-right p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Min Level</th>
                      <th className="text-center p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const low = isLowStock(item);
                      const outOfStock = item.current_stock <= 0;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors ${
                            outOfStock
                              ? 'bg-red-50/50 dark:bg-red-950/10'
                              : low
                              ? 'bg-orange-50/50 dark:bg-orange-950/10'
                              : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                outOfStock
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : low
                                  ? 'bg-orange-100 dark:bg-orange-900/30'
                                  : 'bg-[#4bee2b]/10'
                              }`}>
                                <Package className={`w-4 h-4 ${
                                  outOfStock ? 'text-red-500' : low ? 'text-orange-500' : 'text-[#4bee2b]'
                                }`} />
                              </div>
                              <span className="font-semibold text-slate-900 dark:text-white">{item.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                            {item.category_name || 'Uncategorized'}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`font-bold ${
                              outOfStock ? 'text-red-500' : low ? 'text-orange-500' : 'text-[#4bee2b]'
                            }`}>
                              {formatStock(item.current_stock, item.unit_type)}
                            </span>
                          </td>
                          <td className="p-4 text-right text-sm text-slate-500 dark:text-slate-400">
                            {item.min_stock_level ? `${item.min_stock_level} ${item.unit_type}` : '—'}
                          </td>
                          <td className="p-4 text-center">
                            {outOfStock ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : low ? (
                              <Badge className="bg-orange-500 hover:bg-orange-600">Low Stock</Badge>
                            ) : (
                              <Badge className="bg-[#4bee2b] hover:bg-[#45d827] text-[#101b0d]">In Stock</Badge>
                            )}
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
    </div>
  );
}
