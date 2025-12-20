'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Package,
  Users,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';

interface ProfitData {
  totalProfit: number;
  totalSales: number;
  totalCost: number;
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
  }>;
}

type DatePreset = 'today' | 'week' | 'month' | 'custom';

export function ProfitView() {
  const [profitData, setProfitData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    updateDateRangeFromPreset(datePreset);
  }, [datePreset]);

  useEffect(() => {
    fetchProfitData();
  }, [dateRange]);

  function updateDateRangeFromPreset(preset: DatePreset) {
    const today = new Date();
    const start = new Date();

    switch (preset) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setDate(1);
        break;
      case 'custom':
        return;
    }

    setDateRange({
      start: start.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    });
  }

  async function fetchProfitData() {
    try {
      setLoading(true);
      setError(null);
      const startTimestamp = Math.floor(
        new Date(dateRange.start).getTime() / 1000
      );
      const endTimestamp = Math.floor(
        new Date(dateRange.end + 'T23:59:59').getTime() / 1000
      );

      const response = await fetch(
        `/api/profit?start=${startTimestamp}&end=${endTimestamp}`
      );
      const result = await response.json();

      if (result.success) {
        setProfitData(result.data);
      } else {
        setError(result.message || 'Failed to load profit data');
      }
    } catch (err) {
      setError('Failed to load profit data');
      console.error('Error fetching profit:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#4bee2b]/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-[#4bee2b] animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading profit data...</p>
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
          <Button onClick={fetchProfitData} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!profitData) {
    return null;
  }

  const topItems = profitData.itemProfits
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 5);

  const lowProfitItems = profitData.itemProfits
    .filter((item) => {
      const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
      return item.total_profit < 0 || margin < 5;
    })
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Date Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-[#1c2e18] rounded-xl p-1 border border-slate-200 dark:border-slate-800">
          {(['today', 'week', 'month', 'custom'] as DatePreset[]).map((preset) => (
            <Button
              key={preset}
              variant={datePreset === preset ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setDatePreset(preset)}
              className={`h-9 px-4 capitalize ${
                datePreset === preset
                  ? 'bg-[#4bee2b] text-[#101b0d] hover:bg-[#45d827] shadow-md shadow-[#4bee2b]/20'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {preset}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-[#1c2e18] rounded-xl p-2 border border-slate-200 dark:border-slate-800">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="h-9 w-36 text-sm border-0 bg-slate-50 dark:bg-slate-800/50"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="h-9 w-36 text-sm border-0 bg-slate-50 dark:bg-slate-800/50"
              />
            </div>
          )}
          <Button
            onClick={() => console.log('Export CSV')}
            variant="outline"
            className="border-slate-200 dark:border-slate-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profit Card */}
        <Card className="bg-gradient-to-br from-[#4bee2b] to-[#3bd522] border-0 shadow-lg shadow-[#4bee2b]/20 col-span-2 lg:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#101b0d]/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#101b0d]" />
              </div>
              <Badge className="bg-[#101b0d]/10 text-[#101b0d] border-0">
                {formatPercent(profitData.profitMargin)} margin
              </Badge>
            </div>
            <p className="text-[#101b0d]/70 text-sm font-medium mb-1">Total Profit</p>
            <p className="text-3xl font-black text-[#101b0d]">{formatPrice(profitData.totalProfit)}</p>
          </CardContent>
        </Card>

        {/* Revenue Card */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Revenue</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(profitData.totalSales)}</p>
          </CardContent>
        </Card>

        {/* Cost Card */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-500" />
              </div>
              <ArrowDownRight className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Cost</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(profitData.totalCost)}</p>
          </CardContent>
        </Card>

        {/* Customers Card */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Customers</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{profitData.totalCustomers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Items Sold', value: profitData.totalQuantitySold.toLocaleString(), icon: Package, color: 'slate' },
          { label: 'Transactions', value: profitData.totalTransactions.toLocaleString(), icon: BarChart3, color: 'slate' },
          { label: 'Unique Items', value: profitData.uniqueItemsSold.toString(), icon: Package, color: 'slate' },
          { label: 'Credit Customers', value: profitData.creditCustomers.toString(), icon: Users, color: 'slate' },
          { label: 'Repeat Customers', value: profitData.repeatCustomers.toString(), icon: TrendingUp, color: 'slate' },
          { label: 'New Customers', value: profitData.newCustomers.toString(), icon: Users, color: 'slate' },
        ].map((stat, index) => (
          <Card key={index} className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <stat.icon className="w-4 h-4 text-slate-400 mb-2" />
              <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top & Low Profit Items */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Top Profit Items</h3>
            </div>
            <div className="p-4">
              {topItems.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">No items yet</p>
              ) : (
                <div className="space-y-3">
                  {topItems.map((item, index) => {
                    const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                    return (
                      <div
                        key={item.item_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{item.item_name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.quantity_sold.toFixed(0)} sold • {margin.toFixed(1)}% margin
                          </p>
                        </div>
                        <p className="font-bold text-green-600 dark:text-green-400">
                          +{formatPrice(item.total_profit)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Profit Items */}
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Low / Negative Profit</h3>
            </div>
            <div className="p-4">
              {lowProfitItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-green-600 dark:text-green-400 font-medium">All items profitable!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowProfitItems.map((item) => {
                    const margin = item.total_sales > 0 ? (item.total_profit / item.total_sales) * 100 : 0;
                    const isNegative = item.total_profit < 0;
                    const bgColor = isNegative
                      ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20';
                    const textColor = isNegative
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-orange-600 dark:text-orange-400';

                    return (
                      <div
                        key={item.item_id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${bgColor}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isNegative ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                          <AlertCircle className={`w-4 h-4 ${textColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{item.item_name}</p>
                          <p className={`text-xs ${textColor}`}>
                            {isNegative ? 'Loss / Waste' : `${margin.toFixed(1)}% margin`}
                          </p>
                        </div>
                        <p className={`font-bold ${textColor}`}>
                          {isNegative ? '-' : '+'}{formatPrice(Math.abs(item.total_profit))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Items Table */}
      <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">All Items Performance</h3>
            <Badge variant="outline" className="border-slate-200 dark:border-slate-700">
              {profitData.itemProfits.length} items
            </Badge>
          </div>
          {profitData.itemProfits.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No sales in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                    <th className="text-left p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Item</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Sales</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Cost</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Qty</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Profit</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {profitData.itemProfits
                    .sort((a, b) => b.total_profit - a.total_profit)
                    .map((item) => {
                      const itemMargin = item.total_sales > 0 ? item.total_profit / item.total_sales : 0;
                      const isPositive = item.total_profit >= 0;

                      return (
                        <tr
                          key={item.item_id}
                          className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isPositive ? (
                                <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-slate-900 dark:text-white">{item.item_name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right text-slate-600 dark:text-slate-300">
                            {formatPrice(item.total_sales)}
                          </td>
                          <td className="p-4 text-right text-slate-500 dark:text-slate-400">
                            {formatPrice(item.total_cost)}
                          </td>
                          <td className="p-4 text-right text-slate-500 dark:text-slate-400">
                            {item.quantity_sold.toFixed(1)}
                          </td>
                          <td className={`p-4 text-right font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {formatPrice(item.total_profit)}
                          </td>
                          <td className="p-4 text-right">
                            <Badge
                              className={isPositive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }
                            >
                              {formatPercent(itemMargin)}
                            </Badge>
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
    </div>
  );
}
