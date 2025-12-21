'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Clock,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Zap,
  DollarSign,
  CreditCard,
  Smartphone,
  Banknote,
  Package,
  Target,
  BarChart3,
  Lightbulb,
  ArrowLeft,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface HourlyStat {
  hour: number;
  customers: number;
  sales: number;
  profit: number;
  items: number;
}

interface DayOfWeekStat {
  day: number;
  dayName: string;
  customers: number;
  sales: number;
  profit: number;
  items: number;
}

interface CustomerData {
  summary: {
    totalCustomers: number;
    totalSales: number;
    totalProfit: number;
    totalItems: number;
    avgSpend: number;
    avgProfit: number;
    avgItems: number;
    hoursOpen: number;
    avgCustomersPerHour: number;
  };
  hourly: HourlyStat[];
  peakHours: {
    byCustomers: HourlyStat | null;
    bySales: HourlyStat | null;
    byProfit: HourlyStat | null;
    slowest: HourlyStat | null;
  };
  dayOfWeek?: DayOfWeekStat[];
  peakDays?: {
    bySales: DayOfWeekStat | null;
    worst: DayOfWeekStat | null;
  };
  basketDistribution: {
    small: { count: number; percent: number };
    medium: { count: number; percent: number };
    large: { count: number; percent: number };
  };
  paymentDistribution: {
    cash: { count: number; percent: number };
    mpesa: { count: number; percent: number };
    credit: { count: number; percent: number };
  };
  insights: string[];
}

type DatePreset = 'today' | 'week' | 'month';

