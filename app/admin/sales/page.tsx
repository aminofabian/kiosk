'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Search,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  PackageX,
  Wallet,
  CreditCard,
  Smartphone,
  Calendar,
  X,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import { getCategoryShopType, type ShopType } from '@/lib/utils/shop-type';

interface ItemSalesData {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  category_name: string;
  parent_name: string | null;
  parent_item_id: string | null;
  total_quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  current_stock: number;
  min_stock_level: number | null;
  transaction_count: number;
  avg_sell_price: number;
}

interface ParentItem {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface SalesSummary {
  totalTransactions: number;
  totalItemsSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  uniqueProductsSold: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface SalesAnalyticsData {
  summary: SalesSummary;
  items: ItemSalesData[];
  topSellers: ItemSalesData[];
  noSalesItems: ItemSalesData[];
  salesByPaymentMethod: { payment_method: string; count: number; total: number }[];
  period: string;
}

const PAYMENT_METHOD_ICONS: Record<string, typeof Wallet> = {
  cash: Wallet,
  mpesa: Smartphone,
  credit: CreditCard,
  split: DollarSign,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  credit: 'Credit',
  split: 'Split Payment',
};

export default function SalesAnalyticsPage() {
  const [data, setData] = useState<SalesAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [parentFilter, setParentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [shopTypeFilter, setShopTypeFilter] = useState<'all' | ShopType>('all');
  const [parentItems, setParentItems] = useState<ParentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchData();
  }, [period, parentFilter, categoryFilter]);

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      // Fetch parent items
      const parentsResult = await apiGet<ParentItem[]>('/api/items?all=true&parentsOnly=true');
      if (parentsResult.success && parentsResult.data) {
        setParentItems(parentsResult.data);
      }

