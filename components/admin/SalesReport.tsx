'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { 
  Package, Loader2, X, TrendingUp, TrendingDown, 
  DollarSign, ShoppingCart, Users, Clock, 
  Download, Search, BarChart3, PieChart, 
  Award, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import type { PaymentMethod } from '@/lib/constants';

interface Sale {
  id: string;
  sale_date: number;
  total_amount: number;
  payment_method: PaymentMethod;
  customer_name: string | null;
  user_name: string | null;
  items_count: number;
}

interface SaleItem {
  id: string;
  item_name: string;
  item_unit_type: string;
  quantity_sold: number;
  sell_price_per_unit: number;
  buy_price_per_unit: number;
  profit: number;
}

interface SaleDetails {
  sale: Sale;
  items: SaleItem[];
}

export function SalesReport() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetails | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate, paymentMethod]);

  async function fetchSales() {
    try {
      setLoading(true);
      const startTimestamp = Math.floor(
        new Date(startDate).getTime() / 1000
      );
      const endTimestamp = Math.floor(
        new Date(endDate + 'T23:59:59').getTime() / 1000
      );

      const params = new URLSearchParams({
        start: startTimestamp.toString(),
        end: endTimestamp.toString(),
      });

      if (paymentMethod !== 'all') {
        params.append('paymentMethod', paymentMethod);
      }

      const response = await fetch(`/api/reports/sales?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSales(result.data);
      } else {
        setError(result.message || 'Failed to load sales');
      }
    } catch (err) {
      setError('Failed to load sales');
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentBadgeVariant = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return 'default';
      case 'mpesa':
        return 'secondary';
      case 'credit':
        return 'outline';
      default:
        return 'default';
    }
  };

  function applyQuickFilter(filter: 'today' | '3days' | '1week') {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endDateStr = today.toISOString().split('T')[0];
    
    let startDate: Date;
    
    switch (filter) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case '3days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 2); // 3 days including today
        startDate.setHours(0, 0, 0, 0);
        break;
      case '1week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 6); // 7 days including today
        startDate.setHours(0, 0, 0, 0);
        break;
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    setStartDate(startDateStr);
    setEndDate(endDateStr);
    setActiveFilter(filter);
  }

  async function handleSaleClick(sale: Sale) {
    try {
      setLoadingItems(true);
      setDrawerOpen(true);
      
      const response = await fetch(`/api/sales/${sale.id}`);
      const result = await response.json();

      if (result.success) {
        setSelectedSale(result.data);
      } else {
        setError(result.message || 'Failed to load sale details');
        setDrawerOpen(false);
      }
    } catch (err) {
      setError('Failed to load sale details');
      console.error('Error fetching sale details:', err);
      setDrawerOpen(false);
    } finally {
      setLoadingItems(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading sales...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-destructive font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalItems = sales.reduce((sum, sale) => sum + sale.items_count, 0);
  const averageSale = sales.length > 0 ? totalSales / sales.length : 0;
  
  // Payment method breakdown
  const paymentBreakdown = sales.reduce((acc, sale) => {
    acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total_amount;
    return acc;
  }, {} as Record<PaymentMethod, number>);
  
  // Top cashiers
  const cashierStats = sales.reduce((acc, sale) => {
    const name = sale.user_name || 'Unknown';
    if (!acc[name]) {
      acc[name] = { name, count: 0, total: 0 };
    }
    acc[name].count++;
    acc[name].total += sale.total_amount;
    return acc;
  }, {} as Record<string, { name: string; count: number; total: number }>);
  const topCashiers = Object.values(cashierStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  
  // Daily sales breakdown
  const dailySales = sales.reduce((acc, sale) => {
    const date = new Date(sale.sale_date * 1000).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { date, total: 0, count: 0 };
    }
    acc[date].total += sale.total_amount;
    acc[date].count++;
    return acc;
  }, {} as Record<string, { date: string; total: number; count: number }>);
  const dailySalesArray = Object.values(dailySales).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const maxDailySales = Math.max(...dailySalesArray.map(d => d.total), 1);
  
  // Filter sales based on search
  const filteredSales = sales.filter(sale => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (sale.customer_name?.toLowerCase().includes(query)) ||
      (sale.user_name?.toLowerCase().includes(query)) ||
      sale.id.toLowerCase().includes(query)
    );
  });
  
  // Export to CSV
  function exportToCSV() {
    const headers = ['Date', 'Sale ID', 'Cashier', 'Customer', 'Items', 'Payment Method', 'Total Amount'];
    const rows = filteredSales.map(sale => [
      formatDate(sale.sale_date),
      sale.id,
      sale.user_name || 'Unknown',
      sale.customer_name || 'Walk-in',
      sale.items_count.toString(),
      sale.payment_method,
      sale.total_amount.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      {/* Filters - Compact */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
        <CardContent className="p-2.5">
          <div className="space-y-2">
            {/* Quick Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Quick:</span>
              <Button
                variant={activeFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('today')}
                className={`h-7 px-2 text-xs ${activeFilter === 'today' 
                  ? 'bg-[#259783] hover:bg-[#45d827] text-white' 
                  : 'border-slate-300 dark:border-slate-700'}`}
              >
                Today
              </Button>
              <Button
                variant={activeFilter === '3days' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('3days')}
                className={`h-7 px-2 text-xs ${activeFilter === '3days' 
                  ? 'bg-[#259783] hover:bg-[#45d827] text-white' 
                  : 'border-slate-300 dark:border-slate-700'}`}
              >
                3 Days
              </Button>
              <Button
                variant={activeFilter === '1week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyQuickFilter('1week')}
                className={`h-7 px-2 text-xs ${activeFilter === '1week' 
                  ? 'bg-[#259783] hover:bg-[#45d827] text-white' 
                  : 'border-slate-300 dark:border-slate-700'}`}
              >
                1 Week
              </Button>
            </div>
            
            {/* Date & Payment Filters */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="space-y-0.5">
                <Label htmlFor="start" className="text-[10px]">Start Date</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveFilter(null);
                  }}
                  className="focus-visible:ring-[#259783] text-xs h-8"
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="end" className="text-[10px]">End Date</Label>
                <Input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveFilter(null);
                  }}
                  className="focus-visible:ring-[#259783] text-xs h-8"
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="method" className="text-[10px]">Payment</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Search</Label>
                <div className="relative">
                  <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input
                    placeholder="Customer, cashier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 text-xs h-8 focus-visible:ring-[#259783]"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-1.5 w-full">
                  <Button 
                    onClick={fetchSales} 
                    size="sm"
                    className="flex-1 h-8 bg-[#259783] hover:bg-[#45d827] text-white font-semibold text-xs px-2"
                  >
                    Apply
                  </Button>
                  {filteredSales.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToCSV}
                      className="h-8 w-8 p-0 border-slate-300 dark:border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-gradient-to-br from-[#259783] to-[#45d827] border-0 shadow-md shadow-[#259783]/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/80 font-medium mb-0.5">Total Sales</p>
                <p className="text-base font-black text-white truncate">{formatPrice(totalSales)}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 ml-2">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mb-0.5">Transactions</p>
                <p className="text-base font-black text-slate-900 dark:text-white">{sales.length}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Avg: {formatPrice(averageSale)}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#259783]/10 flex items-center justify-center flex-shrink-0 ml-2">
                <ShoppingCart className="w-4 h-4 text-[#259783]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mb-0.5">Items Sold</p>
                <p className="text-base font-black text-slate-900 dark:text-white">{totalItems}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {sales.length > 0 ? (totalItems / sales.length).toFixed(1) : 0}/sale
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 ml-2">
                <Package className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mb-0.5">Cashiers</p>
                <p className="text-base font-black text-slate-900 dark:text-white">{Object.keys(cashierStats).length}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Active</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 ml-2">
                <Users className="w-4 h-4 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Insights - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Daily Sales Chart */}
        {dailySalesArray.length > 0 && (
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18] lg:col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-[#259783]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Daily Sales Trend</h3>
              </div>
              <div className="flex items-end gap-1.5 h-24">
                {dailySalesArray.map((day) => {
                  const heightPercent = (day.total / maxDailySales) * 100;
                  const date = new Date(day.date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5 group">
                      <div className="relative w-full flex flex-col items-end justify-end h-full">
                        <div
                          className={`w-full rounded-t transition-all ${
                            isToday 
                              ? 'bg-gradient-to-t from-[#259783] to-[#45d827]' 
                              : 'bg-gradient-to-t from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500'
                          }`}
                          style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        >
                          <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                            {formatPrice(day.total)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">
                        {date.getDate()}/{date.getMonth() + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Method Breakdown - Compact */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-[#259783]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Methods</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(paymentBreakdown).map(([method, amount]) => {
                const percentage = (amount / totalSales) * 100;
                const colors: Record<string, string> = {
                  cash: 'bg-blue-500',
                  mpesa: 'bg-emerald-500',
                  credit: 'bg-orange-500',
                  split: 'bg-purple-500',
                };
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${colors[method] || 'bg-slate-400'}`} />
                        <span className="font-medium text-slate-900 dark:text-white capitalize text-xs">{method}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">{formatPrice(amount)}</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-1.5">{percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[method] || 'bg-slate-400'} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Cashiers - Compact */}
      {topCashiers.length > 0 && (
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-[#259783]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Cashiers</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {topCashiers.map((cashier, index) => (
                <div
                  key={cashier.name}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-slate-400 text-white' :
                      index === 2 ? 'bg-orange-500 text-white' :
                      'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      {cashier.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mb-0.5">
                    {cashier.count} sales
                  </p>
                  <p className="text-xs font-bold text-[#259783]">
                    {formatPrice(cashier.total)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Table */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18] overflow-hidden">
        <CardContent className="p-0">
          {sales.length === 0 ? (
            <div className="p-6 text-center">
              <ShoppingCart className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">No sales found for this period</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Try adjusting your date range or filters</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-6 text-center">
              <Search className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">No sales match your search</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Try a different search term</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredSales.length}</span> of <span className="font-semibold text-slate-900 dark:text-white">{sales.length}</span> sales
                </p>
              </div>
              <table className="w-full">
                <thead className="bg-[#259783]">
                  <tr>
                    <th className="text-left p-2.5 text-xs font-semibold text-white">Date</th>
                    <th className="text-left p-2.5 text-xs font-semibold text-white">Cashier</th>
                    <th className="text-left p-2.5 text-xs font-semibold text-white">Items</th>
                    <th className="text-left p-2.5 text-xs font-semibold text-white">Customer</th>
                    <th className="text-left p-2.5 text-xs font-semibold text-white">Payment</th>
                    <th className="text-right p-2.5 text-xs font-semibold text-white">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => handleSaleClick(sale)}
                      className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="p-2.5 text-xs text-slate-900 dark:text-slate-100">{formatDate(sale.sale_date)}</td>
                      <td className="p-2.5 text-xs text-slate-900 dark:text-slate-100">
                        {sale.user_name || 'Unknown'}
                      </td>
                      <td className="p-2.5 text-xs text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-[#259783]" />
                          <span className="font-medium">{sale.items_count}</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-xs text-slate-900 dark:text-slate-100">
                        {sale.customer_name || (
                          <span className="text-slate-500 dark:text-slate-400">Walk-in</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <Badge variant={getPaymentBadgeVariant(sale.payment_method)} className="text-[10px] px-1.5 py-0.5">
                          {sale.payment_method}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-right font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {formatPrice(sale.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Items Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="left">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20">
            <div className="flex items-center justify-between pr-8">
              <div>
                <DrawerTitle className="text-xs font-bold text-slate-900 dark:text-white">
                  Sale Items
                </DrawerTitle>
                {selectedSale && (
                  <DrawerDescription className="mt-1 text-[10px] text-slate-600 dark:text-slate-400">
                    {formatDate(selectedSale.sale.sale_date)} • {formatPrice(selectedSale.sale.total_amount)}
                  </DrawerDescription>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 absolute top-4 right-4"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>
          
          <div className="overflow-y-auto p-3 bg-slate-50/50 dark:bg-slate-900/50 flex-1">
            {loadingItems ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#259783]" />
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Loading items...</p>
                </div>
              </div>
            ) : selectedSale && selectedSale.items.length > 0 ? (
              <div className="space-y-2">
                {selectedSale.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-5 h-5 rounded bg-[#259783]/10 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-[#259783]">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-white text-[10px] mb-0.5">
                            {item.item_name}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400">
                            <span className="font-medium">
                              {item.quantity_sold.toFixed(2)} {item.item_unit_type}
                            </span>
                            <span>×</span>
                            <span>{formatPrice(item.sell_price_per_unit)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-slate-900 dark:text-white text-[10px]">
                          {formatPrice(item.quantity_sold * item.sell_price_per_unit)}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Profit: <span className={item.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                            {formatPrice(item.profit)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Summary */}
                {selectedSale && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-600 dark:text-slate-400">Total Items:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedSale.items.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-600 dark:text-slate-400">Total Quantity:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedSale.items.reduce((sum, item) => sum + item.quantity_sold, 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white">Total Amount:</span>
                        <span className="font-black text-[#259783] text-[10px]">
                          {formatPrice(selectedSale.sale.total_amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-slate-600 dark:text-slate-400">Total Profit:</span>
                        <span className={`font-semibold text-[10px] ${
                          selectedSale.items.reduce((sum, item) => sum + item.profit, 0) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatPrice(selectedSale.items.reduce((sum, item) => sum + item.profit, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                  <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">No items found</p>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

