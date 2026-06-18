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
  FileDown,
  Copy,
  FilePen,
  Plus,
  X,
  Trash2,
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
  onReplicateBill?: (bill: SupplierBillWithDetails) => void;
}

export function SupplierBillsList({ onSupplierClick, onAddBill, onReplicateBill }: SupplierBillsListProps) {
  const { productTypes } = useItemTypes();
  const { user } = useCurrentUser();
  const canDeleteBills = user?.role === 'admin' || user?.role === 'owner';
  const [bills, setBills] = useState<SupplierBillWithDetails[]>([]);
  const [suppliersFromTable, setSuppliersFromTable] = useState<SupplierFromTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('last_30_days');
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
  const [pdfEditorState, setPdfEditorState] = useState<{
    bill: SupplierBillWithDetails;
    items: Array<{ id: string; description: string; quantity: string; unitPrice: string }>;
  } | null>(null);

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

  const escapeHtml = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const handleDownloadBillPDF = (
    bill: SupplierBillWithDetails,
    blankColumns = false,
    editedItems?: Array<{ description: string; quantity: string; unitPrice: string; total: number }>
  ) => {
    const items = editedItems ?? parseBillItems(bill.bill_description, bill.amount);
    const itemsHtml = items
      .map(
        (item) => `
      <tr>
        <td class="py-2 px-3 text-left text-sm">${escapeHtml(item.description)}</td>
        <td class="py-2 px-3 text-center text-sm">${blankColumns ? '' : escapeHtml(item.quantity)}</td>
        <td class="py-2 px-3 text-right text-sm">${blankColumns ? '' : formatPrice(parseFloat(item.unitPrice))}</td>
        <td class="py-2 px-3 text-right text-sm font-medium">${blankColumns ? '' : formatPrice(item.total)}</td>
      </tr>`
      )
      .join('');
    const title = blankColumns ? 'Order Template' : 'Order / Bill';
    const totalAmount = items.reduce((sum, i) => sum + (i.total ?? 0), 0);
    const totalHtml = blankColumns
      ? '<div class="total-row flex justify-between" style="display: flex; justify-content: space-between; margin-top: 16px;"><span>Total</span><span></span></div>'
      : `<div class="total-row flex justify-between" style="display: flex; justify-content: space-between; margin-top: 16px;"><span>Total</span><span>${formatPrice(totalAmount)}</span></div>`;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - ${escapeHtml(bill.supplier_name)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #1e293b; background: white; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { border-bottom: 2px solid #1c6a1e; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .header p { font-size: 11px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    th.text-right, td.text-right { text-align: right; }
    th.text-center, td.text-center { text-align: center; }
    .total-row { font-weight: 700; font-size: 14px; border-top: 2px solid #1c6a1e; padding-top: 12px; margin-top: 12px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div class="header">
      <h1>${title}</h1>
      <p><strong>${escapeHtml(bill.supplier_name)}</strong>${bill.supplier_phone ? ` · ${escapeHtml(bill.supplier_phone)}` : ''}</p>
      <p>${formatDate(bill.created_at)}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    ${totalHtml}
    ${bill.notes ? `<div class="footer">Notes: ${escapeHtml(bill.notes)}</div>` : ''}
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};</script>
</body>
</html>`);
    printWindow.document.close();
  };

  const openPdfEditor = (bill: SupplierBillWithDetails) => {
    const parsed = parseBillItems(bill.bill_description, bill.amount);
    setPdfEditorState({
      bill,
      items: parsed.map((p, i) => ({
        id: `pdf-edit-${i}-${Date.now()}`,
        description: p.description,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
      })),
    });
  };

  const updatePdfEditorItem = (id: string, field: 'description' | 'quantity' | 'unitPrice', value: string) => {
    if (!pdfEditorState) return;
    setPdfEditorState({
      ...pdfEditorState,
      items: pdfEditorState.items.map((it) =>
        it.id === id ? { ...it, [field]: value } : it
      ),
    });
  };

  const addPdfEditorItem = () => {
    if (!pdfEditorState) return;
    setPdfEditorState({
      ...pdfEditorState,
      items: [
        ...pdfEditorState.items,
        { id: `pdf-edit-new-${Date.now()}`, description: '', quantity: '1', unitPrice: '0' },
      ],
    });
  };

  const removePdfEditorItem = (id: string) => {
    if (!pdfEditorState) return;
    const next = pdfEditorState.items.filter((it) => it.id !== id);
    if (next.length === 0) return;
    setPdfEditorState({ ...pdfEditorState, items: next });
  };

  const getPdfEditorItemsForDownload = () => {
    if (!pdfEditorState) return undefined;
    return pdfEditorState.items
      .filter((it) => it.description.trim())
      .map((it) => {
        const qty = parseFloat(it.quantity) || 0;
        const unit = parseFloat(it.unitPrice) || 0;
        return {
          description: it.description.trim(),
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: qty * unit,
        };
      });
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

  const fetchBills = useCallback(async (background = false) => {
    try {
      if (!background) {
        setLoading(true);
        setError(null);
      }
      const result = await apiGet<SupplierBillWithDetails[]>(
        '/api/supplier-bills?includeOverdue=true'
      );
      if (result.success) {
        setBills(result.data || []);
        setError(null);
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
                await fetchBills(true);
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
        await fetchBills(true);
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
  const totalPending = filteredBills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((s, b) => s + b.amount, 0);
  const totalPaid = filteredBills
    .filter((b) => b.status === 'paid')
    .reduce((s, b) => s + b.amount, 0);

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

  const hasActiveFilters =
    statusFilter !== 'all' ||
    dateFilter !== 'last_30_days' ||
    supplierFilter !== 'all' ||
    dayOfWeekFilter !== 'all' ||
    typeFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setDateFilter('last_30_days');
    setSupplierFilter('all');
    setDayOfWeekFilter('all');
    setTypeFilter('all');
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 px-4 py-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 border-red-200 text-red-700 hover:bg-red-100"
            onClick={() => void fetchBills()}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Try again'}
          </Button>
        </div>
      )}

      {(overdueCount > 0 || dueSoonCount > 0) && !loading && (
        <div className="flex flex-wrap gap-2">
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('overdue')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors text-left text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-medium text-red-800 dark:text-red-200">
                {overdueCount} overdue · {formatPrice(overdueBills.reduce((s, b) => s + b.amount, 0))}
              </span>
            </button>
          )}
          {dueSoonCount > 0 && overdueCount === 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-left text-sm"
            >
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                {dueSoonCount} due within 3 days
              </span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-left hover:border-[#1c6a1e]/40 transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Bills</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{filteredBills.length}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2.5 text-left hover:opacity-90 transition-opacity"
        >
          <p className="text-[10px] uppercase tracking-wide text-amber-600">Pending</p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums">{formatPrice(totalPending)}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('paid')}
          className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2.5 text-left hover:opacity-90 transition-opacity"
        >
          <p className="text-[10px] uppercase tracking-wide text-emerald-600">Paid</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{formatPrice(totalPaid)}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('overdue')}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-left hover:border-red-300 transition-colors"
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Overdue</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">{overdueCount}</p>
        </button>
      </div>

      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { value: 'last_7_days', label: '7 days' },
              { value: 'last_30_days', label: '30 days' },
              { value: 'this_month', label: 'This month' },
              { value: 'all', label: 'All time' },
            ] as const
          ).map((p) => (
            <Button
              key={p.value}
              variant={dateFilter === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(p.value)}
              className={
                dateFilter === p.value
                  ? 'h-8 bg-[#1c6a1e] hover:bg-[#238b26] text-white'
                  : 'h-8 bg-white dark:bg-slate-900'
              }
            >
              {p.label}
            </Button>
          ))}
          <span className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          {(['all', 'pending', 'overdue', 'paid'] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className={
                statusFilter === s
                  ? s === 'overdue'
                    ? 'h-8 bg-red-600 hover:bg-red-700 text-white'
                    : s === 'pending'
                      ? 'h-8 bg-amber-600 hover:bg-amber-700 text-white'
                      : s === 'paid'
                        ? 'h-8 bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'h-8 bg-slate-700 text-white'
                  : 'h-8 bg-white dark:bg-slate-900'
              }
            >
              {s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {productTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs bg-white dark:bg-slate-900">
                <SelectValue placeholder="Type" />
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
            <SelectTrigger className="h-8 w-[160px] text-xs bg-white dark:bg-slate-900">
              <SelectValue placeholder="Supplier" />
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
            <SelectTrigger className="h-8 w-[120px] text-xs bg-white dark:bg-slate-900">
              <SelectValue placeholder="Day" />
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
            <SelectTrigger className="h-8 w-[130px] text-xs bg-white dark:bg-slate-900">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="last_week">Last week</SelectItem>
              <SelectItem value="last_7_days">Last 7 days</SelectItem>
              <SelectItem value="last_30_days">Last 30 days</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-slate-500 ml-auto" onClick={clearFilters}>
              <X className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>
        {dateRangeLabel && (
          <p className="text-xs text-slate-500">
            {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''} · {dateRangeLabel}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Suppliers to call</h3>
            </div>
            <Select value={String(callDaySelector)} onValueChange={(v) => setCallDaySelector(parseInt(v, 10))}>
              <SelectTrigger className="h-7 w-[120px] text-[10px]">
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
          <CardContent className="p-2 max-h-[180px] overflow-y-auto">
            {suppliersByDayLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : suppliersByDay && suppliersByDay.byDay[callDaySelector]?.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliersByDay.byDay[callDaySelector].map((s) => {
                  const supplier = suppliersFromTable.find(
                    (sup) => sup.name === s.supplierName || sup.id === s.supplierId
                  );
                  return (
                    <li key={s.supplierId || s.supplierName}>
                      <button
                        type="button"
                        onClick={() => supplier && onSupplierClick?.(supplier)}
                        className="flex items-center justify-between w-full px-2 py-2 text-left hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 rounded-md"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                          {s.supplierName}
                        </span>
                        {s.supplierPhone ? (
                          <a
                            href={`tel:${s.supplierPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-emerald-600 shrink-0 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            Call
                          </a>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                No orders on {DAY_NAMES[callDaySelector]}s (90d)
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('due_today')}
              className="rounded-lg border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 text-left hover:bg-amber-50"
            >
              <p className="text-[10px] text-amber-600 uppercase">Due today</p>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mt-0.5">
                {dueTodayBills.length} · {formatPrice(dueTodayBills.reduce((s, b) => s + b.amount, 0))}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('due_this_week')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <p className="text-[10px] text-slate-500 uppercase">Due this week</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {dueThisWeekBills.length} · {formatPrice(dueThisWeekBills.reduce((s, b) => s + b.amount, 0))}
              </p>
            </button>
            <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10 p-2.5">
              <p className="text-[10px] text-emerald-600 uppercase">Paid this month</p>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mt-0.5">
                {paidThisMonth.length} · {formatPrice(paidThisMonthTotal)}
              </p>
            </div>
            {whoYouOweMost ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5">
                <p className="text-[10px] text-slate-500 uppercase">Owe most</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                  {whoYouOweMost.name}
                </p>
                <p className="text-[10px] text-slate-500">{formatPrice(whoYouOweMost.amount)}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-center">
                <p className="text-[10px] text-slate-400">No unpaid bills</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bills table */}
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {loading && bills.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#1c6a1e]" />
              <p className="text-sm text-slate-500">Loading bills…</p>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-medium text-slate-900 dark:text-white">No bills found</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {statusFilter === 'all' && dateFilter === 'all'
                  ? 'Record your first supplier bill to get started.'
                  : 'Try a wider date range or different status filter.'}
              </p>
              {onAddBill && (
                <Button onClick={onAddBill} className="mt-4 bg-[#1c6a1e] hover:bg-[#238b26] text-white" size="sm">
                  Add a bill
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
              <table className="w-full text-sm min-w-[880px]">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Supplier
                    </th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden xl:table-cell">
                      Payment
                    </th>
                    <th className="text-right px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Due
                    </th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">
                      Created
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
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

                        {/* Payment */}
                        <td className="px-3 py-2.5 max-w-[200px] hidden xl:table-cell">
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
                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap hidden md:table-cell">
                          <span className="text-[13px]">{formatDate(bill.created_at)}</span>
                          <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {billDay} &middot; {bill.creator_name}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <Button
                              onClick={() => openPdfEditor(bill)}
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-[#1c6a1e] hover:text-[#238b26] dark:text-[#2a8a30]"
                              title="Edit & Download"
                            >
                              <FilePen className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              onClick={() => handleDownloadBillPDF(bill)}
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400"
                              title="Download PDF"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              onClick={() => handleDownloadBillPDF(bill, true)}
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400"
                              title="Download blank template (Qty, Unit Price, Total empty)"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            {onReplicateBill && (
                              <Button
                                onClick={() => onReplicateBill(bill)}
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-[#1c6a1e] hover:text-[#238b26] dark:text-[#2a8a30]"
                                title="Replicate order"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                              <>
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
                              </>
                            )}
                          </div>
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
                  await fetchBills(true);
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
                  <div className="flex flex-wrap gap-2 pt-4">
                    <Button
                      onClick={() => {
                        openPdfEditor(viewingBillItems);
                        setViewingBillItems(null);
                      }}
                      className="bg-[#1c6a1e] hover:bg-[#238b26] text-white"
                    >
                      <FilePen className="w-4 h-4 mr-2" />
                      Edit & Download
                    </Button>
                    <Button
                      onClick={() => handleDownloadBillPDF(viewingBillItems)}
                      variant="outline"
                      size="sm"
                      className="border-slate-300 dark:border-slate-600"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button
                      onClick={() => handleDownloadBillPDF(viewingBillItems, true)}
                      variant="outline"
                      size="sm"
                      className="border-slate-300 dark:border-slate-600"
                      title="Download with blank Qty, Unit Price, and Total for supplier to fill"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Download blank
                    </Button>
                    {onReplicateBill && (
                      <Button
                        onClick={() => {
                          onReplicateBill(viewingBillItems);
                          setViewingBillItems(null);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-[#1c6a1e]/50 text-[#1c6a1e] hover:bg-[#1c6a1e]/10 dark:border-[#2a8a30]/50 dark:text-[#2a8a30]"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Replicate order
                      </Button>
                    )}
                    {viewingBillItems.status !== 'paid' && viewingBillItems.status !== 'cancelled' && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ═══════════ PDF EDITOR DRAWER (Edit before download) ═══════════ */}
      <Drawer open={!!pdfEditorState} onOpenChange={(open) => !open && setPdfEditorState(null)} direction="right">
        <DrawerContent className="!w-full sm:!w-[560px] !max-w-full h-full max-h-screen z-[53] rounded-l-2xl">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 relative pr-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPdfEditorState(null)}
              className="absolute right-4 top-4 h-10 w-10 rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="pr-8">
              <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <FilePen className="w-5 h-5 text-[#1c6a1e]" />
                Edit before download
              </DrawerTitle>
              <DrawerDescription className="text-slate-600 dark:text-slate-400 mt-1">
                {pdfEditorState && (
                  <>Adjust items, then download PDF. Changes are for the PDF only.</>
                )}
              </DrawerDescription>
            </div>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {pdfEditorState && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {pdfEditorState.bill.supplier_name}
                </p>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                  <div className="min-w-[420px]">
                    <div className="grid grid-cols-[1fr_70px_90px_90px_40px] gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/60 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Item</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Unit</span>
                      <span className="text-right">Total</span>
                      <span></span>
                    </div>
                    {pdfEditorState.items.map((item) => {
                      const qty = parseFloat(item.quantity) || 0;
                      const unit = parseFloat(item.unitPrice) || 0;
                      const total = qty * unit;
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_70px_90px_90px_40px] gap-2 items-center px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40"
                        >
                        <Input
                          value={item.description}
                          onChange={(e) => updatePdfEditorItem(item.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="h-8 text-sm border-slate-200 dark:border-slate-600"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updatePdfEditorItem(item.id, 'quantity', e.target.value)}
                          className="h-8 text-sm text-center border-slate-200 dark:border-slate-600"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updatePdfEditorItem(item.id, 'unitPrice', e.target.value)}
                          className="h-8 text-sm text-right border-slate-200 dark:border-slate-600"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right">
                          {formatPrice(total)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePdfEditorItem(item.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPdfEditorItem}
                  className="w-full border-dashed border-slate-300 dark:border-slate-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add item
                </Button>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {formatPrice(
                      pdfEditorState.items.reduce((s, it) => {
                        const q = parseFloat(it.quantity) || 0;
                        const u = parseFloat(it.unitPrice) || 0;
                        return s + q * u;
                      }, 0)
                    )}
                  </span>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      const items = getPdfEditorItemsForDownload();
                      if (items && items.length > 0) {
                        handleDownloadBillPDF(pdfEditorState.bill, false, items);
                        setPdfEditorState(null);
                      } else {
                        toast.error('Add at least one item with a description');
                      }
                    }}
                    className="flex-1 bg-[#1c6a1e] hover:bg-[#238b26] text-white"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button
                    onClick={() => {
                      const items = getPdfEditorItemsForDownload();
                      if (items && items.length > 0) {
                        handleDownloadBillPDF(pdfEditorState.bill, true, items);
                        setPdfEditorState(null);
                      } else {
                        toast.error('Add at least one item with a description');
                      }
                    }}
                    variant="outline"
                    className="border-slate-300 dark:border-slate-600"
                  >
                    <FilePen className="w-4 h-4 mr-2" />
                    Download blank
                  </Button>
                </div>
              </div>
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
