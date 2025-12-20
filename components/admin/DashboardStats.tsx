'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  totalSales: number;
  salesCount: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  topItems: Array<{
    item_id: string;
    item_name: string;
    quantity_sold: number;
    total_sales: number;
    total_cost: number;
    total_profit: number;
  }>;
  lowStockItems: Array<{
    id: string;
    name: string;
    current_stock: number;
    min_stock_level: number;
  }>;
}

export function DashboardStats() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      setError(null);
      const dateTimestamp = Math.floor(
        new Date(selectedDate + 'T23:59:59').getTime() / 1000
      );

      const response = await fetch(`/api/dashboard?date=${dateTimestamp}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[#4bee2b]/10 flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-[#4bee2b] animate-spin" />
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isPositiveMargin = data.profitMargin > 0;

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex items-center gap-3 bg-white dark:bg-[#1c2e18] rounded-xl p-2 border border-slate-200 dark:border-slate-800 w-fit">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 pl-2">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Date:</span>
        </div>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-40 h-9 border-0 bg-slate-50 dark:bg-slate-800/50 focus-visible:ring-[#4bee2b]"
        />
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Total Sales Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg shadow-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                {data.salesCount} orders
              </Badge>
            </div>
            <p className="text-blue-100 text-sm font-medium mb-1">Total Sales (Revenue)</p>
            <p className="text-2xl font-black text-white">{formatPrice(data.totalSales)}</p>
          </CardContent>
        </Card>

        {/* Total Cost Card */}
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg shadow-orange-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-orange-100 text-sm font-medium mb-1">Total Cost</p>
            <p className="text-2xl font-black text-white">{formatPrice(data.totalCost)}</p>
          </CardContent>
        </Card>

        {/* Total Profit Card */}
        <Card className="bg-gradient-to-br from-[#4bee2b] to-[#3bd522] border-0 shadow-lg shadow-[#4bee2b]/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#101b0d]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#101b0d]" />
              </div>
              <div className="flex items-center gap-1 text-[#101b0d]/80">
                {isPositiveMargin ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                <span className="text-sm font-bold">{formatPercent(data.profitMargin)}</span>
              </div>
            </div>
            <p className="text-[#101b0d]/70 text-sm font-medium mb-1">Total Profit</p>
            <p className="text-2xl font-black text-[#101b0d]">{formatPrice(data.totalProfit)}</p>
          </CardContent>
        </Card>

        {/* Low Stock Alerts Card */}
        <Card className={`border ${data.lowStockItems.length > 0 ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]'}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.lowStockItems.length > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <AlertCircle className={`w-5 h-5 ${data.lowStockItems.length > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
              </div>
              {data.lowStockItems.length > 0 && (
                <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">
                  Action needed
                </Badge>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Low Stock</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{data.lowStockItems.length}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Items need restocking</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section - Two Columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Top Selling Items</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Best performers today</p>
              </div>
              <Link href="/admin/profit">
                <Button variant="ghost" size="sm" className="text-[#4bee2b] hover:text-[#4bee2b] hover:bg-[#4bee2b]/10">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="p-3">
              {data.topItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No sales today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.topItems.map((item, index) => {
                    const itemProfitMargin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                    const avgSellPrice = item.quantity_sold > 0 ? item.total_sales / item.quantity_sold : 0;
                    const avgCost = item.quantity_sold > 0 ? item.total_cost / item.quantity_sold : 0;
                    const avgProfit = item.quantity_sold > 0 ? item.total_profit / item.quantity_sold : 0;
                    
                    return (
                      <div
                        key={item.item_id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors space-y-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#4bee2b]/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-[#4bee2b]">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{item.item_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {item.quantity_sold.toFixed(1)} units sold
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#4bee2b]">{formatPrice(item.total_sales)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Sales</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Cost</p>
                            <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                              {formatPrice(item.total_cost)}
                            </p>
                            <p className="text-xs text-slate-400">Avg: {formatPrice(avgCost)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Profit</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                              {formatPrice(item.total_profit)}
                            </p>
                            <p className="text-xs text-slate-400">Avg: {formatPrice(avgProfit)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Margin</p>
                            <p className={`text-sm font-semibold ${itemProfitMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {itemProfitMargin.toFixed(1)}%
                            </p>
                            <p className="text-xs text-slate-400">Per unit: {formatPrice(avgSellPrice)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Low Stock Alerts</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Items needing attention</p>
              </div>
              <Link href="/admin/stock">
                <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                  Manage Stock
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="p-3">
              {data.lowStockItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 mx-auto bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center mb-3">
                    <Package className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">All items well stocked!</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No restocking needed</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Stock: {item.current_stock.toFixed(1)} (Min: {item.min_stock_level.toFixed(1)})
                        </p>
                      </div>
                      <Badge variant="destructive" className="bg-red-500">
                        Low
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
