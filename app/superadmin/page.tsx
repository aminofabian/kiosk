'use client';

import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/layouts/superadmin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

interface PlatformStats {
  platform: {
    total_businesses: number;
    active_businesses: number;
    total_users: number;
    total_sales: number;
    total_revenue: number;
  };
  today: {
    sales_count: number;
    revenue: number;
  };
  monthly: {
    sales_count: number;
    revenue: number;
    new_businesses: number;
  };
  topBusinesses: Array<{
    id: string;
    name: string;
    revenue: number;
    sales_count: number;
  }>;
  recentBusinesses: Array<{
    id: string;
    name: string;
    created_at: number;
    user_count: number;
  }>;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/superadmin/stats');
        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        } else {
          setError(result.message || 'Failed to load stats');
        }
      } catch {
        setError('Failed to load stats');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SuperAdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Platform Dashboard</h1>
          <p className="text-slate-400">Overview of all kiosks and platform performance</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : stats && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-violet-600 to-purple-700 border-0 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-violet-100 text-sm font-medium">Active Kiosks</p>
                      <p className="text-4xl font-bold mt-2">{stats.platform.active_businesses}</p>
                      <p className="text-violet-200 text-sm mt-1">
                        of {stats.platform.total_businesses} total
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Building2 className="w-7 h-7" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Total Users</p>
                      <p className="text-4xl font-bold text-white mt-2">{stats.platform.total_users}</p>
                      <p className="text-slate-500 text-sm mt-1">across all kiosks</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                      <Users className="w-7 h-7 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Today&apos;s Revenue</p>
                      <p className="text-3xl font-bold text-emerald-400 mt-2">
                        {formatCurrency(stats.today.revenue)}
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {stats.today.sales_count} sales
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <DollarSign className="w-7 h-7 text-emerald-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Monthly Revenue</p>
                      <p className="text-3xl font-bold text-amber-400 mt-2">
                        {formatCurrency(stats.monthly.revenue)}
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {stats.monthly.sales_count} sales
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performing Kiosks */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-white text-lg">Top Performing Kiosks</CardTitle>
                  <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                    Last 30 days
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.topBusinesses.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No data available</p>
                    ) : (
                      stats.topBusinesses.map((business, index) => (
                        <Link
                          key={business.id}
                          href={`/superadmin/businesses/${business.id}`}
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-700/50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{business.name}</p>
                            <p className="text-sm text-slate-400">
                              {business.sales_count} sales
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-emerald-400">
                              {formatCurrency(business.revenue)}
                            </p>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Kiosks */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-white text-lg">Recent Kiosks</CardTitle>
                  <Link href="/superadmin/businesses" className="text-violet-400 text-sm hover:underline">
                    View all
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.recentBusinesses.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No kiosks yet</p>
                    ) : (
                      stats.recentBusinesses.map((business) => (
                        <Link
                          key={business.id}
                          href={`/superadmin/businesses/${business.id}`}
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-700/50 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold">
                            {business.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{business.name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Calendar className="w-3 h-3" />
                              {formatDate(business.created_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="border-slate-600 text-slate-300">
                              {business.user_count} users
                            </Badge>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Platform Summary */}
            <Card className="bg-slate-800 border-slate-700 mt-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Total Revenue (All Time)</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {formatCurrency(stats.platform.total_revenue)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Total Sales (All Time)</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {stats.platform.total_sales.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">New Kiosks (30 days)</p>
                    <p className="text-2xl font-bold text-violet-400 mt-1">
                      +{stats.monthly.new_businesses}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Avg Revenue/Kiosk</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                      {stats.platform.active_businesses > 0
                        ? formatCurrency(stats.monthly.revenue / stats.platform.active_businesses)
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
