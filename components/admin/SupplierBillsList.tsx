'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Receipt,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle,
  CheckCircle2,
  FileText,
  Users,
  Scale,
  Pencil,
  X,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SupplierBillEditForm } from '@/components/admin/SupplierBillEditForm';
import type { SupplierBill } from '@/lib/db/types';

interface SupplierBillWithDetails extends SupplierBill {
  creator_name: string;
  creator_email: string;
  payer_name: string | null;
}

export function SupplierBillsList() {
  const [bills, setBills] = useState<SupplierBillWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [markAsPaidDialog, setMarkAsPaidDialog] = useState<{
    open: boolean;
    bill: SupplierBillWithDetails | null;
  }>({ open: false, bill: null });
  const [editingBill, setEditingBill] = useState<SupplierBillWithDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [salesSummary, setSalesSummary] = useState<{
    totalRevenue: number;
    totalTransactions: number;
  } | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  /** Return [start, end] in Unix seconds for the given date filter (inclusive). */
  const getDateRangeForFilter = useCallback((range: string): [number, number] | null => {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayEnd = todayStart + 86400 - 1;

    switch (range) {
      case 'today':
        return [todayStart, todayEnd];
      case 'yesterday': {
        const yesterdayStart = todayStart - 86400;
        return [yesterdayStart, todayStart - 1];
      }
      case 'this_week': {
        const weekStart = todayStart - new Date().getDay() * 86400;
        return [weekStart, now];
      }
      case 'last_week': {
        const weekStart = todayStart - new Date().getDay() * 86400;
        const lastWeekStart = weekStart - 604800;
        return [lastWeekStart, weekStart - 1];
      }
      case 'this_month': {
        const monthStart = Math.floor(
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
        );
        return [monthStart, now];
      }
      case 'last_month': {
        const thisMonthStart = Math.floor(
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
        );
        const lastMonthStart = Math.floor(
          new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime() / 1000
        );
        return [lastMonthStart, thisMonthStart - 1];
      }
      case 'last_7_days':
        return [now - 604800, now];
      case 'last_30_days':
        return [now - 2592000, now];
      case 'all':
      default:
        return null;
    }
  }, []);

  /** Human-readable date range for the current filter (e.g. "Dec 2 – Dec 8, 2025"). */
  const dateRangeLabel = (() => {
    const range = getDateRangeForFilter(dateFilter);
    if (!range) return null;
    const [start, end] = range;
    const startDate = new Date(start * 1000);
    const endDate = new Date(end * 1000);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const startStr = startDate.toLocaleDateString('en-US', opts);
    const endStr = endDate.toLocaleDateString('en-US', opts);
    if (startStr === endStr) return startStr;
    return `${startStr} – ${endStr}`;
  })();

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? '/api/supplier-bills?includeOverdue=true'
        : `/api/supplier-bills?status=${statusFilter}`;
      const result = await apiGet<SupplierBillWithDetails[]>(url);
      if (result.success) {
        setBills(result.data || []);
      } else {
        setError(result.message || 'Failed to load bills');
      }
    } catch (err) {
      setError('Failed to load bills');
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  useEffect(() => {
    const range = getDateRangeForFilter(dateFilter);
    if (!range) {
      setSalesSummary(null);
      return;
    }
    const [start, end] = range;
    setSalesLoading(true);
    apiGet<{ totalRevenue: number; totalTransactions: number }>(
      `/api/sales/summary?start=${start}&end=${end}`
    )
      .then((res) => {
        if (res.success && res.data) {
          setSalesSummary({ totalRevenue: res.data.totalRevenue, totalTransactions: res.data.totalTransactions });
        } else {
          setSalesSummary(null);
        }
      })
      .catch(() => setSalesSummary(null))
      .finally(() => setSalesLoading(false));
  }, [dateFilter, getDateRangeForFilter]);

  const handleMarkAsPaid = (bill: SupplierBillWithDetails) => {
    setPaymentMethod('');
    setPaymentNotes('');
    setMarkAsPaidDialog({ open: true, bill });
  };

  const handleConfirmMarkAsPaid = async () => {
    if (!markAsPaidDialog.bill) return;

    setIsMarkingAsPaid(true);
    try {
      const result = await apiPost(
        `/api/supplier-bills/${markAsPaidDialog.bill.id}/pay`,
        {
          paymentMethod: paymentMethod.trim() || null,
          paymentNotes: paymentNotes.trim() || null,
        }
      );

      if (result.success) {
        setMarkAsPaidDialog({ open: false, bill: null });
        setPaymentMethod('');
        setPaymentNotes('');
        // Refresh the bills list
        await fetchBills();
      } else {
        setError(result.message || 'Failed to mark bill as paid');
      }
    } catch (err) {
      console.error('Error marking bill as paid:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsMarkingAsPaid(false);
    }
  };


  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isDateInRange = (timestamp: number, range: string): boolean => {
    const now = Math.floor(Date.now() / 1000);
    const billDate = timestamp;
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayEnd = todayStart + 86400; // 24 hours in seconds

    switch (range) {
      case 'today':
        return billDate >= todayStart && billDate < todayEnd;
      case 'yesterday': {
        const yesterdayStart = todayStart - 86400;
        const yesterdayEnd = todayStart;
        return billDate >= yesterdayStart && billDate < yesterdayEnd;
      }
      case 'this_week': {
        const weekStart = todayStart - (new Date().getDay() * 86400);
        return billDate >= weekStart;
      }
      case 'last_week': {
        const weekStart = todayStart - (new Date().getDay() * 86400);
        const lastWeekStart = weekStart - 604800; // 7 days
        return billDate >= lastWeekStart && billDate < weekStart;
      }
      case 'this_month': {
        const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
        return billDate >= monthStart;
      }
      case 'last_month': {
        const thisMonthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
        const lastMonthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime() / 1000);
        return billDate >= lastMonthStart && billDate < thisMonthStart;
      }
      case 'last_7_days':
        return billDate >= (now - 604800); // 7 days ago
      case 'last_30_days':
        return billDate >= (now - 2592000); // 30 days ago
      case 'all':
      default:
        return true;
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0).toLocaleString()}`;
  };

  const getDaysUntilDue = (dueDate: number) => {
    const now = Math.floor(Date.now() / 1000);
    const days = Math.floor((dueDate - now) / (24 * 60 * 60));
    return days;
  };

  const getStatusBadge = (bill: SupplierBillWithDetails) => {
    const daysUntilDue = getDaysUntilDue(bill.due_date);
    
    if (bill.status === 'paid') {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    }
    
    if (bill.status === 'overdue' || daysUntilDue < 0) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    
    if (daysUntilDue <= 3) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600">
          <Clock className="w-3 h-3 mr-1" />
          Due Soon ({daysUntilDue} days)
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600">
        <Calendar className="w-3 h-3 mr-1" />
        Pending ({daysUntilDue} days)
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#259783]" />
          <p className="text-slate-500">Loading supplier bills...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const filteredBills = bills
    .filter((bill) => {
      // Supplier filter
      if (supplierFilter !== 'all') {
        const name = bill.supplier_name || 'Unknown';
        if (name !== supplierFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          const daysUntilDue = getDaysUntilDue(bill.due_date);
          if (!(bill.status === 'pending' && daysUntilDue >= 0)) return false;
        } else if (statusFilter === 'overdue') {
          const daysUntilDue = getDaysUntilDue(bill.due_date);
          if (!(bill.status === 'overdue' || (bill.status === 'pending' && daysUntilDue < 0))) return false;
        } else {
          if (bill.status !== statusFilter) return false;
        }
      }

      // Date filter
      return isDateInRange(bill.created_at, dateFilter);
    })
    .sort((a, b) => b.created_at - a.created_at); // Sort by creation date, newest first

  // Unique supplier names from all bills (for filter dropdown)
  const uniqueSuppliers = [...new Set(bills.map((b) => b.supplier_name || 'Unknown'))].sort();

  const totalPending = filteredBills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalAmount = filteredBills.reduce((sum, b) => sum + b.amount, 0);
  const totalPaid = filteredBills
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + b.amount, 0);

  // Days in current date range (for daily average). Only defined when a range is selected.
  const dateRange = getDateRangeForFilter(dateFilter);
  const daysInRange = dateRange
    ? Math.max(1, Math.floor((dateRange[1] - dateRange[0]) / 86400) + 1)
    : 0;
  const dailyAverageAmount = daysInRange > 0 ? totalAmount / daysInRange : 0;
  const dailyAverageBills = daysInRange > 0 ? filteredBills.length / daysInRange : 0;

  // Per-supplier summary: { supplierName: { total, count } }
  const bySupplier = filteredBills.reduce<Record<string, { total: number; count: number }>>(
    (acc, b) => {
      const name = b.supplier_name || 'Unknown';
      if (!acc[name]) acc[name] = { total: 0, count: 0 };
      acc[name].total += b.amount;
      acc[name].count += 1;
      return acc;
    },
    {}
  );
  const supplierEntries = Object.entries(bySupplier).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Supplier Bills
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
            {supplierFilter !== 'all' && (
              <span className="ml-2 text-slate-600 dark:text-slate-300">
                • {supplierFilter}
              </span>
            )}
            {totalPending > 0 && (
              <span className="ml-2 font-semibold text-orange-600">
                • {formatPrice(totalPending)} pending
              </span>
            )}
            {dateRangeLabel && (
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                • {dateRangeLabel}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-48 min-w-[12rem]">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {uniqueSuppliers.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bills</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Bills</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {filteredBills.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <Receipt className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Total Amount</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatPrice(totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-orange-200 dark:border-orange-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Pending</span>
            </div>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
              {formatPrice(totalPending)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-green-200 dark:border-green-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Paid</span>
            </div>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatPrice(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Daily Average</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {daysInRange > 0 ? formatPrice(dailyAverageAmount) : '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {daysInRange > 0
                ? `per day (${daysInRange} day${daysInRange !== 1 ? 's' : ''})`
                : 'Select a date range'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bills vs Sales in timeframe */}
      {dateFilter !== 'all' && (
        <Card className="bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-900/50 dark:to-emerald-950/20 border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-4">
              <Scale className="w-5 h-5 text-[#259783]" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Bills vs sales in this period
              </span>
              {dateRangeLabel && (
                <span className="text-xs font-normal normal-case text-slate-500 dark:text-slate-400">
                  ({dateRangeLabel})
                </span>
              )}
            </div>
            {salesLoading ? (
              <div className="flex items-center gap-3 py-4 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading sales for comparison...</span>
              </div>
            ) : salesSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                      Bills total
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatPrice(totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                      Sales total
                    </p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {formatPrice(salesSummary.totalRevenue)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {salesSummary.totalTransactions} transaction{salesSummary.totalTransactions !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                      Difference (sales − bills)
                    </p>
                    {(() => {
                      const diff = salesSummary.totalRevenue - totalAmount;
                      const isPositive = diff >= 0;
                      return (
                        <p
                          className={`text-lg font-bold ${
                            isPositive
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatPrice(diff)}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {salesSummary.totalRevenue >= totalAmount
                        ? 'Sales covered your bills in this period'
                        : 'Bills exceeded sales — consider timing or cash flow'}
                    </p>
                  </div>
                </div>
                {salesSummary.totalRevenue > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">Bills as % of sales</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {Math.round((totalAmount / salesSummary.totalRevenue) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#259783] dark:bg-emerald-600 transition-all"
                        style={{
                          width: `${Math.min(100, (totalAmount / salesSummary.totalRevenue) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                Could not load sales for this period.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* By supplier breakdown */}
      {supplierEntries.length > 0 && (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-3">
              <Users className="w-4 h-4" />
              <span className="text-sm font-semibold">By supplier</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {supplierEntries.map(([name, { total, count }]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white truncate max-w-[140px]" title={name}>
                      {name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {count} bill{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white shrink-0 ml-2">
                    {formatPrice(total)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredBills.length === 0 ? (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold">
              No bills found
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {statusFilter === 'all' 
                ? 'No supplier bills have been created yet'
                : `No ${statusFilter} bills found`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden grid gap-4">
            {filteredBills.map((bill) => {
              const daysUntilDue = getDaysUntilDue(bill.due_date);
              const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
              const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;

              return (
                <Card
                  key={bill.id}
                  className={`bg-white dark:bg-[#1c2e18] border-2 ${
                    isOverdue
                      ? 'border-red-500 dark:border-red-800'
                      : isDueSoon
                      ? 'border-orange-500 dark:border-orange-800'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
                            <Receipt className="w-5 h-5 text-[#259783]" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white">
                              {bill.supplier_name}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {bill.bill_description}
                            </p>
                            {bill.supplier_phone && (
                              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                📞 {bill.supplier_phone}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(bill)}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">Amount</p>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {formatPrice(bill.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">Due Date</p>
                            <p className={`font-bold ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : isDueSoon
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-900 dark:text-white'
                            }`}>
                              {formatDate(bill.due_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">Created</p>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {formatDate(bill.created_at)}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              by {bill.creator_name}
                            </p>
                          </div>
                          {bill.payment_date ? (
                            <div>
                              <p className="text-slate-500 dark:text-slate-400 mb-1">Paid On</p>
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                {formatDate(bill.payment_date)}
                              </p>
                              {bill.payer_name && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                  by {bill.payer_name}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-slate-500 dark:text-slate-400 mb-1">Status</p>
                              <p className="font-semibold text-slate-700 dark:text-slate-300">
                                {bill.status === 'paid' ? 'Paid' : bill.status === 'overdue' ? 'Overdue' : 'Pending'}
                              </p>
                            </div>
                          )}
                        </div>

                        {bill.notes && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {bill.notes}
                            </p>
                          </div>
                        )}

                        {bill.status !== 'paid' && (
                          <div className="pt-2 flex flex-wrap gap-2">
                            <Button
                              onClick={() => setEditingBill(bill)}
                              variant="outline"
                              size="sm"
                              className="border-slate-300 dark:border-slate-600"
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleMarkAsPaid(bill)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Mark as Paid
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block bg-white dark:bg-[#1c2e18] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Supplier</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Description</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Amount</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Due</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Created</th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill, i) => {
                    const daysUntilDue = getDaysUntilDue(bill.due_date);
                    const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
                    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
                    return (
                      <tr
                        key={bill.id}
                        className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                          i % 2 === 0 ? 'bg-white dark:bg-[#1c2e18]' : 'bg-slate-50/50 dark:bg-slate-900/20'
                        } ${
                          isOverdue ? 'border-l-2 border-l-red-500' : isDueSoon ? 'border-l-2 border-l-orange-500' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{bill.supplier_name}</p>
                            {bill.supplier_phone && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">📞 {bill.supplier_phone}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={bill.bill_description}>
                          {bill.bill_description}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatPrice(bill.amount)}
                        </td>
                        <td className="p-3">
                          <span className={`font-medium ${
                            isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {formatDate(bill.due_date)}
                          </span>
                        </td>
                        <td className="p-3">{getStatusBadge(bill)}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {formatDate(bill.created_at)}
                          <span className="block text-xs text-slate-400 dark:text-slate-500">by {bill.creator_name}</span>
                        </td>
                        <td className="p-3 text-right">
                          {bill.status !== 'paid' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                onClick={() => setEditingBill(bill)}
                                variant="outline"
                                size="sm"
                                className="border-slate-300 dark:border-slate-600"
                              >
                                <Pencil className="w-4 h-4 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                onClick={() => handleMarkAsPaid(bill)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                                size="sm"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                Pay
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Edit Bill Drawer */}
      <Drawer open={!!editingBill} onOpenChange={(open) => !open && setEditingBill(null)} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen">
          <DrawerHeader className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative pr-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingBill(null)}
              className="absolute right-4 top-4 h-10 w-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-2 border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm hover:shadow-md rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
            <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
              <Pencil className="w-5 h-5 text-[#259783]" />
              Edit supplier bill
            </DrawerTitle>
            <DrawerDescription className="text-slate-600 dark:text-slate-400">
              {editingBill && (
                <>Update details for bill from {editingBill.supplier_name}</>
              )}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-6 flex-1 bg-white dark:bg-[#0f1a0d]">
            {editingBill && (
              <SupplierBillEditForm
                billId={editingBill.id}
                initialSupplierName={editingBill.supplier_name}
                initialSupplierPhone={editingBill.supplier_phone ?? ''}
                initialBillDescription={editingBill.bill_description}
                initialAmount={editingBill.amount}
                initialDueDate={editingBill.due_date}
                initialNotes={editingBill.notes ?? ''}
                onSuccess={async () => {
                  setEditingBill(null);
                  await fetchBills();
                }}
                onCancel={() => setEditingBill(null)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Mark as Paid Dialog */}
      <Dialog
        open={markAsPaidDialog.open}
        onOpenChange={(open) =>
          setMarkAsPaidDialog({ open, bill: open ? markAsPaidDialog.bill : null })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Bill as Paid</DialogTitle>
            <DialogDescription>
              {markAsPaidDialog.bill && (
                <>
                  Mark the bill from <strong>{markAsPaidDialog.bill.supplier_name}</strong> as
                  paid. You can optionally add payment details below.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {markAsPaidDialog.bill && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatPrice(markAsPaidDialog.bill.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Description:</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {markAsPaidDialog.bill.bill_description}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method (Optional)</Label>
              <Input
                id="paymentMethod"
                placeholder="e.g., Cash, M-Pesa, Bank Transfer"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
              <Input
                id="paymentNotes"
                placeholder="Any additional notes about the payment"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkAsPaidDialog({ open: false, bill: null })}
              disabled={isMarkingAsPaid}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMarkAsPaid}
              disabled={isMarkingAsPaid}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isMarkingAsPaid ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Marking as Paid...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