      // Fetch categories
      const categoriesResult = await apiGet<Category[]>('/api/categories');
      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data);
      }
    } catch (err) {
      console.error('Error fetching filters:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let url = `/api/sales/analytics?period=${period}`;
      if (parentFilter !== 'all') {
        url += `&parentId=${parentFilter}`;
      }
      if (categoryFilter !== 'all') {
        url += `&categoryId=${categoryFilter}`;
      }
      const result = await apiGet<SalesAnalyticsData>(url);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load sales data');
      }
    } catch (err) {
      setError('Failed to load sales data');
      console.error('Error fetching sales analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  };

  const getStockStatus = (item: ItemSalesData) => {
    if (item.current_stock <= 0) {
      return { label: 'Out of Stock', color: 'bg-red-500', textColor: 'text-red-600' };
    }
    if (item.min_stock_level && item.current_stock <= item.min_stock_level) {
      return { label: 'Low Stock', color: 'bg-orange-500', textColor: 'text-orange-600' };
    }
    return { label: 'In Stock', color: 'bg-green-500', textColor: 'text-green-600' };
  };

  // Filter items by shop type
  const shopTypeFilteredItems = data?.items.filter((item) => {
    if (shopTypeFilter === 'all') return true;
    
    // Skip items without category names
    if (!item.category_name || item.category_name.trim() === '') return false;
    
    const itemShopType = getCategoryShopType(item.category_name);
    // Only include items whose category matches the selected shop type
    // Strictly exclude items with null shop type (unclassified categories)
    // This ensures we only show items that are definitively grocery or retail
    if (itemShopType === null) return false;
    return itemShopType === shopTypeFilter;
  }) || [];

  // Calculate filtered summary stats
  // When filter is 'all', use the original summary from API (more accurate, calculated at DB level)
  // When filtering by shop type, recalculate from filtered items
  const filteredSummary = shopTypeFilter === 'all' && data?.summary 
    ? data.summary 
    : (shopTypeFilteredItems.length > 0 ? {
        // Note: We can't accurately count unique transactions from item-level data
        // (summing transaction_count would count transactions multiple times)
        // So we use the max transaction_count as a rough estimate, or keep original if available
        totalTransactions: data?.summary?.totalTransactions || Math.max(...shopTypeFilteredItems.map(i => i.transaction_count), 0),
        totalItemsSold: shopTypeFilteredItems.reduce((sum, item) => sum + item.total_quantity_sold, 0),
        totalRevenue: shopTypeFilteredItems.reduce((sum, item) => sum + item.total_revenue, 0),
        totalCost: shopTypeFilteredItems.reduce((sum, item) => sum + item.total_cost, 0),
        totalProfit: shopTypeFilteredItems.reduce((sum, item) => sum + item.total_profit, 0),
        profitMargin: (() => {
          const revenue = shopTypeFilteredItems.reduce((sum, item) => sum + item.total_revenue, 0);
          const profit = shopTypeFilteredItems.reduce((sum, item) => sum + item.total_profit, 0);
          return revenue > 0 ? (profit / revenue) * 100 : 0;
        })(),
        uniqueProductsSold: shopTypeFilteredItems.filter((i) => i.total_quantity_sold > 0).length,
        lowStockCount: shopTypeFilteredItems.filter(
          (i) => i.min_stock_level !== null && i.current_stock > 0 && i.current_stock <= i.min_stock_level
        ).length,
        outOfStockCount: shopTypeFilteredItems.filter((i) => i.current_stock <= 0).length,
      } : data?.summary || {
        totalTransactions: 0,
        totalItemsSold: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMargin: 0,
        uniqueProductsSold: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      });

  // Filter items
  const filteredItems = shopTypeFilteredItems.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.variant_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.category_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in-stock' && item.current_stock > 0 && (!item.min_stock_level || item.current_stock > item.min_stock_level)) ||
      (stockFilter === 'low-stock' && item.min_stock_level && item.current_stock > 0 && item.current_stock <= item.min_stock_level) ||
      (stockFilter === 'out-of-stock' && item.current_stock <= 0) ||
      (stockFilter === 'sold' && item.total_quantity_sold > 0) ||
      (stockFilter === 'not-sold' && item.total_quantity_sold === 0);

    return matchesSearch && matchesStock;
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#259783]" />
            <p className="text-slate-500 dark:text-slate-400">Loading sales data...</p>
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

  if (!data) return null;

  const periodLabels: Record<string, string> = {
    today: 'Today',
    '3days': 'Past 3 Days',
    week: 'This Week',
    month: 'This Month',
    all: 'All Time',
  };

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#259783] flex items-center justify-center rounded-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    Sales Analytics
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {periodLabels[period]} • {formatNumber(filteredSummary.totalTransactions)} transactions
                    {shopTypeFilter !== 'all' && (
                      <span className="ml-2 px-2 py-0.5 bg-[#259783]/10 text-[#259783] rounded text-xs font-semibold">
                        {shopTypeFilter === 'grocery' ? '🥬 Grocery' : '🏪 Retail'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button onClick={fetchData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={period === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('today')}
                className={`h-9 ${period === 'today' ? 'bg-[#259783] hover:bg-[#1a7a69]' : ''}`}
              >
                <Calendar className="w-4 h-4 mr-1" />
                Today
              </Button>

              <div className="flex items-center gap-2">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[140px] h-9 border-2 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="3days">Past 3 Days</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                <Button
                  variant={shopTypeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShopTypeFilter('all')}
                  className={`h-9 ${shopTypeFilter === 'all' ? 'bg-[#259783] hover:bg-[#1a7a69]' : ''}`}
                >
                  All
                </Button>
                <Button
                  variant={shopTypeFilter === 'grocery' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShopTypeFilter('grocery')}
                  className={`h-9 ${shopTypeFilter === 'grocery' ? 'bg-[#259783] hover:bg-[#1a7a69]' : ''}`}
                >
                  🥬 Grocery
                </Button>
                <Button
                  variant={shopTypeFilter === 'retail' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShopTypeFilter('retail')}
                  className={`h-9 ${shopTypeFilter === 'retail' ? 'bg-[#259783] hover:bg-[#1a7a69]' : ''}`}
                >
                  🏪 Retail
                </Button>
              </div>

              {categories.length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[150px] h-9 border-2 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {parentItems.length > 0 && (
                <Select value={parentFilter} onValueChange={setParentFilter}>
                  <SelectTrigger className="w-[160px] h-9 border-2 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Parent Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {parentItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[140px] h-9 border-2 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="sold">Has Sales</SelectItem>
                    <SelectItem value="not-sold">No Sales</SelectItem>
                    <SelectItem value="in-stock">In Stock</SelectItem>
                    <SelectItem value="low-stock">Low Stock</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(categoryFilter !== 'all' || parentFilter !== 'all' || stockFilter !== 'all' || shopTypeFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter('all');
                    setParentFilter('all');
                    setStockFilter('all');
                    setShopTypeFilter('all');
                  }}
                  className="h-9 text-slate-500 hover:text-slate-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear Filters
                </Button>
              )}

              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="pl-10 h-9 border-2 border-slate-200 dark:border-slate-700"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCart className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {formatNumber(data.summary.totalTransactions)} orders
                  </Badge>
                </div>
                <p className="text-blue-100 text-xs font-medium mb-1">Total Revenue</p>
                <p className="text-xl font-black text-white">{formatPrice(filteredSummary.totalRevenue)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {filteredSummary.profitMargin.toFixed(1)}% margin
                  </Badge>
                </div>
                <p className="text-green-100 text-xs font-medium mb-1">Total Profit</p>
                <p className="text-xl font-black text-white">{formatPrice(filteredSummary.totalProfit)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {filteredSummary.uniqueProductsSold} products
                  </Badge>
                </div>
                <p className="text-purple-100 text-xs font-medium mb-1">Items Sold</p>
                <p className="text-xl font-black text-white">{formatNumber(filteredSummary.totalItemsSold)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-white/80" />
                </div>
                <p className="text-orange-100 text-xs font-medium mb-1">Stock Alerts</p>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xl font-black text-white">{filteredSummary.outOfStockCount}</p>
                    <p className="text-[10px] text-orange-100">Out</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <p className="text-xl font-black text-white">{filteredSummary.lowStockCount}</p>
                    <p className="text-[10px] text-orange-100">Low</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          {data.salesByPaymentMethod.length > 0 && (
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#259783]" />
                  Sales by Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {data.salesByPaymentMethod.map((pm) => {
                    const Icon = PAYMENT_METHOD_ICONS[pm.payment_method] || Wallet;
                    return (
                      <div
                        key={pm.payment_method}
                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-[#259783]" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {PAYMENT_METHOD_LABELS[pm.payment_method] || pm.payment_method}
                          </span>
                        </div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {formatPrice(pm.total)}
                        </p>
                        <p className="text-xs text-slate-500">{pm.count} transactions</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products Sold Breakdown */}
          {(() => {
            const soldItems = shopTypeFilteredItems
              .filter(i => i.total_quantity_sold > 0)
              .filter(item => 
                item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.variant_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                item.category_name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold);
            const maxSold = soldItems.length > 0 ? soldItems[0].total_quantity_sold : 1;

            if (soldItems.length === 0) return null;

            return (
              <Card className="border-2 border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-[#259783]" />
                      Products Sold ({soldItems.length} products, {formatNumber(filteredSummary.totalItemsSold)} units)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {soldItems.map((item) => {
                    const barWidth = (item.total_quantity_sold / maxSold) * 100;
                    const stockStatus = getStockStatus(item);
                    return (
                      <div key={item.item_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {item.item_name}
                            </span>
                            {item.variant_name && (
                              <span className="text-xs text-slate-500 truncate">
                                ({item.variant_name})
                              </span>
                            )}
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {item.category_name}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="font-black text-[#259783] text-base min-w-[60px] text-right">
                              {formatNumber(item.total_quantity_sold)}
                            </span>
                            <span className={`text-xs font-medium min-w-[50px] text-right ${stockStatus.textColor}`}>
                              {formatNumber(item.current_stock)} left
                            </span>
                          </div>
                        </div>
                        <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#259783] to-[#1a7a69] rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{item.transaction_count} orders</span>
                          <span>Revenue: {formatPrice(item.total_revenue)}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}

          {/* Top Sellers */}
          {(() => {
            const topSellers = shopTypeFilteredItems
              .filter((i) => i.total_quantity_sold > 0)
              .filter(item => 
                item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.variant_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                item.category_name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
              .slice(0, 5);
            
            if (topSellers.length === 0) return null;

            return (
              <Card className="border-2 border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                    Top Selling Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {topSellers.map((item, index) => {
                    const stockStatus = getStockStatus(item);
                    return (
                      <div
                        key={item.item_id}
                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-[#259783] text-white text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <Badge className={stockStatus.color + ' text-white text-[9px]'}>
                            {stockStatus.label}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.item_name}
                        </h4>
                        {item.variant_name && (
                          <p className="text-xs text-slate-500 truncate">{item.variant_name}</p>
                        )}
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Sold</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatNumber(item.total_quantity_sold)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-slate-500">Stock</span>
                            <span className={`font-bold ${stockStatus.textColor}`}>
                              {formatNumber(item.current_stock)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-slate-500">Revenue</span>
                            <span className="font-bold text-[#259783]">
                              {formatPrice(item.total_revenue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            );
          })()}

          {/* All Products Table */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#259783]" />
                  All Products ({filteredItems.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-y border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Product
                      </th>
                      <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Category
                      </th>
                      <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Sold
                      </th>
                      <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Revenue
                      </th>
                      <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Profit
                      </th>
                      <th className="text-right text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Stock
                      </th>
                      <th className="text-center text-xs font-bold text-slate-600 dark:text-slate-400 px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12">
                          <PackageX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-500">No products found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const stockStatus = getStockStatus(item);
                        return (
                          <tr
                            key={item.item_id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                  {item.item_name}
                                </p>
                                {item.variant_name && (
                                  <p className="text-xs text-slate-500">{item.variant_name}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {item.category_name}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold text-sm ${item.total_quantity_sold > 0
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-400'
                                }`}>
                                {formatNumber(item.total_quantity_sold)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                                {formatPrice(item.total_revenue)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-semibold text-sm ${item.total_profit > 0 ? 'text-green-600' : 'text-slate-400'
                                }`}>
                                {formatPrice(item.total_profit)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold text-sm ${stockStatus.textColor}`}>
                                {formatNumber(item.current_stock)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={stockStatus.color + ' text-white text-[10px]'}>
                                {stockStatus.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* No Sales Items */}
          {(() => {
            const noSalesItems = shopTypeFilteredItems.filter((i) => i.total_quantity_sold === 0);
            if (noSalesItems.length === 0 || stockFilter !== 'all' || searchQuery) return null;

            return (
              <Card className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-orange-600">
                    <ArrowDownRight className="w-4 h-4" />
                    Products with No Sales ({noSalesItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {noSalesItems.map((item) => (
                    <Badge
                      key={item.item_id}
                      variant="outline"
                      className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300"
                    >
                      {item.item_name}
                      {item.variant_name && ` (${item.variant_name})`}
                      <span className="ml-2 text-orange-500">
                        Stock: {formatNumber(item.current_stock)}
                      </span>
                    </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>
    </AdminLayout>
  );
}
