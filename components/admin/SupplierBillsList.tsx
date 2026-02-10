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
  Pencil,
  X,
  TrendingUp,
  Wallet,
  Truck,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { SupplierBillEditForm } from '@/components/admin/SupplierBillEditForm';
import type { SupplierBill } from '@/lib/db/types';

// ── Types ──────────────────────────────────────────────

interface SupplierBillWithDetails extends SupplierBill {
  creator_name: string;
  creator_email: string;
  payer_name: string | null;
}

interface SupplierFromTable {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  location: string | null;
  notes: string | null;
}

// ── Constants ──────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun (business week)
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Component ──────────────────────────────────────────

interface SupplierBillsListProps {
  onSupplierClick?: (supplier: {
    id: string;
    name: string;
    contact_phone: string | null;
    contact_email: string | null;
    location: string | null;
    notes: string | null;
  }) => void;
}

export function SupplierBillsList({ onSupplierClick }: SupplierBillsListProps) {
  // ── State ────────────────────────────────────────────
  const [bills, setBills] = useState<SupplierBillWithDetails[]>([]);
  const [suppliersFromTable, setSuppliersFromTable] = useState<SupplierFromTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('this_week');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>('all');
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

  // ── Helpers ──────────────────────────────────────────

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
    const todayEnd = todayStart + 86400;

    switch (range) {
      case 'today':
        return billDate >= todayStart && billDate < todayEnd;
      case 'yesterday': {
        const yesterdayStart = todayStart - 86400;
        return billDate >= yesterdayStart && billDate < todayStart;
      }
      case 'this_week': {
        const weekStart = todayStart - new Date().getDay() * 86400;
        return billDate >= weekStart;
      }
      case 'last_week': {
        const weekStart = todayStart - new Date().getDay() * 86400;
        const lastWeekStart = weekStart - 604800;
        return billDate >= lastWeekStart && billDate < weekStart;
      }
      case 'this_month': {
        const monthStart = Math.floor(
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
        );
        return billDate >= monthStart;
      }
      case 'last_month': {
        const thisMonthStart = Math.floor(
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
        );
        const lastMonthStart = Math.floor(
          new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime() / 1000
        );
        return billDate >= lastMonthStart && billDate < thisMonthStart;
      }
      case 'last_7_days':
        return billDate >= now - 604800;
      case 'last_30_days':
        return billDate >= now - 2592000;
      case 'all':
      default:
        return true;
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${Math.round(price).toLocaleString()}`;
  };

  const getDaysUntilDue = (dueDate: number) => {
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((dueDate - now) / 86400);
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
          Due Soon ({daysUntilDue}d)
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600">
        <Calendar className="w-3 h-3 mr-1" />
        Pending ({daysUntilDue}d)
      </Badge>
    );
  };

  // ── Data fetching ────────────────────────────────────

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        statusFilter === 'all'
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

  // Fetch supplier table for dropdown
  useEffect(() => {
    apiGet<SupplierFromTable[]>('/api/suppliers')
      .then((res) => {
        if (res.success && res.data) setSuppliersFromTable(res.data);
      })
      .catch(() => {});
  }, []);

  // Always fetch sales data for comparison (not just when date range is selected)
  useEffect(() => {
    const range = getDateRangeForFilter(dateFilter);
    const start = range ? range[0] : 0;
    const end = range ? range[1] : Math.floor(Date.now() / 1000);

    setSalesLoading(true);
    apiGet<{ totalRevenue: number; totalTransactions: number }>(
      `/api/sales/summary?start=${start}&end=${end}`
    )
      .then((res) => {
        if (res.success && res.data) {
          setSalesSummary({
            totalRevenue: res.data.totalRevenue,
            totalTransactions: res.data.totalTransactions,
          });
        } else {
          setSalesSummary(null);
        }
      })
      .catch(() => setSalesSummary(null))
      .finally(() => setSalesLoading(false));
  }, [dateFilter, getDateRangeForFilter]);

  // ── Handlers ─────────────────────────────────────────

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

  // ── Loading / Error ──────────────────────────────────

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

  // ── Computed data ────────────────────────────────────

  const filteredBills = bills
    .filter((bill) => {
      if (supplierFilter !== 'all') {
        if ((bill.supplier_name || 'Unknown') !== supplierFilter) return false;
      }
      if (dayOfWeekFilter !== 'all') {
        if (new Date(bill.created_at * 1000).getDay() !== parseInt(dayOfWeekFilter, 10))
          return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          const d = getDaysUntilDue(bill.due_date);
          if (!(bill.status === 'pending' && d >= 0)) return false;
        } else if (statusFilter === 'overdue') {
          const d = getDaysUntilDue(bill.due_date);
          if (!(bill.status === 'overdue' || (bill.status === 'pending' && d < 0))) return false;
        } else {
          if (bill.status !== statusFilter) return false;
        }
      }
      return isDateInRange(bill.created_at, dateFilter);
    })
    .sort((a, b) => b.created_at - a.created_at);

  // Supplier dropdown options (merge supplier table + bill names)
  const uniqueSuppliers = (() => {
    const fromTable = suppliersFromTable.map((s) => s.name);
    const fromBills = bills.map((b) => b.supplier_name || 'Unknown');
    return [...new Set([...fromTable, ...fromBills])].sort();
  })();

  // Totals
  const totalAmount = filteredBills.reduce((s, b) => s + b.amount, 0);
  const totalPending = filteredBills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((s, b) => s + b.amount, 0);
  const totalPaid = filteredBills
    .filter((b) => b.status === 'paid')
    .reduce((s, b) => s + b.amount, 0);

  // Time span for averages
  const dateRange = getDateRangeForFilter(dateFilter);
  const spanDays = (() => {
    if (dateRange) return Math.max(1, Math.floor((dateRange[1] - dateRange[0]) / 86400) + 1);
    if (filteredBills.length > 0) {
      const earliest = Math.min(...filteredBills.map((b) => b.created_at));
      const now = Math.floor(Date.now() / 1000);
      return Math.max(1, Math.floor((now - earliest) / 86400) + 1);
    }
    return 1;
  })();
  const spanWeeks = Math.max(1, spanDays / 7);

  // Financial pulse
  const salesRevenue = salesSummary?.totalRevenue ?? 0;
  const netMargin = salesRevenue - totalAmount;
  const costRatio = salesRevenue > 0 ? (totalAmount / salesRevenue) * 100 : 0;

  // ── Supplier Budget Planner ──────────────────────────

  const supplierBudget = (() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    filteredBills.forEach((b) => {
      const name = b.supplier_name || 'Unknown';
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += b.amount;
      map[name].count += 1;
    });
    return Object.values(map)
      .map((s) => ({
        ...s,
        avgPerBill: s.count > 0 ? s.total / s.count : 0,
        avgPerDay: s.total / spanDays,
        avgPerWeek: s.total / spanWeeks,
        avgPerMonth: (s.total / spanDays) * 30,
        shareOfTotal: totalAmount > 0 ? (s.total / totalAmount) * 100 : 0,
        shareOfSales:
          salesSummary && salesSummary.totalRevenue > 0
            ? (s.total / salesSummary.totalRevenue) * 100
            : null,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  // ── Delivery Schedule Matrix ─────────────────────────

  const deliveryMatrix = (() => {
    // Track per-supplier, per-day: deliveries, total spend, and distinct calendar dates
    const matrix: Record<
      string,
      Record<number, { count: number; total: number; distinctDays: number }>
    > = {};
    const dateTracker: Record<string, Record<number, Set<string>>> = {};

    // Use ALL bills for full delivery pattern (not just filtered)
    bills.forEach((b) => {
      const name = b.supplier_name || 'Unknown';
      const date = new Date(b.created_at * 1000);
      const day = date.getDay();
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      if (!matrix[name]) matrix[name] = {};
      if (!matrix[name][day]) matrix[name][day] = { count: 0, total: 0, distinctDays: 0 };
      matrix[name][day].count += 1;
      matrix[name][day].total += b.amount;

      if (!dateTracker[name]) dateTracker[name] = {};
      if (!dateTracker[name][day]) dateTracker[name][day] = new Set();
      dateTracker[name][day].add(dateKey);
    });

    // Finalize distinct day counts from the sets
    Object.keys(matrix).forEach((name) => {
      Object.keys(matrix[name]).forEach((dayStr) => {
        const day = parseInt(dayStr, 10);
        matrix[name][day].distinctDays = dateTracker[name]?.[day]?.size ?? 1;
      });
    });

    // Sort suppliers by total spend (highest first)
    const suppliers = Object.keys(matrix).sort((a, b) => {
      const ta = Object.values(matrix[a]).reduce((s, c) => s + c.total, 0);
      const tb = Object.values(matrix[b]).reduce((s, c) => s + c.total, 0);
      return tb - ta;
    });

    // Max count for heat map intensity
    let maxCount = 0;
    Object.values(matrix).forEach((days) =>
      Object.values(days).forEach((c) => {
        if (c.count > maxCount) maxCount = c.count;
      })
    );

    // Daily Budget = sum of each supplier's avg spend per occurrence of that day.
    // If Supplier A averages KES 1,185 per Thursday and Supplier B averages KES 9,690
    // per Thursday, the Thursday budget = 1,185 + 9,690 = 10,875.
    // The column values ADD UP to the daily budget.
    const dayBudgets: Record<number, number> = {};
    DAY_ORDER.forEach((d) => {
      let sum = 0;
      suppliers.forEach((name) => {
        const cell = matrix[name]?.[d];
        if (cell) {
          sum += cell.total / cell.distinctDays;
        }
      });
      dayBudgets[d] = sum;
    });

    // Weekly budget = sum of all daily budgets
    const weeklyBudget = DAY_ORDER.reduce((s, d) => s + dayBudgets[d], 0);

    return { matrix, suppliers, maxCount, dayBudgets, weeklyBudget };
  })();

  const getHeatBg = (count: number, max: number) => {
    if (!count || !max) return '';
    const r = count / max;
    if (r > 0.66) return 'bg-emerald-200/70 dark:bg-emerald-700/40';
    if (r > 0.33) return 'bg-emerald-100/70 dark:bg-emerald-800/30';
    return 'bg-emerald-50/70 dark:bg-emerald-900/20';
  };

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ═══════════ FILTERS ═══════════ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Supplier Bills &amp; Budget
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
              {dateRangeLabel && <span> &middot; {dateRangeLabel}</span>}
              {supplierFilter !== 'all' && (
                <span className="text-slate-700 dark:text-slate-300"> &middot; {supplierFilter}</span>
              )}
              {dayOfWeekFilter !== 'all' && (
                <span className="text-slate-700 dark:text-slate-300">
                  {' '}&middot; {DAY_NAMES[parseInt(dayOfWeekFilter, 10)]}s only
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {uniqueSuppliers.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dayOfWeekFilter} onValueChange={setDayOfWeekFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {DAY_ORDER.map((d, i) => (
                <SelectItem key={d} value={String(d)}>
                  {DAY_SHORT[i]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Period" />
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
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ═══════════ 1. FINANCIAL PULSE ═══════════ */}
      <Card className="overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-emerald-50/30 to-white dark:from-[#1c2e18] dark:via-emerald-950/20 dark:to-[#1c2e18]">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#259783]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Financial Pulse</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {dateRangeLabel || 'All time'} &middot; How much of your sales go to suppliers
              </p>
            </div>
          </div>

          {salesLoading ? (
            <div className="flex items-center gap-2 py-6 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading sales data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Big numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                    Sales Revenue
                  </p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatPrice(salesRevenue)}
                  </p>
                  {salesSummary && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {salesSummary.totalTransactions} transaction
                      {salesSummary.totalTransactions !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                    Supplier Costs
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatPrice(totalAmount)}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                    Net After Suppliers
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      netMargin >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {netMargin >= 0 ? '+' : ''}
                    {formatPrice(netMargin)}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {netMargin >= 0 ? 'Sales cover your suppliers' : 'Costs exceed sales'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
                    Cost Ratio
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {salesRevenue > 0 ? `${Math.round(costRatio)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    of sales goes to suppliers
                  </p>
                </div>
              </div>

              {/* Cost ratio progress bar */}
              {salesRevenue > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      Supplier costs as % of sales
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {Math.round(costRatio)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        costRatio > 80
                          ? 'bg-red-500'
                          : costRatio > 60
                          ? 'bg-amber-500'
                          : 'bg-[#259783]'
                      }`}
                      style={{ width: `${Math.min(100, costRatio)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1 text-slate-400 dark:text-slate-500">
                    <span>0%</span>
                    <span
                      className={
                        costRatio > 80
                          ? 'text-red-500 font-medium'
                          : costRatio > 60
                          ? 'text-amber-500 font-medium'
                          : 'text-emerald-600 font-medium'
                      }
                    >
                      {costRatio <= 50
                        ? 'Healthy margin'
                        : costRatio <= 70
                        ? 'Moderate spend'
                        : 'High supplier spend'}
                    </span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Daily averages comparison */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Avg Sales / Day
                  </p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formatPrice(salesRevenue / spanDays)}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    ~{formatPrice((salesRevenue / spanDays) * 7)} / week
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/30">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Avg Supplier Cost / Day
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatPrice(totalAmount / spanDays)}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    ~{formatPrice(totalAmount / spanWeeks)} / week
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ 2. QUICK STATS ═══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-0.5">
              <FileText className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Total Bills</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {filteredBills.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-orange-200 dark:border-orange-900/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 mb-0.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Pending</span>
            </div>
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatPrice(totalPending)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-green-200 dark:border-green-900/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-0.5">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Paid</span>
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatPrice(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Avg / Week</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {formatPrice(totalAmount / spanWeeks)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ 3. SUPPLIER BUDGET PLANNER ═══════════ */}
      {supplierBudget.length > 0 && (
        <Card className="bg-white dark:bg-[#1c2e18] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            {/* Section header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Supplier Budget Planner
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-9">
                Averages based on {spanDays} day{spanDays !== 1 ? 's' : ''} of data
                {dateRangeLabel && ` (${dateRangeLabel})`}
              </p>
            </div>

            {/* Budget table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Supplier
                    </th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Bills
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Avg / Week
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Avg / Day
                    </th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      % of Costs
                    </th>
                    {salesSummary && salesSummary.totalRevenue > 0 && (
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        % of Sales
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {supplierBudget.map((s, i) => (
                    <tr
                      key={s.name}
                      className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors ${
                        i % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-8 rounded-full shrink-0"
                            style={{
                              backgroundColor: `hsl(${(160 + i * 35) % 360}, 55%, 50%)`,
                              opacity: 0.7,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const supplier = suppliersFromTable.find(
                                (sup) => sup.name === s.name
                              );
                              if (supplier && onSupplierClick) {
                                onSupplierClick(supplier);
                              }
                            }}
                            className="font-medium text-slate-900 dark:text-white truncate max-w-[130px] hover:text-[#259783] dark:hover:text-[#3bd522] hover:underline underline-offset-2 transition-colors text-left"
                            title={`${s.name} — Click to manage products`}
                          >
                            {s.name}
                          </button>
                        </div>
                      </td>
                      <td className="text-center px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {s.count}
                      </td>
                      <td className="text-right px-3 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatPrice(s.total)}
                      </td>
                      <td className="text-right px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatPrice(s.avgPerWeek)}
                      </td>
                      <td className="text-right px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatPrice(s.avgPerDay)}
                      </td>
                      <td className="text-right px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#259783]"
                              style={{ width: `${Math.min(100, s.shareOfTotal)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-10 text-right">
                            {Math.round(s.shareOfTotal)}%
                          </span>
                        </div>
                      </td>
                      {salesSummary && salesSummary.totalRevenue > 0 && (
                        <td className="text-right px-3 py-2.5">
                          <span
                            className={`text-xs font-semibold ${
                              (s.shareOfSales ?? 0) > 30
                                ? 'text-red-600 dark:text-red-400'
                                : (s.shareOfSales ?? 0) > 15
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {s.shareOfSales !== null ? `${Math.round(s.shareOfSales)}%` : '—'}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-900/50 border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">Total</td>
                    <td className="text-center px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-300">
                      {filteredBills.length}
                    </td>
                    <td className="text-right px-3 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatPrice(totalAmount)}
                    </td>
                    <td className="text-right px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatPrice(totalAmount / spanWeeks)}
                    </td>
                    <td className="text-right px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatPrice(totalAmount / spanDays)}
                    </td>
                    <td className="text-right px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                      100%
                    </td>
                    {salesSummary && salesSummary.totalRevenue > 0 && (
                      <td className="text-right px-3 py-2.5 font-bold text-slate-900 dark:text-white">
                        {Math.round(costRatio)}%
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Projected monthly footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/10">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Projected monthly supplier cost:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatPrice((totalAmount / spanDays) * 30)}
                </span>
                {salesSummary && salesSummary.totalRevenue > 0 && (
                  <span className="ml-3 text-slate-500 dark:text-slate-400">
                    Projected monthly sales:{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatPrice((salesRevenue / spanDays) * 30)}
                    </span>
                    <span className="mx-1">&middot;</span>
                    Projected monthly margin:{' '}
                    <span
                      className={`font-semibold ${
                        netMargin >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatPrice((netMargin / spanDays) * 30)}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ 4. DELIVERY SCHEDULE ═══════════ */}
      {deliveryMatrix.suppliers.length > 0 && (
        <Card className="bg-white dark:bg-[#1c2e18] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            {/* Section header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delivery Schedule
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 ml-9">
                Which supplier delivers on which days &middot; Based on all historical bill data
              </p>
            </div>

            {/* Schedule grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[540px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-32">
                      Supplier
                    </th>
                    {DAY_ORDER.map((d, i) => (
                      <th
                        key={d}
                        className="text-center px-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        {DAY_SHORT[i]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliveryMatrix.suppliers.map((name, si) => (
                    <tr
                      key={name}
                      className={`border-b border-slate-100 dark:border-slate-800/50 ${
                        si % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-900/10' : ''
                      }`}
                    >
                      <td
                        className="px-4 py-2.5 font-medium text-slate-900 dark:text-white truncate max-w-[130px]"
                        title={name}
                      >
                        {name}
                      </td>
                      {DAY_ORDER.map((d) => {
                        const cell = deliveryMatrix.matrix[name]?.[d];
                        if (!cell) {
                          return (
                            <td key={d} className="text-center px-1 py-2">
                              <span className="text-slate-300 dark:text-slate-700">—</span>
                            </td>
                          );
                        }
                        // Average spend per occurrence of this day (not per delivery)
                        const avgPerDay = cell.total / cell.distinctDays;
                        return (
                          <td
                            key={d}
                            className={`text-center px-1 py-2 ${getHeatBg(
                              cell.count,
                              deliveryMatrix.maxCount
                            )}`}
                          >
                            <div
                              title={`${cell.count} deliveries across ${cell.distinctDays} ${
                                cell.distinctDays === 1 ? 'day' : 'days'
                              }, avg ${formatPrice(avgPerDay)} per day`}
                            >
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatPrice(avgPerDay)}
                              </span>
                              <br />
                              <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                {cell.count}x / {cell.distinctDays}d
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Daily budget row - sums the column */}
                  <tr className="bg-blue-50/50 dark:bg-blue-950/10 border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="px-4 py-2.5 font-bold text-xs text-slate-900 dark:text-white">
                      Daily Budget
                    </td>
                    {DAY_ORDER.map((d) => {
                      const budget = deliveryMatrix.dayBudgets[d];
                      return (
                        <td key={d} className="text-center px-1 py-2.5">
                          {budget > 0 ? (
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {formatPrice(budget)}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Weekly total row */}
                  <tr className="bg-amber-50/50 dark:bg-amber-950/10 border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-2.5 font-bold text-xs text-amber-800 dark:text-amber-300">
                      Weekly Total
                    </td>
                    <td
                      colSpan={7}
                      className="text-center px-1 py-2.5 font-bold text-sm text-amber-800 dark:text-amber-300"
                    >
                      {formatPrice(deliveryMatrix.weeklyBudget)}
                      <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-2">
                        / week (sum of all daily budgets)
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Legend */}
            <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/20">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold">How to read:</span> Each cell shows the average
                amount you pay that supplier on that day (e.g. &quot;KES 9,690&quot; = typical
                Thursday bill). Below it: deliveries / distinct days.{' '}
                <span className="font-semibold">Daily Budget</span> = sum of the column (what to
                budget for that day).{' '}
                <span className="font-semibold">Weekly Total</span> = sum of all daily budgets.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ 5. ALL BILLS ═══════════ */}
      <div className="flex items-center gap-2 mt-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Receipt className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Bills</h3>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          ({filteredBills.length})
        </span>
      </div>

      {filteredBills.length === 0 ? (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold">No bills found</p>
            <p className="text-sm text-slate-400 mt-1">
              {statusFilter === 'all'
                ? 'No supplier bills match your current filters'
                : `No ${statusFilter} bills found`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden grid gap-3">
            {filteredBills.map((bill) => {
              const daysUntilDue = getDaysUntilDue(bill.due_date);
              const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
              const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
              const billDay = DAY_NAMES[new Date(bill.created_at * 1000).getDay()];

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
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center shrink-0">
                          <Receipt className="w-5 h-5 text-[#259783]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              const supplier = suppliersFromTable.find(
                                (sup) => sup.name === bill.supplier_name
                              );
                              if (supplier && onSupplierClick) {
                                onSupplierClick(supplier);
                              }
                            }}
                            className="font-bold text-slate-900 dark:text-white truncate block max-w-full hover:text-[#259783] dark:hover:text-[#3bd522] hover:underline underline-offset-2 transition-colors text-left"
                          >
                            {bill.supplier_name}
                          </button>
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {bill.bill_description}
                          </p>
                          {bill.supplier_phone && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {bill.supplier_phone}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(bill)}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">
                            Amount
                          </p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {formatPrice(bill.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">
                            Due Date
                          </p>
                          <p
                            className={`font-bold ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : isDueSoon
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatDate(bill.due_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">
                            Created
                          </p>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDate(bill.created_at)}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {billDay} &middot; by {bill.creator_name}
                          </p>
                        </div>
                        {bill.payment_date ? (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">
                              Paid On
                            </p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              {formatDate(bill.payment_date)}
                            </p>
                            {bill.payer_name && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                by {bill.payer_name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">
                              Status
                            </p>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {bill.status === 'paid'
                                ? 'Paid'
                                : bill.status === 'overdue'
                                ? 'Overdue'
                                : 'Pending'}
                            </p>
                          </div>
                        )}
                      </div>

                      {bill.notes && (
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <p className="text-xs text-slate-600 dark:text-slate-400">{bill.notes}</p>
                        </div>
                      )}

                      {bill.status !== 'paid' && (
                        <div className="pt-1 flex flex-wrap gap-2">
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
                            Mark as Paid
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block bg-white dark:bg-[#1c2e18] border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      Due
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider w-28">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill, i) => {
                    const daysUntilDue = getDaysUntilDue(bill.due_date);
                    const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
                    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
                    const billDay = DAY_NAMES[new Date(bill.created_at * 1000).getDay()];

                    return (
                      <tr
                        key={bill.id}
                        className={`border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                          i % 2 === 0
                            ? 'bg-white dark:bg-[#1c2e18]'
                            : 'bg-slate-50/50 dark:bg-slate-900/20'
                        } ${
                          isOverdue
                            ? 'border-l-2 border-l-red-500'
                            : isDueSoon
                            ? 'border-l-2 border-l-orange-500'
                            : ''
                        }`}
                      >
                        <td className="p-3">
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                const supplier = suppliersFromTable.find(
                                  (sup) => sup.name === bill.supplier_name
                                );
                                if (supplier && onSupplierClick) {
                                  onSupplierClick(supplier);
                                }
                              }}
                              className="font-medium text-slate-900 dark:text-white hover:text-[#259783] dark:hover:text-[#3bd522] hover:underline underline-offset-2 transition-colors text-left"
                            >
                              {bill.supplier_name}
                            </button>
                            {bill.supplier_phone && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {bill.supplier_phone}
                              </p>
                            )}
                          </div>
                        </td>
                        <td
                          className="p-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate"
                          title={bill.bill_description}
                        >
                          {bill.bill_description}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatPrice(bill.amount)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-medium ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : isDueSoon
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {formatDate(bill.due_date)}
                          </span>
                        </td>
                        <td className="p-3">{getStatusBadge(bill)}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {formatDate(bill.created_at)}
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                            {billDay} &middot; by {bill.creator_name}
                          </span>
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

      {/* ═══════════ EDIT BILL DRAWER ═══════════ */}
      <Drawer
        open={!!editingBill}
        onOpenChange={(open) => !open && setEditingBill(null)}
        direction="right"
      >
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
              {editingBill && <>Update details for bill from {editingBill.supplier_name}</>}
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

      {/* ═══════════ MARK AS PAID DIALOG ═══════════ */}
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
                  Mark the bill from <strong>{markAsPaidDialog.bill.supplier_name}</strong> as paid.
                  You can optionally add payment details below.
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
