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
  Phone,
  PhoneCall,
  Package,
  ListChecks,
} from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/utils/api-client';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { toast } from 'sonner';
import { SupplierBillForm, type SupplierBillInitialData } from '@/components/admin/SupplierBillForm';
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

/** Parse bill_description (from formatBillDescription) into structured items for display */
function parseBillItems(text: string, totalAmount: number): Array<{ description: string; quantity: string; unitPrice: string; total: number }> {
  if (!text?.trim()) {
    return [{ description: text?.trim() || 'Item', quantity: '1', unitPrice: String(totalAmount), total: totalAmount }];
  }
  const priceSuffixRegex = /\s*-\s*(\d+(?:\.\d+)?)\s+×\s+KES\s+([\d.]+)\s+=\s+KES\s+([\d.]+)\s*$/;
  const parts = text.split(/\s*(?=\d+\.\s)/).filter((p) => p.trim());
  const items: Array<{ description: string; quantity: string; unitPrice: string; total: number }> = [];

  for (const part of parts) {
    const cleaned = part.trim().replace(/^\d+\.\s*/, '');
    const match = cleaned.match(priceSuffixRegex);
    if (match) {
      const [, qty, unitPrice, totalStr] = match;
      const description = cleaned.replace(priceSuffixRegex, '').trim();
      if (description) {
        items.push({ description, quantity: qty, unitPrice, total: parseFloat(totalStr) });
      }
    }
  }

  if (items.length === 0) {
    const singleMatch = text.match(/^([\s\S]+?)\s*\((\d+(?:\.\d+)?)\s+×\s+KES\s+([\d.]+)\s+=\s+KES\s+([\d.]+)\)\s*$/);
    if (singleMatch) {
      const [, description, qty, unitPrice, totalStr] = singleMatch;
      if (description?.trim()) {
        items.push({ description: description.trim(), quantity: qty, unitPrice, total: parseFloat(totalStr) });
      }
    }
  }

  if (items.length === 0) {
    items.push({ description: text.trim(), quantity: '1', unitPrice: String(totalAmount), total: totalAmount });
  }
  return items;
}

// ── Component ──────────────────────────────────────────

interface SupplierBillsListProps {
  onSupplierClick?: (supplier: SupplierFromTable) => void;
  onAddBill?: () => void;
}

