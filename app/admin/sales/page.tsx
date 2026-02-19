'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Package,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Wallet,
  Smartphone,
  CreditCard,
  DollarSign,
  Leaf,
  Store,
} from 'lucide-react';
import { apiFetch } from '@/lib/utils/api-client';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import Link from 'next/link';

interface TypeBreakdown {
  item_type: string;
  transaction_count: number;
  items_sold: number;
  revenue: number;
  cost: number;
  profit: number;
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

interface SalesOverviewData {
  summary: SalesSummary;
  salesByPaymentMethod: { payment_method: string; count: number; total: number }[];
  salesByItemType: TypeBreakdown[];
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

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatNumber = (num: number) =>
  num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export default function SalesHubPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [data, setData] = useState<SalesOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<SalesOverviewData>('/api/sales/analytics?period=today', { cache: 'no-store' });
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load data');
      }
    } catch {
      setError('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Do not fetch analytics for cashiers – summaries are admin/owner only
    if (!user || user.role === 'cashier') return;
    fetchData();
  }, [fetchData, user]);

  // If user is a cashier, hide summaries entirely
  if (user && user.role === 'cashier') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-slate-700 dark:text-slate-200 font-semibold">
              Sales summaries are only available to admins and owners.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading || userLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
            <p className="text-slate-500 dark:text-slate-400">Loading sales overview...</p>
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

  const groceryData = data.salesByItemType?.find(t => t.item_type === 'grocery');
  const retailData = data.salesByItemType?.find(t => t.item_type === 'retail');

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#1c6a1e] flex items-center justify-center rounded-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    Sales Overview
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Today&apos;s snapshot across all departments
                  </p>
                </div>
              </div>
              <Button onClick={fetchData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-5xl mx-auto space-y-6">
          {/* Today's Overall Stats */}
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
                <p className="text-xl font-black text-white">{formatPrice(data.summary.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-white/80" />
                  <Badge className="bg-white/20 text-white border-0 text-[10px]">
                    {data.summary.profitMargin.toFixed(1)}% margin
                  </Badge>
                </div>
                <p className="text-green-100 text-xs font-medium mb-1">Total Profit</p>
                <p className="text-xl font-black text-white">{formatPrice(data.summary.totalProfit)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <Package className="w-5 h-5 text-white/80 mb-2" />
                <p className="text-purple-100 text-xs font-medium mb-1">Items Sold</p>
                <p className="text-xl font-black text-white">{formatNumber(data.summary.totalItemsSold)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
              <CardContent className="p-4">
                <AlertTriangle className="w-5 h-5 text-white/80 mb-2" />
                <p className="text-orange-100 text-xs font-medium mb-1">Stock Alerts</p>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xl font-black text-white">{data.summary.outOfStockCount}</p>
                    <p className="text-[10px] text-orange-100">Out</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <p className="text-xl font-black text-white">{data.summary.lowStockCount}</p>
                    <p className="text-[10px] text-orange-100">Low</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Cards - Links to Grocery and Retail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Grocery Card */}
            <Link href="/admin/sales/grocery" className="block group">
              <Card className="border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all hover:shadow-xl hover:shadow-green-500/10 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                      <Leaf className="w-7 h-7 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Grocery Sales</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Daily breakdowns, product performance, category insights
                  </p>
                  {groceryData ? (
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Revenue</p>
                        <p className="text-lg font-black text-green-600">{formatPrice(groceryData.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Profit</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatPrice(groceryData.profit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Items</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatNumber(groceryData.items_sold)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-400">No grocery sales today</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Retail Card */}
            <Link href="/admin/sales/retail" className="block group">
              <Card className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:shadow-xl hover:shadow-blue-500/10 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Store className="w-7 h-7 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">Retail Sales</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Product analytics, stock levels, performance tracking
                  </p>
                  {retailData ? (
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Revenue</p>
                        <p className="text-lg font-black text-blue-600">{formatPrice(retailData.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Profit</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatPrice(retailData.profit)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Items</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-300">{formatNumber(retailData.items_sold)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-400">No retail sales today</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Payment Methods Breakdown */}
          {data.salesByPaymentMethod.length > 0 && (
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#1c6a1e]" />
                  Sales by Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {data.salesByPaymentMethod.map((pm) => {
                    const Icon = PAYMENT_METHOD_ICONS[pm.payment_method] || Wallet;
                    return (
                      <div key={pm.payment_method} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-[#1c6a1e]" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {PAYMENT_METHOD_LABELS[pm.payment_method] || pm.payment_method}
                          </span>
                        </div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatPrice(pm.total)}</p>
                        <p className="text-xs text-slate-500">{pm.count} transactions</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Department Comparison */}
          {data.salesByItemType && data.salesByItemType.length > 0 && (
            <Card className="border-2 border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#1c6a1e]" />
                  Department Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const totalRevenue = data.salesByItemType.reduce((sum, t) => sum + t.revenue, 0);
                  return (
                    <div className="space-y-4">
                      {data.salesByItemType.map((type) => {
                        const pct = totalRevenue > 0 ? (type.revenue / totalRevenue) * 100 : 0;
                        const isGrocery = type.item_type === 'grocery';
                        return (
                          <div key={type.item_type} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isGrocery ? (
                                  <Leaf className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Store className="w-4 h-4 text-blue-500" />
                                )}
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-300 capitalize">
                                  {type.item_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="font-black text-slate-900 dark:text-white">{formatPrice(type.revenue)}</span>
                                <span className="text-slate-400">{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                                  isGrocery
                                    ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                                    : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex gap-6 text-xs text-slate-500">
                              <span>Profit: {formatPrice(type.profit)}</span>
                              <span>{formatNumber(type.items_sold)} items</span>
                              <span>{type.transaction_count} orders</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
