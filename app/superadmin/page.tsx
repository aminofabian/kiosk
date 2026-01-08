'use client';

import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/layouts/superadmin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Loader2,
  ArrowUpRight,
  TrendingDown,
  Activity,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

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

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  trend?: { value: string; positive: boolean };
  variant?: 'default' | 'primary';
  className?: string;
}) => (
  <Card className={cn(
    "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group",
    variant === 'primary'
      ? "bg-gradient-to-br from-violet-600 to-indigo-700 border-0 text-white shadow-lg shadow-violet-500/20"
      : "bg-slate-900/50 backdrop-blur-sm border-slate-800/50 hover:bg-slate-800/50",
    className
  )}>
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            variant === 'primary' ? "text-violet-100" : "text-slate-400"
          )}>{title}</p>
          <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-xs",
              variant === 'primary' ? "text-violet-200" : "text-slate-500"
            )}>{subtitle}</p>
            {trend && (
              <span className={cn(
                "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                trend.positive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              )}>
                {trend.positive ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                {trend.value}
              </span>
            )}
          </div>
        </div>
        <div className={cn(
          "p-3 rounded-2xl transition-transform duration-300 group-hover:rotate-12",
          variant === 'primary'
            ? "bg-white/20"
            : "bg-slate-800 border border-slate-700/50"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            variant === 'primary' ? "text-white" : "text-violet-400"
          )} />
        </div>
      </div>

      {/* Decorative background element */}
      <div className={cn(
        "absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10",
        variant === 'primary' ? "bg-white" : "bg-violet-500"
      )} />
    </CardContent>
  </Card>
);

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
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
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">{session?.user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-400 font-medium">Here&apos;s a quick overview of your platform performance.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">System Status</span>
              <span className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
              <div className="absolute inset-0 blur-xl bg-violet-500/20 animate-pulse" />
            </div>
            <p className="text-slate-400 font-medium animate-pulse">Syncing platform data...</p>
          </div>
        ) : error ? (
          <Card className="bg-red-500/5 border-red-500/20 py-12 text-center">
            <p className="text-red-400 font-medium">{error}</p>
            <Button variant="outline" className="mt-4 border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        ) : stats && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <StatCard
                title="Active Kiosks"
                value={stats.platform.active_businesses}
                subtitle={`of ${stats.platform.total_businesses} total`}
                icon={Building2}
                variant="primary"
              />
              <StatCard
                title="Total Users"
                value={stats.platform.total_users.toLocaleString()}
                subtitle="Across all kiosks"
                icon={Users}
              />
              <StatCard
                title="Today's Revenue"
                value={formatCurrency(stats.today.revenue)}
                subtitle={`${stats.today.sales_count} sales today`}
                icon={DollarSign}
                trend={{ value: "+12.5%", positive: true }}
              />
              <StatCard
                title="Monthly Revenue"
                value={formatCurrency(stats.monthly.revenue)}
                subtitle={`${stats.monthly.sales_count} sales this month`}
                icon={TrendingUp}
                trend={{ value: "+8.2%", positive: true }}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
              {/* Top Performing Kiosks */}
              <Card className="lg:col-span-7 bg-slate-900/50 backdrop-blur-sm border-slate-800/50">
                <CardHeader className="flex flex-row items-center justify-between pb-6">
                  <div>
                    <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      Top Performing Kiosks
                    </CardTitle>
                    <p className="text-slate-500 text-sm mt-1">Highest revenue generation this month</p>
                  </div>
                  <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 font-bold px-3 py-1">
                    Last 30 Days
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.topBusinesses.length === 0 ? (
                      <div className="text-center py-12 space-y-3">
                        <Activity className="w-12 h-12 text-slate-700 mx-auto" />
                        <p className="text-slate-500 font-medium">No performance data yet</p>
                      </div>
                    ) : (
                      stats.topBusinesses.map((business, index) => (
                        <Link
                          key={business.id}
                          href={`/superadmin/businesses/${business.id}`}
                          className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-800/50 transition-all duration-300 group border border-transparent hover:border-slate-700/50"
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-transform duration-300 group-hover:scale-110",
                            index === 0 ? "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30" :
                              index === 1 ? "bg-slate-400/20 text-slate-400 ring-1 ring-slate-400/30" :
                                index === 2 ? "bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/30" :
                                  "bg-slate-800 text-slate-500"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate group-hover:text-violet-400 transition-colors">{business.name}</p>
                            <p className="text-xs font-medium text-slate-500 tracking-wide uppercase mt-0.5">
                              {business.sales_count.toLocaleString()} Total Sales
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-emerald-400">
                              {formatCurrency(business.revenue)}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                              <span className="text-[10px] text-slate-500 font-bold tracking-tighter uppercase">Growing</span>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Kiosks */}
              <Card className="lg:col-span-5 bg-slate-900/50 backdrop-blur-sm border-slate-800/50">
                <CardHeader className="flex flex-row items-center justify-between pb-6">
                  <div>
                    <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-violet-400" />
                      Recent Kiosks
                    </CardTitle>
                    <p className="text-slate-500 text-sm mt-1">Latest business additions</p>
                  </div>
                  <Link href="/superadmin/businesses" className="text-violet-400 text-sm font-bold hover:text-violet-300 transition-colors flex items-center gap-1 group">
                    View all
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recentBusinesses.length === 0 ? (
                      <div className="text-center py-12 space-y-3">
                        <Building2 className="w-12 h-12 text-slate-700 mx-auto" />
                        <p className="text-slate-500 font-medium">No kiosks registered yet</p>
                      </div>
                    ) : (
                      stats.recentBusinesses.map((business) => (
                        <Link
                          key={business.id}
                          href={`/superadmin/businesses/${business.id}`}
                          className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-800/50 transition-all duration-300 group border border-transparent hover:border-slate-700/50"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-black text-lg shadow-inner ring-1 ring-white/10 group-hover:from-violet-600 group-hover:to-indigo-700 transition-all duration-500">
                            {business.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate group-hover:text-violet-400 transition-colors">{business.name}</p>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-1">
                              <Calendar className="w-3 h-3 text-slate-600" />
                              {formatDate(business.created_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="border-slate-800 bg-slate-800/30 text-slate-400 font-bold rounded-lg group-hover:text-violet-400 group-hover:border-violet-500/20 transition-colors">
                              {business.user_count} Users
                            </Badge>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Platform Summary Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-2xl">
              <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
              <div className="relative p-6 sm:p-10 grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
                <div className="space-y-1">
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Total Revenue</p>
                  <p className="text-2xl sm:text-3xl font-black text-white">
                    {formatCurrency(stats.platform.total_revenue)}
                  </p>
                  <div className="w-12 h-1 bg-emerald-500/50 rounded-full" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Lifetime Sales</p>
                  <p className="text-2xl sm:text-3xl font-black text-white">
                    {stats.platform.total_sales.toLocaleString()}
                  </p>
                  <div className="w-12 h-1 bg-blue-500/50 rounded-full" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Monthly Growth</p>
                  <p className="text-2xl sm:text-3xl font-black text-violet-400">
                    +{stats.monthly.new_businesses} Kiosks
                  </p>
                  <div className="w-12 h-1 bg-violet-500/50 rounded-full" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Efficiency Index</p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-400">
                    {stats.platform.active_businesses > 0
                      ? formatCurrency(stats.monthly.revenue / stats.platform.active_businesses)
                      : 'KES 0'}
                  </p>
                  <div className="w-12 h-1 bg-amber-500/50 rounded-full" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