export default function CustomersPage() {
  const router = useRouter();
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    return { start: todayStart.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
  });

  useEffect(() => { updateDateRangeFromPreset(datePreset); }, [datePreset]);
  useEffect(() => { fetchData(); }, [dateRange]);

  function updateDateRangeFromPreset(preset: DatePreset) {
    const today = new Date();
    const start = new Date();
    if (preset === 'today') start.setHours(0, 0, 0, 0);
    else if (preset === 'week') start.setDate(today.getDate() - 7);
    else start.setDate(1);
    setDateRange({ start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] });
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const startTs = Math.floor(new Date(dateRange.start).getTime() / 1000);
      const endTs = Math.floor(new Date(dateRange.end + 'T23:59:59').getTime() / 1000);
      const response = await fetch(`/api/analytics/customers?start=${startTs}&end=${endTs}`);
      const result = await response.json();
      if (result.success) setData(result.data);
      else setError(result.message || 'Failed to load');
    } catch {
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (n: number) => `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatHour = (h: number) => h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`;
  const getPeriodLabel = () => datePreset === 'today' ? 'Today' : datePreset === 'week' ? 'This Week' : 'This Month';

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-[#259783] animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Analyzing customer data...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium text-sm">{error}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const { summary, hourly, peakHours, dayOfWeek, peakDays, basketDistribution, paymentDistribution, insights } = data;
  const maxCustomers = Math.max(...hourly.map(h => h.customers), 1);
  const maxSales = Math.max(...hourly.map(h => h.sales), 1);
  const maxDaySales = dayOfWeek ? Math.max(...dayOfWeek.map(d => d.sales), 1) : 0;

  return (
    <AdminLayout>
      {/* Desktop View */}
      <div className="hidden md:block p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#259783] flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Customer Analysis</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Traffic patterns & buying behavior</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(['today', 'week', 'month'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${
                  datePreset === preset
                    ? 'bg-[#259783] text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset === 'today' ? 'Today' : preset === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border-2 border-[#259783] bg-[#259783] p-5">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-5 h-5 text-white" />
              <span className="text-white/70 text-[10px] font-bold uppercase">{summary.avgCustomersPerHour.toFixed(1)}/hr</span>
            </div>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-wide mb-1">Customers Served</p>
            <p className="text-3xl font-black text-white">{summary.totalCustomers}</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="w-5 h-5 text-[#259783]" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Avg Spend</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{formatPrice(summary.avgSpend)}</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-5 h-5 text-[#259783]" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Avg Profit/Customer</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{formatPrice(summary.avgProfit)}</p>
          </div>

          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <Package className="w-5 h-5 text-[#259783]" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide mb-1">Items/Customer</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{summary.avgItems.toFixed(1)}</p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard icon={ShoppingBag} label="Total Sales" value={formatPrice(summary.totalSales)} />
          <StatCard icon={TrendingUp} label="Total Profit" value={formatPrice(summary.totalProfit)} />
          <StatCard icon={Package} label="Items Sold" value={summary.totalItems.toLocaleString()} />
          <StatCard icon={Clock} label="Hours Active" value={summary.hoursOpen.toString()} />
          <StatCard icon={Target} label="Traffic Rate" value={summary.avgCustomersPerHour.toFixed(1) + '/hr'} />
        </div>

        {/* Day of Week Analysis - Only for Month/Week */}
        {datePreset !== 'today' && dayOfWeek && dayOfWeek.length > 0 && (
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">Day of Week Analysis</h3>
                    <p className="text-xs text-slate-500">Best and worst performing days</p>
                  </div>
                </div>
                {peakDays?.bySales && (
                  <Badge className="bg-[#259783] text-white border-0">
                    Best: {peakDays.bySales.dayName}
                  </Badge>
                )}
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                  const dayStat = dayOfWeek.find(d => d.day === idx);
                  if (!dayStat) return <div key={idx} className="h-32 border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"></div>;
                  
                  const heightPercent = (dayStat.sales / maxDaySales) * 100;
                  const isBest = peakDays?.bySales?.day === dayStat.day;
                  const isWorst = peakDays?.worst?.day === dayStat.day;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center justify-end h-32 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
                        <div 
                          className={`w-full transition-all ${
                            isBest 
                              ? 'bg-[#259783] border-2 border-[#259783]' 
                              : isWorst
                              ? 'bg-slate-400'
                              : 'bg-[#259783]/70'
                          }`}
                          style={{ height: `${heightPercent}%`, minHeight: dayStat.sales > 0 ? '4px' : '0' }}
                        />
                        {isBest && (
                          <div className="absolute top-1 left-1/2 -translate-x-1/2">
                            <Zap className="w-3 h-3 text-yellow-400" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-bold ${isBest ? 'text-[#259783]' : 'text-slate-600 dark:text-slate-400'}`}>
                          {day}
                        </p>
                        <p className="text-[10px] text-slate-500">{formatPrice(dayStat.sales)}</p>
                        <p className="text-[9px] text-slate-400">{dayStat.customers} customers</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Day Details Table */}
              <div className="border-2 border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Day</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Customers</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Sales</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Profit</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Avg/Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayOfWeek.sort((a, b) => b.sales - a.sales).map((day) => {
                      const avgPerCustomer = day.customers > 0 ? day.sales / day.customers : 0;
                      const isBest = peakDays?.bySales?.day === day.day;
                      const isWorst = peakDays?.worst?.day === day.day;
                      return (
                        <tr 
                          key={day.day} 
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            isBest ? 'bg-[#259783]/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {isBest && <Zap className="w-4 h-4 text-[#259783]" />}
                              {isWorst && <TrendingDown className="w-4 h-4 text-slate-400" />}
                              <span className={`font-bold ${isBest ? 'text-[#259783]' : 'text-slate-900 dark:text-white'}`}>
                                {day.dayName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{day.customers}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatPrice(day.sales)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${day.profit > 0 ? 'text-[#259783]' : 'text-red-500'}`}>
                            {day.profit > 0 ? '+' : ''}{formatPrice(day.profit)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{formatPrice(avgPerCustomer)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Peak Hours & Hourly Chart */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Peak Hours */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">Peak Hours</h3>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {peakHours.bySales && (
                <PeakHourCard 
                  label="Best Sales" 
                  hour={formatHour(peakHours.bySales.hour)} 
                  value={formatPrice(peakHours.bySales.sales)}
                  customers={peakHours.bySales.customers}
                />
              )}
              {peakHours.byCustomers && (
                <PeakHourCard 
                  label="Busiest" 
                  hour={formatHour(peakHours.byCustomers.hour)} 
                  value={`${peakHours.byCustomers.customers} customers`}
                  customers={peakHours.byCustomers.customers}
                />
              )}
              {peakHours.byProfit && (
                <PeakHourCard 
                  label="Most Profitable" 
                  hour={formatHour(peakHours.byProfit.hour)} 
                  value={formatPrice(peakHours.byProfit.profit)}
                  customers={peakHours.byProfit.customers}
                />
              )}
            </div>
          </div>

          {/* Hourly Traffic Chart */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 lg:col-span-2">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Hourly Traffic</h3>
                </div>
                <Badge variant="outline" className="border-slate-300 dark:border-slate-600">
                  {hourly.length} active hours
                </Badge>
              </div>
            </div>
            <div className="p-5">
              {hourly.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-400 text-sm">No traffic data yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-end gap-1 h-40">
                    {hourly.map((h) => {
                      const heightPercent = (h.customers / maxCustomers) * 100;
                      const salesPercent = (h.sales / maxSales) * 30;
                      const isPeak = h.hour === peakHours.byCustomers?.hour;
                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="relative w-full flex flex-col items-center justify-end h-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                            <div 
                              className="w-full bg-slate-300 opacity-40 mb-0.5"
                              style={{ height: `${salesPercent}%`, minHeight: h.sales > 0 ? '2px' : '0' }}
                            />
                            <div 
                              className={`w-full transition-all ${
                                isPeak 
                                  ? 'bg-[#259783] border-2 border-[#259783]' 
                                  : 'bg-[#259783]/80'
                              }`}
                              style={{ height: `${heightPercent}%`, minHeight: h.customers > 0 ? '4px' : '0' }}
                              title={`${formatHour(h.hour)}: ${h.customers} customers, ${formatPrice(h.sales)}`}
                            />
                            {isPeak && (
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                <Zap className="w-3 h-3 text-[#259783]" />
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold ${isPeak ? 'text-[#259783]' : 'text-slate-400'}`}>
                            {h.hour}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-[#259783]"></div>
                      <span>Customers</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-slate-300"></div>
                      <span>Sales Volume</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Basket & Payment Distribution */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Basket Size */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">Basket Size</h3>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <DistributionCard 
                label="Small Spenders" 
                sublabel="< KES 100"
                percent={basketDistribution.small.percent} 
                count={basketDistribution.small.count}
              />
              <DistributionCard 
                label="Medium Spenders" 
                sublabel="KES 100-500"
                percent={basketDistribution.medium.percent} 
                count={basketDistribution.medium.count}
              />
              <DistributionCard 
                label="Big Spenders" 
                sublabel="> KES 500"
                percent={basketDistribution.large.percent} 
                count={basketDistribution.large.count}
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">Payment Methods</h3>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3">
                <PaymentCard icon={Banknote} label="Cash" percent={paymentDistribution.cash.percent} count={paymentDistribution.cash.count} />
                <PaymentCard icon={Smartphone} label="M-Pesa" percent={paymentDistribution.mpesa.percent} count={paymentDistribution.mpesa.count} />
                <PaymentCard icon={CreditCard} label="Credit" percent={paymentDistribution.credit.percent} count={paymentDistribution.credit.count} />
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Key Insights</h3>
                  <p className="text-xs text-slate-500">Actionable intelligence</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid md:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <div 
                    key={i} 
                    className="flex items-start gap-3 p-4 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <div className="w-6 h-6 bg-[#259783] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Lightbulb className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hourly Breakdown Table */}
        {hourly.length > 0 && (
          <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="p-5 border-b-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#259783] flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white">Hourly Breakdown</h3>
                    <p className="text-xs text-slate-500">Detailed performance</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-slate-300 dark:border-slate-600">
                  {hourly.length} hours
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                    <th className="text-left px-6 py-3 font-bold text-slate-700 dark:text-slate-300">Hour</th>
                    <th className="text-right px-6 py-3 font-bold text-slate-700 dark:text-slate-300">Customers</th>
                    <th className="text-right px-6 py-3 font-bold text-slate-700 dark:text-slate-300">Sales</th>
                    <th className="text-right px-6 py-3 font-bold text-slate-700 dark:text-slate-300">Profit</th>
                    <th className="text-right px-6 py-3 font-bold text-slate-700 dark:text-slate-300">Items</th>
                    <th className="text-right px-6 py-3 font-bold text-slate-700 dark:text-slate-300">Avg/Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {hourly.map((h) => {
                    const avgPerCustomer = h.customers > 0 ? h.sales / h.customers : 0;
                    const isProfitable = h.profit > 0;
                    const isPeak = h.hour === peakHours.byCustomers?.hour;
                    return (
                      <tr 
                        key={h.hour} 
                        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          isPeak ? 'bg-[#259783]/5' : ''
                        }`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {isPeak && <Zap className="w-4 h-4 text-[#259783]" />}
                            <span className={`font-bold ${isPeak ? 'text-[#259783]' : 'text-slate-900 dark:text-white'}`}>
                              {formatHour(h.hour)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-900 dark:text-white">{h.customers}</td>
                        <td className="px-6 py-3 text-right text-slate-700 dark:text-slate-300">{formatPrice(h.sales)}</td>
                        <td className={`px-6 py-3 text-right font-bold ${isProfitable ? 'text-[#259783]' : 'text-red-500'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {isProfitable ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {isProfitable ? '+' : ''}{formatPrice(h.profit)}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-400">{h.items}</td>
                        <td className="px-6 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatPrice(avgPerCustomer)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Mobile View */}
      <div className="md:hidden bg-slate-50 dark:bg-[#0f1a0d] min-h-screen pb-24">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg px-4 py-4 border-b-2 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
              <div>
                <h1 className="text-lg font-black text-slate-900 dark:text-white">Customers</h1>
                <p className="text-[10px] text-slate-500">Traffic & behavior</p>
              </div>
            </div>
            <Link href="/admin" className="px-3 py-1.5 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
              Close
            </Link>
          </div>
        </div>

        {/* Date Filter */}
        <div className="px-4 py-4">
          <div className="flex bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-1">
            {(['today', 'week', 'month'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-lg ${
                  datePreset === preset 
                    ? 'bg-[#259783] text-white shadow-md' 
                    : 'text-slate-500'
                }`}
              >
                {preset === 'today' ? 'Today' : preset === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="px-4 pb-4">
          <div className="border-2 border-[#259783] bg-[#259783] p-4 mb-3">
            <p className="text-white/70 text-[10px] uppercase font-bold mb-3">{getPeriodLabel()}&apos;s Story</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/60 text-[10px] uppercase font-bold mb-1">Customers</p>
                <p className="text-3xl font-black text-white">{summary.totalCustomers}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{summary.avgCustomersPerHour.toFixed(1)} per hour</p>
              </div>
              <div>
                <p className="text-white/60 text-[10px] uppercase font-bold mb-1">Avg Spend</p>
                <p className="text-2xl font-black text-white">{formatPrice(summary.avgSpend)}</p>
                <p className="text-white/50 text-[9px] mt-0.5">{formatPrice(summary.avgProfit)} profit</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MobileStatCard icon={ShoppingBag} label="Sales" value={formatPrice(summary.totalSales)} />
            <MobileStatCard icon={TrendingUp} label="Profit" value={formatPrice(summary.totalProfit)} />
            <MobileStatCard icon={Package} label="Items" value={summary.totalItems.toLocaleString()} />
            <MobileStatCard icon={Target} label="Items/Customer" value={summary.avgItems.toFixed(1)} />
          </div>
        </div>

        {/* Day of Week - Mobile */}
        {datePreset !== 'today' && dayOfWeek && dayOfWeek.length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#259783]" />
              Day of Week
            </h2>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="flex gap-1 mb-4">
                {dayOfWeek.sort((a, b) => a.day - b.day).map((day) => {
                  const heightPercent = (day.sales / maxDaySales) * 100;
                  const isBest = peakDays?.bySales?.day === day.day;
                  return (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col items-end h-24 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 relative">
                        <div 
                          className={`w-full ${isBest ? 'bg-[#259783] border-2 border-[#259783]' : 'bg-[#259783]/70'}`}
                          style={{ height: `${heightPercent}%`, minHeight: day.sales > 0 ? '4px' : '0' }}
                        />
                        {isBest && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Zap className="w-3 h-3 text-[#259783]" />
                          </div>
                        )}
                      </div>
                      <p className={`text-[10px] font-bold ${isBest ? 'text-[#259783]' : 'text-slate-500'}`}>
                        {day.dayName.slice(0, 3)}
                      </p>
                    </div>
                  );
                })}
              </div>
              {peakDays?.bySales && (
                <div className="border-2 border-[#259783] bg-[#259783]/5 p-3">
                  <p className="text-xs font-bold text-[#259783] mb-1">Best Day: {peakDays.bySales.dayName}</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatPrice(peakDays.bySales.sales)}</p>
                  <p className="text-[10px] text-slate-500">{peakDays.bySales.customers} customers</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Peak Hours */}
        {(peakHours.bySales || peakHours.byCustomers) && (
          <div className="px-4 pb-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#259783]" />
              Peak Hours
            </h2>
            <div className="space-y-2.5">
              {peakHours.bySales && (
                <div className="flex items-center justify-between p-4 border-2 border-[#259783] bg-[#259783]">
                  <div>
                    <p className="text-white/70 text-[10px] uppercase font-bold mb-1">Best Sales</p>
                    <p className="font-black text-white text-lg">{formatHour(peakHours.bySales.hour)}</p>
                    <p className="text-white/60 text-xs mt-0.5">{peakHours.bySales.customers} customers</p>
                  </div>
                  <p className="text-2xl font-black text-white">{formatPrice(peakHours.bySales.sales)}</p>
                </div>
              )}
              {peakHours.byCustomers && (
                <div className="flex items-center justify-between p-4 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div>
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Busiest</p>
                    <p className="font-black text-slate-900 dark:text-white text-lg">{formatHour(peakHours.byCustomers.hour)}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{formatPrice(peakHours.byCustomers.sales)} sales</p>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{peakHours.byCustomers.customers}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Basket Distribution */}
        <div className="px-4 pb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Basket Size</h2>
          <div className="space-y-2.5">
            <MobileBasketCard label="Small" sublabel="<100" percent={basketDistribution.small.percent} count={basketDistribution.small.count} />
            <MobileBasketCard label="Medium" sublabel="100-500" percent={basketDistribution.medium.percent} count={basketDistribution.medium.count} />
            <MobileBasketCard label="Large" sublabel=">500" percent={basketDistribution.large.percent} count={basketDistribution.large.count} />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="px-4 pb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Payment Methods</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <MobilePaymentCard icon={Banknote} label="Cash" percent={paymentDistribution.cash.percent} />
            <MobilePaymentCard icon={Smartphone} label="M-Pesa" percent={paymentDistribution.mpesa.percent} />
            <MobilePaymentCard icon={CreditCard} label="Credit" percent={paymentDistribution.credit.percent} />
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#259783]" />
              Insights
            </h2>
            <div className="border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-2.5">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="w-5 h-5 bg-[#259783] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lightbulb className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hourly List */}
        {hourly.length > 0 && (
          <div className="px-4 pb-6">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3">Hourly Breakdown</h2>
            <div className="space-y-2.5">
              {hourly.map((h) => {
                const avgPerCustomer = h.customers > 0 ? h.sales / h.customers : 0;
                const isPeak = h.hour === peakHours.byCustomers?.hour;
                return (
                  <div 
                    key={h.hour} 
                    className={`flex items-center gap-3 p-3.5 border-2 ${
                      isPeak 
                        ? 'border-[#259783] bg-[#259783]/5' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <div className={`w-12 h-12 flex items-center justify-center border-2 ${
                      isPeak 
                        ? 'border-[#259783] bg-[#259783]' 
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    }`}>
                      {isPeak ? (
                        <Zap className="w-5 h-5 text-white" />
                      ) : (
                        <span className={`text-sm font-bold ${isPeak ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                          {formatHour(h.hour)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{h.customers} customers</p>
                        {isPeak && <Zap className="w-3.5 h-3.5 text-[#259783]" />}
                      </div>
                      <p className="text-[10px] text-slate-500">{formatPrice(h.sales)} • {formatPrice(avgPerCustomer)}/customer</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${h.profit > 0 ? 'text-[#259783]' : 'text-red-500'}`}>
                        {h.profit > 0 ? '+' : ''}{formatPrice(h.profit)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

// Desktop Components
function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <Icon className="w-4 h-4 text-[#259783] mb-2" />
      <p className="text-xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
    </div>
  );
}

function PeakHourCard({ label, hour, value, customers }: { 
  label: string; 
  hour: string; 
  value: string; 
  customers: number;
}) {
  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
        <Zap className="w-4 h-4 text-[#259783]" />
      </div>
      <p className="text-xl font-black text-slate-900 dark:text-white mb-1">{hour}</p>
      <p className="text-sm font-bold text-[#259783]">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{customers} customers</p>
    </div>
  );
}

function DistributionCard({ label, sublabel, percent, count }: { 
  label: string; 
  sublabel: string;
  percent: number; 
  count: number;
}) {
  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-bold text-sm text-slate-900 dark:text-white">{label}</p>
          <p className="text-[10px] text-slate-500">{sublabel}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-slate-900 dark:text-white">{percent.toFixed(0)}%</p>
          <p className="text-[10px] text-slate-500">{count} customers</p>
        </div>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
        <div className="h-full bg-[#259783] transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PaymentCard({ icon: Icon, label, percent, count }: { 
  icon: typeof Banknote; 
  label: string; 
  percent: number; 
  count: number;
}) {
  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
      <div className="w-12 h-12 bg-[#259783] flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">{percent.toFixed(0)}%</p>
      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-[10px] text-slate-500">{count} transactions</p>
    </div>
  );
}

// Mobile Components
function MobileStatCard({ icon: Icon, label, value }: { 
  icon: typeof Users; 
  label: string; 
  value: string; 
}) {
  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5">
      <Icon className="w-4 h-4 text-[#259783] mb-2" />
      <p className="text-lg font-black text-slate-900 dark:text-white mb-0.5">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
    </div>
  );
}

function MobileBasketCard({ label, sublabel, percent, count }: { 
  label: string; 
  sublabel: string;
  percent: number; 
  count: number;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-bold text-sm text-slate-900 dark:text-white">{label}</p>
            <p className="text-[10px] text-slate-500">{sublabel}</p>
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white">{percent.toFixed(0)}%</p>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
          <div className="h-full bg-[#259783]" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">{count} customers</p>
      </div>
    </div>
  );
}

function MobilePaymentCard({ icon: Icon, label, percent }: { 
  icon: typeof Banknote; 
  label: string; 
  percent: number;
}) {
  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-center">
      <div className="w-10 h-10 bg-[#259783] flex items-center justify-center mx-auto mb-2">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xl font-black text-slate-900 dark:text-white mb-0.5">{percent.toFixed(0)}%</p>
      <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
    </div>
  );
}