export function SupplierBillsList({ onSupplierClick, onAddBill }: SupplierBillsListProps) {
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
  const [viewingBillItems, setViewingBillItems] = useState<SupplierBillWithDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  const [suppliersByDay, setSuppliersByDay] = useState<{
    byDay: Record<number, Array<{
      supplierName: string;
      supplierId: string | null;
      supplierPhone: string | null;
    }>>;
    lookbackDays: number;
  } | null>(null);
  const [suppliersByDayLoading, setSuppliersByDayLoading] = useState(false);
  const [callDaySelector, setCallDaySelector] = useState<number>(() => new Date().getDay());

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

  const getDueLabel = (dueDate: number) => {
    const d = getDaysUntilDue(dueDate);
    if (d < 0) return `Overdue ${Math.abs(d)}d`;
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    if (d <= 7) return `Due in ${d}d`;
    return null;
  };

  const getStatusBadge = (bill: SupplierBillWithDetails) => {
    const daysUntilDue = getDaysUntilDue(bill.due_date);
    if (bill.status === 'paid') {
      return (
        <Badge className="bg-emerald-500/90 hover:bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-medium">
          <CheckCircle className="w-2.5 h-2.5 mr-1" />
          Paid
        </Badge>
      );
    }
    if (bill.status === 'overdue' || daysUntilDue < 0) {
      return (
        <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-medium">
          <AlertTriangle className="w-2.5 h-2.5 mr-1" />
          Overdue
        </Badge>
      );
    }
    if (daysUntilDue <= 3) {
      return (
        <Badge className="bg-amber-500/90 hover:bg-amber-600 text-white text-[10px] px-2 py-0.5 font-medium">
          <Clock className="w-2.5 h-2.5 mr-1" />
          Due Soon ({daysUntilDue}d)
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-500/90 hover:bg-slate-600 text-white text-[10px] px-2 py-0.5 font-medium">
        <Calendar className="w-2.5 h-2.5 mr-1" />
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
      // Always fetch all bills; status filtering is done client-side to avoid API/client mismatch
      const result = await apiGet<SupplierBillWithDetails[]>(
        '/api/supplier-bills?includeOverdue=true'
      );
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
  }, []);

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

  // Fetch suppliers by day of week (for "call today" section)
  useEffect(() => {
    setSuppliersByDayLoading(true);
    apiGet<{ byDay: Record<number, Array<{
      supplierName: string;
      supplierId: string | null;
      supplierPhone: string | null;
    }>>; lookbackDays: number }>('/api/supplier-bills/by-day-of-week?lookback=90')
      .then((res) => {
        if (res.success && res.data) setSuppliersByDay(res.data);
      })
      .catch(() => {})
      .finally(() => setSuppliersByDayLoading(false));
  }, []);

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
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 shadow-sm">
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
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 shadow-sm">
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
        const d = getDaysUntilDue(bill.due_date);
        if (statusFilter === 'pending') {
          if (!(bill.status === 'pending' && d >= 0)) return false;
        } else if (statusFilter === 'overdue') {
          if (!(bill.status === 'overdue' || (bill.status === 'pending' && d < 0))) return false;
        } else if (statusFilter === 'due_today') {
          if (bill.status === 'paid' || d !== 0) return false;
        } else if (statusFilter === 'due_this_week') {
          if (bill.status === 'paid' || d < 0 || d > 6) return false;
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

  const overdueCount = filteredBills.filter((b) => b.status !== 'paid' && (b.status === 'overdue' || getDaysUntilDue(b.due_date) < 0)).length;
  const overdueBills = filteredBills.filter((b) => b.status !== 'paid' && (b.status === 'overdue' || getDaysUntilDue(b.due_date) < 0));
  const dueSoonCount = filteredBills.filter((b) => {
    const d = getDaysUntilDue(b.due_date);
    return b.status !== 'paid' && d >= 0 && d <= 3;
  }).length;

  // Insights (from all bills, not filtered)
  const unpaidBills = bills.filter((b) => b.status !== 'paid');
  const dueTodayBills = unpaidBills.filter((b) => getDaysUntilDue(b.due_date) === 0);
  const dueThisWeekBills = unpaidBills.filter((b) => {
    const d = getDaysUntilDue(b.due_date);
    return d >= 0 && d <= 6;
  });
  const whoYouOweMost = (() => {
    const bySupplier: Record<string, number> = {};
    unpaidBills.forEach((b) => {
      const name = b.supplier_name || 'Unknown';
      bySupplier[name] = (bySupplier[name] || 0) + b.amount;
    });
    const sorted = Object.entries(bySupplier).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  })();
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  const paidThisMonth = bills.filter((b) => b.status === 'paid' && b.payment_date != null && b.payment_date >= monthStart);
  const paidThisMonthTotal = paidThisMonth.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-6">
      {/* ═══════════ ALERTS (overdue / due soon) ═══════════ */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-left w-full sm:w-auto"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                {overdueCount} overdue bill{overdueCount !== 1 ? 's' : ''} — {formatPrice(overdueBills.reduce((s, b) => s + b.amount, 0))}
              </span>
            </button>
          )}
          {dueSoonCount > 0 && overdueCount === 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors text-left w-full sm:w-auto"
            >
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {dueSoonCount} bill{dueSoonCount !== 1 ? 's' : ''} due in 3 days or less
              </span>
            </button>
          )}
        </div>
      )}

      {/* ═══════════ FILTERS ═══════════ */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Filters
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
            {dateRangeLabel && <span> · {dateRangeLabel}</span>}
            {statusFilter !== 'all' && (
              <span> · {statusFilter === 'due_today' ? 'Due today' : statusFilter === 'due_this_week' ? 'Due this week' : statusFilter}</span>
            )}
            {typeFilter !== 'all' && (() => {
              const tc = productTypes.find((t) => t.key === typeFilter);
              return (
                <span> · {tc?.emoji} {tc?.label ?? typeFilter}</span>
              );
            })()}
            {supplierFilter !== 'all' && <span> · {supplierFilter}</span>}
            {dayOfWeekFilter !== 'all' && (
              <span> · {DAY_NAMES[parseInt(dayOfWeekFilter, 10)]}s</span>
            )}
          </p>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-3 overflow-x-auto scrollbar-none bg-slate-50/80 dark:bg-slate-900/20">
          {productTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="min-w-[110px] sm:w-36 h-9 text-xs sm:text-sm shrink-0 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-lg">
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
            <SelectTrigger className="min-w-[130px] sm:w-44 h-9 text-xs sm:text-sm shrink-0 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-lg">
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
            <SelectTrigger className="min-w-[100px] sm:w-36 h-9 text-xs sm:text-sm shrink-0 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-lg">
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
            <SelectTrigger className="min-w-[120px] sm:w-40 h-9 text-xs sm:text-sm shrink-0 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-lg">
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
            <SelectTrigger className="min-w-[90px] sm:w-32 h-9 text-xs sm:text-sm shrink-0 bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_today">Due today</SelectItem>
              <SelectItem value="due_this_week">Due this week</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ═══════════ TOP ROW: Suppliers to call + Overview ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suppliers to call */}
        <section className="lg:col-span-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Suppliers to call</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Based on order history</p>
              </div>
            </div>
            <Select
              value={String(callDaySelector)}
              onValueChange={(v) => setCallDaySelector(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[130px] h-9 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_ORDER.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {DAY_NAMES[d]}
                    {d === new Date().getDay() && ' (today)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 max-h-[300px] overflow-y-auto">
            {suppliersByDayLoading ? (
              <div className="flex items-center gap-2 py-8 text-slate-500 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : suppliersByDay && suppliersByDay.byDay[callDaySelector]?.length > 0 ? (
              <ul className="space-y-0.5">
                {suppliersByDay.byDay[callDaySelector].map((s) => {
                  const supplier = suppliersFromTable.find(
                    (sup) => sup.name === s.supplierName || sup.id === s.supplierId
                  );
                  return (
                    <li key={s.supplierId || s.supplierName}>
                      <button
                        type="button"
                        onClick={() => supplier && onSupplierClick?.(supplier)}
                        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 hover:shadow-sm transition-all duration-200 text-left group"
                      >
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate pr-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                          {s.supplierName}
                        </span>
                        {s.supplierPhone ? (
                          <a
                            href={`tel:${s.supplierPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0 transition-colors"
                          >
                            <Phone className="w-3 h-3 group-hover:scale-110 transition-transform" />
                            {s.supplierPhone}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">—</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                No orders on {DAY_NAMES[callDaySelector]}s (last 90 days)
              </p>
            )}
          </div>
        </section>

        {/* Overview */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#1c6a1e] dark:text-[#2a8a30]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Overview</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{dateRangeLabel || 'All time'}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-5">
              {/* Insight banner */}
              {(dueTodayBills.length > 0 || overdueCount > 0 || whoYouOweMost) && (
                <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-3 text-sm">
                  {overdueCount > 0 && (
                    <p className="text-amber-800 dark:text-amber-200">
                      <span className="font-medium">{overdueCount} overdue</span> — {formatPrice(overdueBills.reduce((s, b) => s + b.amount, 0))} total. Clear these first.
                    </p>
                  )}
                  {overdueCount === 0 && dueTodayBills.length > 0 && (
                    <p className="text-amber-800 dark:text-amber-200">
                      <span className="font-medium">{dueTodayBills.length} due today</span> — {formatPrice(dueTodayBills.reduce((s, b) => s + b.amount, 0))}
                    </p>
                  )}
                  {overdueCount === 0 && dueTodayBills.length === 0 && whoYouOweMost && unpaidBills.length > 0 && (
                    <p className="text-amber-800 dark:text-amber-200">
                      <span className="font-medium">Top creditor:</span> {whoYouOweMost.name} — {formatPrice(whoYouOweMost.amount)}
                    </p>
                  )}
                </div>
              )}

              {/* Payment pipeline */}
              {totalAmount > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Payment pipeline</p>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="bg-red-400 dark:bg-red-500 transition-all"
                      style={{ width: `${Math.min(100, (overdueBills.reduce((s, b) => s + b.amount, 0) / totalAmount) * 100)}%` }}
                    />
                    <div
                      className="bg-amber-400 dark:bg-amber-500 transition-all"
                      style={{ width: `${Math.min(100, ((totalPending - overdueBills.reduce((s, b) => s + b.amount, 0)) / totalAmount) * 100)}%` }}
                    />
                    <div
                      className="bg-emerald-400 dark:bg-emerald-500 transition-all"
                      style={{ width: `${(totalPaid / totalAmount) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" /> Overdue</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" /> Pending</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> Paid</span>
                  </div>
                </div>
              )}

              {/* Row 1: Bills stats (clickable) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { icon: FileText, label: 'Bills', value: filteredBills.length, color: 'slate', onClick: () => setStatusFilter('all') },
                  { icon: null, label: 'Total', value: formatPrice(totalAmount), color: 'slate', onClick: () => setStatusFilter('all') },
                  { icon: Clock, label: 'Pending', value: formatPrice(totalPending), color: 'amber', onClick: () => setStatusFilter('pending') },
                  { icon: CheckCircle, label: 'Paid', value: formatPrice(totalPaid), color: 'emerald', onClick: () => setStatusFilter('paid') },
                  { icon: Calendar, label: 'Avg/wk', value: formatPrice(totalAmount / spanWeeks), color: 'slate', onClick: undefined },
                ].map((stat) => {
                  const Icon = stat.icon;
                  const bgClass = stat.color === 'amber' ? 'bg-amber-50 dark:bg-amber-950/20' : stat.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-slate-50 dark:bg-slate-800/50';
                  const valueClass = stat.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : stat.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white';
                  const iconClass = stat.color === 'amber' ? 'text-amber-500 dark:text-amber-400' : stat.color === 'emerald' ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400';
                  const Wrapper = stat.onClick ? 'button' : 'div';
                  return (
                    <Wrapper
                      key={stat.label}
                      type={stat.onClick ? 'button' : undefined}
                      onClick={stat.onClick}
                      className={`flex w-full items-center gap-2.5 p-3 rounded-xl ${bgClass} transition-colors hover:opacity-90 text-left ${stat.onClick ? 'cursor-pointer hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600' : ''}`}
                    >
                      {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${iconClass}`} />}
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.label}</p>
                        <p className={`text-xs font-medium truncate ${valueClass}`}>{stat.value}</p>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>

              {/* Row 2: Due today, Due this week, Paid this month, Who you owe most */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setStatusFilter('due_today')}
                  className="flex flex-col gap-0.5 rounded-lg border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 text-left transition hover:bg-amber-50 dark:hover:bg-amber-950/20"
                >
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wide">Due today</p>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">{dueTodayBills.length} · {formatPrice(dueTodayBills.reduce((s, b) => s + b.amount, 0))}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('due_this_week')}
                  className="flex flex-col gap-0.5 rounded-lg border border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/50"
                >
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Due this week</p>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{dueThisWeekBills.length} · {formatPrice(dueThisWeekBills.reduce((s, b) => s + b.amount, 0))}</p>
                </button>
                <div className="flex flex-col gap-0.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10 p-2.5">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Paid this month</p>
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{paidThisMonth.length} · {formatPrice(paidThisMonthTotal)}</p>
                </div>
                {whoYouOweMost && (
                  <div className="flex flex-col gap-0.5 rounded-lg border border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30 p-2.5">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">You owe most</p>
                    <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{whoYouOweMost.name}</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">{formatPrice(whoYouOweMost.amount)}</p>
                  </div>
                )}
              </div>

              {/* Row 2: Top suppliers + weekly budget */}
              {(supplierBudget.length > 0 || deliveryMatrix.weeklyBudget > 0) && (
                <div className="pt-5 border-t border-slate-200/80 dark:border-slate-700/80">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Top suppliers</p>
                  <div className="flex flex-wrap gap-2">
                  {deliveryMatrix.weeklyBudget > 0 && (
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <Truck className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">This week</span>
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{formatPrice(deliveryMatrix.weeklyBudget)}</span>
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
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 transition-all text-left"
                    >
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{s.name}</span>
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatPrice(s.total)}</span>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ═══════════ ALL BILLS ═══════════ */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All Bills</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Individual records</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs px-3 py-1 font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
          </Badge>
        </div>

      {filteredBills.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
          <div className="py-16 sm:py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No bills found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {statusFilter === 'all' && dateFilter === 'all'
                ? 'Record your first supplier bill to get started.'
                : statusFilter === 'all'
                ? 'No bills in this period. Try a different date range or add a new bill.'
                : statusFilter === 'due_today'
                ? 'No bills due today.'
                : statusFilter === 'due_this_week'
                ? 'No bills due this week.'
                : `No ${statusFilter} bills for the selected period.`}
            </p>
            {onAddBill && (
              <Button
                onClick={onAddBill}
                className="mt-4 bg-[#1c6a1e] hover:bg-[#238b26] text-white text-sm font-medium"
              >
                Add a bill
              </Button>
            )}
          </div>
        </div>
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
                  className={`bg-white dark:bg-slate-900/40 overflow-hidden transition-all rounded-2xl border shadow-sm hover:shadow-md ${
                    isOverdue
                      ? 'border-l-4 border-l-red-500 border-slate-200/80 dark:border-slate-700/80'
                      : isDueSoon
                      ? 'border-l-4 border-l-amber-500 border-slate-200/80 dark:border-slate-700/80'
                      : 'border-slate-200/80 dark:border-slate-700/80'
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
                          <button
                            type="button"
                            onClick={() => setViewingBillItems(bill)}
                            className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 block max-w-full text-left hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] hover:underline transition-colors flex items-center gap-1"
                          >
                            <Package className="w-3 h-3 shrink-0" />
                            {bill.bill_description}
                          </button>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-slate-900 dark:text-white">
                            {formatPrice(bill.amount)}
                          </p>
                          <div className="mt-1">{getStatusBadge(bill)}</div>
                        </div>
                      </div>

                      {/* Key details row */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className={`font-medium ${
                          isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-orange-600 dark:text-orange-400' : daysUntilDue === 0 ? 'text-amber-600 dark:text-amber-400' : ''
                        }`}>
                          {bill.status === 'paid'
                            ? formatDate(bill.due_date)
                            : getDueLabel(bill.due_date)
                            ? <><span>{getDueLabel(bill.due_date)}</span><span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({formatDate(bill.due_date)})</span></>
                            : `Due ${formatDate(bill.due_date)}`}
                        </span>
                        <span>&middot;</span>
                        <span>{billDay}</span>
                        {bill.supplier_phone && (
                          <>
                            <span>&middot;</span>
                            <a
                              href={`tel:${bill.supplier_phone}`}
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              Call
                            </a>
                          </>
                        )}
                        <span>&middot;</span>
                        <span className="text-slate-400 dark:text-slate-500">by {bill.creator_name}</span>
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
          <div className="hidden lg:block rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
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
                          <button
                            type="button"
                            onClick={() => setViewingBillItems(bill)}
                            className="text-slate-600 dark:text-slate-400 truncate text-[13px] text-left hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] hover:underline transition-colors flex items-center gap-1.5 max-w-full"
                            title="View items"
                          >
                            <Package className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{bill.bill_description}</span>
                          </button>
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
                        <td className="px-3 py-3 text-right text-xs font-medium text-slate-900 dark:text-white whitespace-nowrap">
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
                                : daysUntilDue === 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {bill.status !== 'paid' && getDueLabel(bill.due_date)
                              ? getDueLabel(bill.due_date)
                              : formatDate(bill.due_date)}
                          </span>
                          {bill.status !== 'paid' && getDueLabel(bill.due_date) && (
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-normal mt-0.5">{formatDate(bill.due_date)}</span>
                          )}
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
          </div>
        </>
      )}
      </section>

      {/* ═══════════ EDIT BILL DRAWER (same form as new bill) ═══════════ */}
      <Drawer
        open={!!editingBill}
        onOpenChange={(open) => !open && setEditingBill(null)}
        direction="right"
      >
        <DrawerContent className="!w-full sm:!w-[900px] !max-w-none h-full max-h-screen z-[51] rounded-l-2xl">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-[#1c2e18] relative pr-12">
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
              {editingBill && (
                <span className="text-sm font-normal text-slate-500">
                  — {editingBill.supplier_name}
                </span>
              )}
            </DrawerTitle>
            <DrawerDescription className="text-slate-600 dark:text-slate-400">
              {editingBill && <>Update details for bill from {editingBill.supplier_name}</>}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            {editingBill && (
              <SupplierBillForm
                key={editingBill.id}
                billId={editingBill.id}
                initialData={
                  {
                    supplierId: editingBill.supplier_id,
                    supplierName: editingBill.supplier_name,
                    supplierPhone: editingBill.supplier_phone ?? '',
                    billDescription: editingBill.bill_description,
                    amount: editingBill.amount,
                    dueDate: editingBill.due_date,
                    notes: editingBill.notes ?? '',
                    preferredPaymentMethod: editingBill.preferred_payment_method ?? null,
                    paymentDetails: editingBill.payment_details ?? null,
                  } satisfies SupplierBillInitialData
                }
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

      {/* ═══════════ BILL ITEMS DRAWER (View & Edit) ═══════════ */}
      <Drawer open={!!viewingBillItems} onOpenChange={(open) => !open && setViewingBillItems(null)} direction="right">
        <DrawerContent className="!w-full sm:!w-[480px] !max-w-full h-full max-h-screen z-[52] rounded-l-2xl">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 relative pr-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewingBillItems(null)}
              className="absolute right-4 top-4 h-10 w-10 rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="pr-8">
              <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <ListChecks className="w-5 h-5 text-[#1c6a1e]" />
                Bill items
              </DrawerTitle>
              <DrawerDescription className="text-slate-600 dark:text-slate-400 mt-1">
                {viewingBillItems && (
                  <>
                    {viewingBillItems.supplier_name} · {formatPrice(viewingBillItems.amount)}
                  </>
                )}
              </DrawerDescription>
            </div>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {viewingBillItems && (() => {
              const items = parseBillItems(viewingBillItems.bill_description, viewingBillItems.amount);
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-slate-900/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {item.description}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.quantity} × {formatPrice(parseFloat(item.unitPrice))}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">
                          {formatPrice(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatPrice(viewingBillItems.amount)}
                    </span>
                  </div>
                  {viewingBillItems.status !== 'paid' && viewingBillItems.status !== 'cancelled' && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => {
                          setViewingBillItems(null);
                          setEditingBill(viewingBillItems);
                        }}
                        className="flex-1 bg-[#1c6a1e] hover:bg-[#238b26] text-white"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit bill
                      </Button>
                      <Button
                        onClick={() => {
                          setViewingBillItems(null);
                          handleMarkAsPaid(viewingBillItems);
                        }}
                        variant="outline"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark as paid
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
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
        <DialogContent className="sm:max-w-md flex max-h-[90vh] flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Mark Bill as Paid</DialogTitle>
            <DialogDescription>
              Confirm this bill has been paid. Add payment details below if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-4">
            {markAsPaidDialog.bill && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Bill
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {markAsPaidDialog.bill.supplier_name}
                    </p>
                    {markAsPaidDialog.bill.bill_description && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {markAsPaidDialog.bill.bill_description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const bill = markAsPaidDialog.bill;
                        if (bill) {
                          setMarkAsPaidDialog({ open: false, bill: null });
                          setViewingBillItems(bill);
                        }
                      }}
                      className="mt-2 text-[11px] text-[#1c6a1e] dark:text-[#2a8a30] hover:underline flex items-center gap-1"
                    >
                      <ListChecks className="w-3 h-3" />
                      View items
                    </button>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Amount</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatPrice(markAsPaidDialog.bill.amount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Payment details <span className="font-normal">(optional)</span>
              </p>
              <div className="space-y-4 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/30 p-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Payment method
                  </Label>
                  <Input
                    id="paymentMethod"
                    placeholder="e.g. Cash, M-Pesa, Bank Transfer"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentNotes" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Notes
                  </Label>
                  <Input
                    id="paymentNotes"
                    placeholder="Any additional notes about the payment"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
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
