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
  Truck,
  Trash2,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
  HandCoins,
  Repeat,
  Store,
  ScanBarcode,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/utils/api-client';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { toast } from 'sonner';
import { SupplierBillEditForm } from '@/components/admin/SupplierBillEditForm';
import type { SupplierBill } from '@/lib/db/types';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

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
  supplier_type?: string | null;
  preferred_payment_method?: string | null;
  payment_details?: string | null;
}

// ── Constants ──────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun (business week)
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Component ──────────────────────────────────────────

interface SupplierBillsListProps {
  onSupplierClick?: (supplier: SupplierFromTable) => void;
}

export function SupplierBillsList({ onSupplierClick }: SupplierBillsListProps) {
  const { productTypes } = useItemTypes();
  const { user } = useCurrentUser();
  const canDeleteBills = user?.role === 'admin' || user?.role === 'owner';
  const [bills, setBills] = useState<SupplierBillWithDetails[]>([]);
  const [suppliersFromTable, setSuppliersFromTable] = useState<SupplierFromTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
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
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [salesSummary, setSalesSummary] = useState<{
    totalRevenue: number;
    totalTransactions: number;
  } | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  const [typeSalesData, setTypeSalesData] = useState<Record<string, { revenue: number; transactions: number }>>({});
  const [typeProfitData, setTypeProfitData] = useState<Record<string, { profit: number; cost: number; sales: number; margin: number }>>({});

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

  // ── Payment method helpers ──────────────────────────────
  const PAYMENT_METHOD_MAP: Record<string, { label: string; icon: typeof Banknote; colorClass: string }> = {
    cash: { label: 'Cash', icon: Banknote, colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    till_number: { label: 'Till', icon: Store, colorClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
    paybill: { label: 'Paybill', icon: ScanBarcode, colorClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
    mpesa: { label: 'M-Pesa', icon: Smartphone, colorClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    bank_transfer: { label: 'Bank', icon: Landmark, colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    cheque: { label: 'Cheque', icon: CreditCard, colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    credit: { label: 'Credit', icon: HandCoins, colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    other: { label: 'Other', icon: Repeat, colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  };

  const renderPaymentMethods = (methodString: string | null) => {
    if (!methodString) return null;
    const methods = methodString.split(',').filter(Boolean);
    if (methods.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {methods.map((id) => {
          const m = PAYMENT_METHOD_MAP[id.trim()];
          if (!m) return null;
          const Icon = m.icon;
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${m.colorClass}`}
            >
              <Icon className="w-2.5 h-2.5" />
              {m.label}
            </span>
          );
        })}
      </div>
    );
  };

  // Resolve payment method/details: use bill's values, fall back to supplier's when bill has none
  const getBillPaymentDisplay = (bill: SupplierBillWithDetails) => {
    const supplier = suppliersFromTable.find(
      (s) => bill.supplier_id === s.id || s.name === bill.supplier_name
    );
    return {
      paymentMethod: bill.preferred_payment_method || supplier?.preferred_payment_method || null,
      paymentDetails: bill.payment_details || supplier?.payment_details || null,
    };
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

  const fetchSuppliers = useCallback(() => {
    apiGet<SupplierFromTable[]>('/api/suppliers')
      .then((res) => {
        if (res.success && res.data) setSuppliersFromTable(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Fetch sales + per-type sales/profit data for comparison
  useEffect(() => {
    const range = getDateRangeForFilter(dateFilter);
    const start = range ? range[0] : 0;
    const end = range ? range[1] : Math.floor(Date.now() / 1000);

    setSalesLoading(true);

    const fetchAll = async () => {
      try {
        const summaryUrl = typeFilter !== 'all'
          ? `/api/sales/summary?start=${start}&end=${end}&itemType=${encodeURIComponent(typeFilter)}`
          : `/api/sales/summary?start=${start}&end=${end}`;

        const [summaryRes, ...typeResults] = await Promise.all([
          apiGet<{ totalRevenue: number; totalTransactions: number }>(summaryUrl),
          ...productTypes.map((t) =>
            Promise.all([
              apiGet<{ totalRevenue: number; totalTransactions: number }>(
                `/api/sales/summary?start=${start}&end=${end}&itemType=${encodeURIComponent(t.key)}`
              ),
              apiGet<{ totalSales: number; totalCost: number; totalProfit: number; profitMargin: number }>(
                `/api/profit?start=${start}&end=${end}&itemType=${encodeURIComponent(t.key)}`
              ),
            ])
          ),
        ]);

        if (summaryRes.success && summaryRes.data) {
          setSalesSummary({ totalRevenue: summaryRes.data.totalRevenue, totalTransactions: summaryRes.data.totalTransactions });
        } else {
          setSalesSummary(null);
        }

        const nextSales: Record<string, { revenue: number; transactions: number }> = {};
        const nextProfit: Record<string, { profit: number; cost: number; sales: number; margin: number }> = {};
        productTypes.forEach((t, i) => {
          const [salesRes, profitRes] = typeResults[i] as [
            Awaited<ReturnType<typeof apiGet<{ totalRevenue: number; totalTransactions: number }>>>,
            Awaited<ReturnType<typeof apiGet<{ totalSales: number; totalCost: number; totalProfit: number; profitMargin: number }>>>
          ];
          if (salesRes.success && salesRes.data) {
            nextSales[t.key] = { revenue: salesRes.data.totalRevenue, transactions: salesRes.data.totalTransactions };
          }
          if (profitRes.success && profitRes.data) {
            nextProfit[t.key] = {
              profit: profitRes.data.totalProfit,
              cost: profitRes.data.totalCost,
              sales: profitRes.data.totalSales,
              margin: profitRes.data.profitMargin,
            };
          }
        });
        setTypeSalesData(nextSales);
        setTypeProfitData(nextProfit);
      } catch {
        setSalesSummary(null);
      } finally {
        setSalesLoading(false);
      }
    };

    fetchAll();
  }, [dateFilter, typeFilter, getDateRangeForFilter, productTypes]);

  // ── Handlers ─────────────────────────────────────────

  const handleMarkAsPaid = (bill: SupplierBillWithDetails) => {
    setPaymentMethod('');
    setPaymentNotes('');
    setMarkAsPaidDialog({ open: true, bill });
  };

  const handleDeleteBill = (bill: SupplierBillWithDetails) => {
    if (!canDeleteBills) {
      toast.error('Only administrators can cancel supplier bills.');
      return;
    }

    if (bill.status === 'paid') {
      toast.error('You cannot delete a paid bill.');
      return;
    }

    toast(
      `Cancel this bill from "${bill.supplier_name}" for ${formatPrice(bill.amount)}? This will mark the bill as cancelled and cannot be undone.`,
      {
        action: {
          label: 'Cancel bill',
          onClick: async () => {
            setDeletingBillId(bill.id);
            try {
              const result = await apiDelete(`/api/supplier-bills/${bill.id}`);
              if (result.success) {
                await fetchBills();
                toast.success('Bill cancelled');
              } else {
                toast.error(result.message || 'Failed to cancel bill');
              }
            } catch (err) {
              console.error('Error cancelling bill:', err);
              toast.error('An error occurred while cancelling the bill.');
            } finally {
              setDeletingBillId(null);
            }
          },
        },
        cancel: { label: 'Keep', onClick: () => {} },
      }
    );
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
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] shadow-sm">
        <div className="flex items-center justify-center py-24 sm:py-32">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
              <Loader2 className="h-7 w-7 animate-spin text-[#1c6a1e]" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Loading supplier bills</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fetching your payment records...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200/80 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 shadow-sm">
        <div className="flex items-center justify-center py-24 sm:py-32">
          <div className="text-center space-y-4 max-w-sm px-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Unable to load bills</p>
              <p className="text-xs text-red-600/90 dark:text-red-400/90 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Computed data ────────────────────────────────────

  const filteredBills = bills
    .filter((bill) => {
      if (typeFilter !== 'all') {
        const supplier = suppliersFromTable.find(
          (s) => bill.supplier_id === s.id || s.name === bill.supplier_name
        );
        if (!supplier || supplier.supplier_type !== typeFilter) return false;
      }
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
    // Current week: Monday 00:00 to Sunday 23:59
    const now = new Date();
    const daysSinceMonday = (now.getDay() + 6) % 7;
    const mondayStart = new Date(now);
    mondayStart.setDate(now.getDate() - daysSinceMonday);
    mondayStart.setHours(0, 0, 0, 0);
    const sundayEnd = new Date(mondayStart);
    sundayEnd.setDate(mondayStart.getDate() + 6);
    sundayEnd.setHours(23, 59, 59, 999);
    const weekStart = Math.floor(mondayStart.getTime() / 1000);
    const weekEnd = Math.floor(sundayEnd.getTime() / 1000);

    // Bills from current week only
    const billsThisWeek = bills.filter((b) => b.created_at >= weekStart && b.created_at <= weekEnd);

    // Track per-supplier, per-day: deliveries, total spend, and distinct calendar dates
    const matrix: Record<
      string,
      Record<number, { count: number; total: number; distinctDays: number }>
    > = {};
    const dateTracker: Record<string, Record<number, Set<string>>> = {};

    billsThisWeek.forEach((b) => {
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
    const dayBillsCount: Record<number, number> = {};
    DAY_ORDER.forEach((d) => {
      let budgetSum = 0;
      let countSum = 0;
      suppliers.forEach((name) => {
        const cell = matrix[name]?.[d];
        if (cell) {
          budgetSum += cell.total / cell.distinctDays;
          countSum += cell.count;
        }
      });
      dayBudgets[d] = budgetSum;
      dayBillsCount[d] = countSum;
    });

    // Weekly budget = sum of all daily budgets
    const weeklyBudget = DAY_ORDER.reduce((s, d) => s + dayBudgets[d], 0);

    return { matrix, suppliers, maxCount, dayBudgets, dayBillsCount, weeklyBudget };
  })();

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ═══════════ FILTERS ═══════════ */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#1c2e18] shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                Filters &amp; View
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
                {dateRangeLabel && <span> &middot; {dateRangeLabel}</span>}
                {typeFilter !== 'all' && (() => {
                  const tc = productTypes.find((t) => t.key === typeFilter);
                  return (
                    <span className="text-slate-600 dark:text-slate-300"> &middot; {tc?.emoji} {tc?.label ?? typeFilter}</span>
                  );
                })()}
                {supplierFilter !== 'all' && (
                  <span className="text-slate-600 dark:text-slate-300"> &middot; {supplierFilter}</span>
                )}
                {dayOfWeekFilter !== 'all' && (
                  <span className="text-slate-600 dark:text-slate-300">
                    {' '}&middot; {DAY_NAMES[parseInt(dayOfWeekFilter, 10)]}s only
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="px-4 sm:px-5 py-3 flex flex-wrap gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
          {productTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="min-w-[110px] sm:w-36 h-9 text-xs sm:text-sm shrink-0 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {productTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.emoji} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="min-w-[130px] sm:w-44 h-9 text-xs sm:text-sm shrink-0 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
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
            <SelectTrigger className="min-w-[100px] sm:w-36 h-9 text-xs sm:text-sm shrink-0 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
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
            <SelectTrigger className="min-w-[120px] sm:w-40 h-9 text-xs sm:text-sm shrink-0 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
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
            <SelectTrigger className="min-w-[90px] sm:w-32 h-9 text-xs sm:text-sm shrink-0 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
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

      {/* ═══════════ UNIFIED OVERVIEW (compact, all in one) ═══════════ */}
      <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-br from-white to-slate-50/50 dark:from-[#1c2e18] dark:to-slate-900/30 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1c6a1e]/15 to-[#2a8a30]/10 dark:from-[#1c6a1e]/25 dark:to-[#2a8a30]/15 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#1c6a1e] dark:text-[#2a8a30]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Overview</h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {dateRangeLabel || 'All time'}
              </span>
            </div>
          </div>

          {salesLoading && user?.role !== 'cashier' ? (
            <div className="flex items-center gap-2 py-4 text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Row 1: Bills stats */}
              <div className="flex flex-wrap gap-x-5 sm:gap-x-8 gap-y-2 text-sm">
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-500 dark:text-slate-400">Bills</span>
                  <span className="font-bold text-slate-900 dark:text-white">{filteredBills.length}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatPrice(totalAmount)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400">Pending</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{formatPrice(totalPending)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400">Paid</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(totalPaid)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-500 dark:text-slate-400">Avg/wk</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatPrice(totalAmount / spanWeeks)}</span>
                </span>
              </div>

              {/* Row 2: Financial pulse (non-cashiers) + cost ratio bar */}
              {user?.role !== 'cashier' && (
                <>
                  <div className="flex flex-wrap gap-x-5 sm:gap-x-8 gap-y-2 text-sm pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Sales</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(salesRevenue)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Net</span>
                      <span className={`font-bold ${netMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {netMargin >= 0 ? '+' : ''}{formatPrice(netMargin)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400">Cost ratio</span>
                      <span className="font-bold text-slate-900 dark:text-white">{salesRevenue > 0 ? `${Math.round(costRatio)}%` : '—'}</span>
                    </span>
                  </div>
                  {salesRevenue > 0 && (
                    <div className="pt-1.5">
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            costRatio > 80 ? 'bg-red-500' : costRatio > 60 ? 'bg-amber-500' : 'bg-[#1c6a1e]'
                          }`}
                          style={{ width: `${Math.min(100, costRatio)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Row 3: Top suppliers + weekly budget (non-cashiers, compact) */}
              {user?.role !== 'cashier' && (supplierBudget.length > 0 || deliveryMatrix.weeklyBudget > 0) && (
                <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2 text-xs pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                  {deliveryMatrix.weeklyBudget > 0 && (
                    <span className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/50">
                      <Truck className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      <span className="text-slate-500 dark:text-slate-400">This week</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrice(deliveryMatrix.weeklyBudget)}</span>
                    </span>
                  )}
                  {supplierBudget.slice(0, 5).map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => {
                        const supplier = suppliersFromTable.find((sup) => sup.name === s.name);
                        if (supplier && onSupplierClick) onSupplierClick(supplier);
                      }}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] transition-colors text-left"
                    >
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[90px]">{s.name}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatPrice(s.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ 5. ALL BILLS ═══════════ */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-1 ring-slate-200/60 dark:ring-slate-700/60">
            <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All Bills</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Individual bill records</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs px-3 py-1 h-6 font-medium ml-auto bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
        </Badge>
      </div>

      {filteredBills.length === 0 ? (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm overflow-hidden">
          <CardContent className="py-16 sm:py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No bills found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {statusFilter === 'all'
                ? 'No supplier bills match your current filters. Try adjusting your filters or add a new bill.'
                : `No ${statusFilter} bills found for the selected period.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Mobile: Compact cards ── */}
          <div className="lg:hidden grid gap-3">
            {filteredBills.map((bill) => {
              const daysUntilDue = getDaysUntilDue(bill.due_date);
              const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
              const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
              const billDay = DAY_NAMES[new Date(bill.created_at * 1000).getDay()];
              const { paymentMethod, paymentDetails } = getBillPaymentDisplay(bill);

              return (
                <Card
                  key={bill.id}
                  className={`bg-white dark:bg-[#1c2e18] overflow-hidden transition-all rounded-2xl shadow-sm hover:shadow-md ${
                    isOverdue
                      ? 'border-l-4 border-l-red-500 border border-slate-200/80 dark:border-slate-700/80'
                      : isDueSoon
                      ? 'border-l-4 border-l-amber-500 border border-slate-200/80 dark:border-slate-700/80'
                      : 'border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="space-y-2.5">
                      {/* Header: supplier name + amount + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              const supplier = suppliersFromTable.find(
                                (sup) => sup.name === bill.supplier_name
                              );
                              if (supplier && onSupplierClick) onSupplierClick(supplier);
                            }}
                            className="font-bold text-sm text-slate-900 dark:text-white truncate block max-w-full hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] transition-colors text-left"
                          >
                            {bill.supplier_name}
                          </button>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {bill.bill_description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatPrice(bill.amount)}
                          </p>
                          <div className="mt-1">{getStatusBadge(bill)}</div>
                        </div>
                      </div>

                      {/* Key details row */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className={`font-medium ${
                          isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-orange-600 dark:text-orange-400' : ''
                        }`}>
                          Due {formatDate(bill.due_date)}
                        </span>
                        <span>&middot;</span>
                        <span>{billDay} {formatDate(bill.created_at)}</span>
                        <span>&middot;</span>
                        <span>by {bill.creator_name}</span>
                      </div>

                      {/* Payment info */}
                      {(paymentMethod || paymentDetails) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/40 dark:border-emerald-800/30">
                          {paymentMethod && renderPaymentMethods(paymentMethod)}
                          {paymentDetails && (
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">
                              {paymentDetails}
                            </span>
                          )}
                        </div>
                      )}

                      {bill.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                          {bill.notes}
                        </p>
                      )}

                      {/* Actions */}
                      {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            onClick={() => setEditingBill(bill)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-slate-300 dark:border-slate-600 flex-1"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleMarkAsPaid(bill)}
                            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs flex-1"
                            size="sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Pay
                          </Button>
                          {canDeleteBills && (
                            <Button
                              onClick={() => handleDeleteBill(bill)}
                              variant="outline"
                              size="sm"
                              disabled={deletingBillId === bill.id}
                              className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                            >
                              {deletingBillId === bill.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Desktop: Table ── */}
          <Card className="hidden lg:block bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/80 overflow-hidden rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/60">
                    <th className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="text-right px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Due
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-3 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 [&>tr]:transition-colors [&>tr:hover]:bg-slate-50/80 dark:[&>tr:hover]:bg-slate-800/30">
                  {filteredBills.map((bill, i) => {
                    const daysUntilDue = getDaysUntilDue(bill.due_date);
                    const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
                    const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;
                    const billDay = DAY_NAMES[new Date(bill.created_at * 1000).getDay()];
                    const { paymentMethod, paymentDetails } = getBillPaymentDisplay(bill);

                    return (
                      <tr
                        key={bill.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors ${
                          i % 2 !== 0 ? 'bg-slate-50/30 dark:bg-slate-900/10' : ''
                        } ${
                          isOverdue
                            ? 'border-l-[3px] border-l-red-500'
                            : isDueSoon
                            ? 'border-l-[3px] border-l-orange-400'
                            : ''
                        }`}
                      >
                        {/* Supplier */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              const supplier = suppliersFromTable.find(
                                (sup) => sup.name === bill.supplier_name
                              );
                              if (supplier && onSupplierClick) onSupplierClick(supplier);
                            }}
                            className="font-medium text-slate-900 dark:text-white hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] hover:underline underline-offset-2 transition-colors text-left text-[13px]"
                          >
                            {bill.supplier_name}
                          </button>
                          {bill.supplier_phone && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{bill.supplier_phone}</p>
                          )}
                        </td>

                        {/* Description */}
                        <td className="px-3 py-3 max-w-[180px]">
                          <p className="text-slate-600 dark:text-slate-400 truncate text-[13px]" title={bill.bill_description}>
                            {bill.bill_description}
                          </p>
                        </td>

                        {/* Payment (combined method + details) */}
                        <td className="px-3 py-3 max-w-[200px]">
                          {(paymentMethod || paymentDetails) ? (
                            <div className="space-y-1">
                              {paymentMethod && renderPaymentMethods(paymentMethod)}
                              {paymentDetails && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line break-words">
                                  {paymentDetails}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatPrice(bill.amount)}
                        </td>

                        {/* Due */}
                        <td className="px-3 py-3">
                          <span
                            className={`text-[13px] font-medium ${
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

                        {/* Status */}
                        <td className="px-3 py-3">{getStatusBadge(bill)}</td>

                        {/* Created */}
                        <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <span className="text-[13px]">{formatDate(bill.created_at)}</span>
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {billDay} &middot; {bill.creator_name}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                onClick={() => setEditingBill(bill)}
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                onClick={() => handleMarkAsPaid(bill)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Pay
                              </Button>
                              {canDeleteBills && (
                                <Button
                                  onClick={() => handleDeleteBill(bill)}
                                  variant="ghost"
                                  size="sm"
                                  disabled={deletingBillId === bill.id}
                                  className="h-8 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  {deletingBillId === bill.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
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
              <Pencil className="w-5 h-5 text-[#1c6a1e]" />
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
