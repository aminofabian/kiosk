'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Receipt,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  Building2,
  Phone,
  Search,
  Package,
  TrendingUp,
  ArrowRight,
  Warehouse,
  Tag,
  X,
  Calendar,
  Link2,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
  HandCoins,
  Repeat,
  Store,
  ScanBarcode,
  RotateCcw,
  Layers,
  Wallet,
  CircleCheck,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/utils/api-client';
import type { SupplierBill } from '@/lib/db/types';
import { getItemDisplayName } from '@/lib/utils';
import { generateSupplierBatchNumber } from '@/lib/utils/batch-number-shared';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  location?: string | null;
  notes?: string | null;
  supplier_type?: string | null;
  preferred_payment_method?: string | null;
  payment_details?: string | null;
  /** When supplier has unpaid bills */
  owed_amount?: number;
  owed_payment_details?: string | null;
  owed_payment_method?: string | null;
}

interface BillLineItem {
  id: string;
  description: string;
  quantity: string;
  amount: string; // unit price (per individual item)
  packages: string; // number of packaging units ordered (e.g., 10 cartons)
  packagingUnitName: string; // e.g., "Carton", "Sack" - editable inline
  packagingUnitQty: string; // items per package as string for input (e.g., "18")
  itemId?: string; // linked product item ID (for stock updates)
  batchNumber?: string; // optional custom batch/lot number (e.g. TOM-20260308-01)
  expiryDate?: string; // optional expiry date as YYYY-MM-DD string
  currentStock?: number; // current stock level (display only)
  unitType?: string; // e.g. kg, piece (display only)
  sellPrice?: number; // current sell price (display only)
  showPackaging?: boolean; // UI: whether packaging row is expanded
  priceSource?: 'default' | 'last'; // when prefilled: from supplier default or last purchase
}

export interface SupplierBillInitialData {
  supplierId: string | null;
  supplierName: string;
  supplierPhone: string;
  billDescription: string;
  amount: number;
  dueDate: number; // Unix seconds
  notes: string;
  preferredPaymentMethod: string | null;
  paymentDetails: string | null;
}

interface SupplierBillFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preSelectedSupplierId?: string;
  linkedProductsRefreshKey?: number;
  onOpenManageLinkProducts?: (supplier: Supplier) => void;
  /** Edit mode: when set, form pre-fills from initialData and submits via PATCH */
  billId?: string;
  initialData?: SupplierBillInitialData;
}

interface LinkedProduct {
  item_id: string;
  item_name: string;
  variant_name: string | null;
  unit_type: string;
  current_stock: number;
  current_sell_price: number;
  default_cost_price: number | null;
  last_buy_price: number | null;
  packaging_unit_name: string | null;
  packaging_unit_qty: number | null;
}

const SUPPLIER_BILL_DRAFT_KEY = 'supplier-bill-draft';

interface SupplierBillDraft {
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  lineItems: Pick<BillLineItem, 'id' | 'description' | 'quantity' | 'amount' | 'packages' | 'packagingUnitName' | 'packagingUnitQty' | 'itemId' | 'batchNumber' | 'expiryDate' | 'currentStock' | 'unitType' | 'sellPrice' | 'showPackaging'>[];
  dueDateTime: string;
  notes: string;
  useManualSupplier: boolean;
  selectedPaymentMethods: string[];
  paymentDetails: string;
}

function loadDraft(): SupplierBillDraft | null {
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(SUPPLIER_BILL_DRAFT_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupplierBillDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.lineItems) || parsed.lineItems.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(draft: SupplierBillDraft) {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SUPPLIER_BILL_DRAFT_KEY, JSON.stringify(draft));
    }
  } catch {
    // Ignore storage errors
  }
}

function clearDraft() {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SUPPLIER_BILL_DRAFT_KEY);
    }
  } catch {
    // Ignore
  }
}

function toDateTimeLocal(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse bill_description string (from formatBillDescription) back into line items */
function parseBillDescriptionToLineItems(
  text: string,
  totalAmount: number
): Array<Pick<BillLineItem, 'id' | 'description' | 'quantity' | 'amount' | 'packages' | 'packagingUnitName' | 'packagingUnitQty'>> {
  const items: Array<Pick<BillLineItem, 'id' | 'description' | 'quantity' | 'amount' | 'packages' | 'packagingUnitName' | 'packagingUnitQty'>> = [];

  if (!text?.trim()) {
    return [{ id: '1', description: '', quantity: '1', amount: String(totalAmount), packages: '', packagingUnitName: '', packagingUnitQty: '' }];
  }

  // Multi-item format: "1. Desc - qty × KES unitPrice = KES total" (may be newline or concatenated)
  const priceSuffixRegex = /\s*-\s*(\d+(?:\.\d+)?)\s+×\s+KES\s+([\d.]+)\s+=\s+KES\s+([\d.]+)\s*$/;
  const parts = text.split(/\s*(?=\d+\.\s)/).filter((p) => p.trim());

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const cleaned = part.replace(/^\d+\.\s*/, '');
    const match = cleaned.match(priceSuffixRegex);

    if (match) {
      const [, qty, unitPrice] = match;
      const description = cleaned.replace(priceSuffixRegex, '').trim();
      if (description) {
        items.push({
          id: `edit-${i + 1}-${Date.now()}`,
          description,
          quantity: qty,
          amount: unitPrice,
          packages: '',
          packagingUnitName: '',
          packagingUnitQty: '',
        });
      }
    }
  }

  // Single-item format: "Description (qty × KES unitPrice = KES total)"
  if (items.length === 0) {
    const singleMatch = text.match(/^([\s\S]+?)\s*\((\d+(?:\.\d+)?)\s+×\s+KES\s+([\d.]+)\s+=\s+KES\s+([\d.]+)\)\s*$/);
    if (singleMatch) {
      const [, description, qty, unitPrice] = singleMatch;
      if (description?.trim()) {
        items.push({
          id: 'edit-1',
          description: description.trim(),
          quantity: qty,
          amount: unitPrice,
          packages: '',
          packagingUnitName: '',
          packagingUnitQty: '',
        });
      }
    }
  }

  // Fallback: treat as single line
  if (items.length === 0) {
    items.push({
      id: '1',
      description: text.trim(),
      quantity: '1',
      amount: String(totalAmount),
      packages: '',
      packagingUnitName: '',
      packagingUnitQty: '',
    });
  }

  return items;
}

export function SupplierBillForm({ onSuccess, onCancel, preSelectedSupplierId, linkedProductsRefreshKey = 0, onOpenManageLinkProducts, billId, initialData }: SupplierBillFormProps) {
  const isEditMode = !!billId && !!initialData;
  const { productTypes } = useItemTypes();
  const PACKAGING_PRESETS = ['Carton', 'Sack', 'Net', 'Crate', 'Box', 'Bag', 'Bale', 'Bundle', 'Tray'];
  const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'emerald' },
    { id: 'till_number', label: 'Till Number', icon: Store, color: 'teal' },
    { id: 'paybill', label: 'Paybill', icon: ScanBarcode, color: 'cyan' },
    { id: 'mpesa', label: 'M-Pesa (Send)', icon: Smartphone, color: 'green' },
    { id: 'bank_transfer', label: 'Bank Transfer', icon: Landmark, color: 'blue' },
    { id: 'cheque', label: 'Cheque', icon: CreditCard, color: 'purple' },
    { id: 'credit', label: 'On Credit', icon: HandCoins, color: 'amber' },
    { id: 'other', label: 'Other', icon: Repeat, color: 'slate' },
  ] as const;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [lineItems, setLineItems] = useState<BillLineItem[]>([
    { id: '1', description: '', quantity: '', amount: '', packages: '', packagingUnitName: '', packagingUnitQty: '' },
  ]);
  const [dueDateTime, setDueDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierLocation, setNewSupplierLocation] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [newSupplierType, setNewSupplierType] = useState<string>('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [loadingLinkedProducts, setLoadingLinkedProducts] = useState(false);
  const [useManualSupplier, setUseManualSupplier] = useState(false);
  const [editSupplierDialogOpen, setEditSupplierDialogOpen] = useState(false);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierPhone, setEditSupplierPhone] = useState('');
  const [editSupplierEmail, setEditSupplierEmail] = useState('');
  const [editSupplierLocation, setEditSupplierLocation] = useState('');
  const [editSupplierNotes, setEditSupplierNotes] = useState('');
  const [editSupplierType, setEditSupplierType] = useState<string>('');
  const [editSupplierPaymentMethods, setEditSupplierPaymentMethods] = useState<string[]>([]);
  const [editSupplierPaymentDetails, setEditSupplierPaymentDetails] = useState('');
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);
  const [editSupplierError, setEditSupplierError] = useState<string | null>(null);
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<string>('all');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierOwedFilter, setSupplierOwedFilter] = useState<'all' | 'owed' | 'cleared'>('all');
  const supplierSearchRef = useRef<HTMLInputElement>(null);
  const letterSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [resettingStockItemIds, setResettingStockItemIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [paymentDetails, setPaymentDetails] = useState('');
  const restoredFromDraftRef = useRef(false);
  const skipLinkedProductsFetchRef = useRef(false);
  const [showDraftChoiceDialog, setShowDraftChoiceDialog] = useState(false);
  const pendingDraftRef = useRef<SupplierBillDraft | null>(null);
  /** Unpaid bills for the selected supplier, excluding the bill being edited */
  const [otherUnpaidBillsForSupplier, setOtherUnpaidBillsForSupplier] = useState<SupplierBill[]>([]);
  const [loadingOtherUnpaidBills, setLoadingOtherUnpaidBills] = useState(false);

  // On mount: if draft exists and we're not pre-selecting a supplier, ask user to resume or start fresh (skip when editing or replicating)
  useEffect(() => {
    if (isEditMode) return;
    if (preSelectedSupplierId || (initialData && !billId)) {
      // Creating bill for specific supplier or replicating: start fresh, clear any draft
      clearDraft();
      return;
    }
    const draft = loadDraft();
    if (draft) {
      pendingDraftRef.current = draft;
      setShowDraftChoiceDialog(true);
    }
  }, [preSelectedSupplierId, isEditMode]);

  // Initialize form from initialData when editing or when replicating (create from template)
  useEffect(() => {
    if (!initialData) return;
    if (isEditMode || !billId) {
      setSupplierId(initialData.supplierId || '');
      setSupplierName(initialData.supplierName);
      setSupplierPhone(initialData.supplierPhone || '');
      setUseManualSupplier(!initialData.supplierId);
      // Parse bill_description back into line items (handles multi-line format from formatBillDescription)
      setLineItems(
        parseBillDescriptionToLineItems(initialData.billDescription, initialData.amount)
      );
      setDueDateTime(toDateTimeLocal(initialData.dueDate));
      setNotes(initialData.notes || '');
      setSelectedPaymentMethods(
        initialData.preferredPaymentMethod
          ? initialData.preferredPaymentMethod.split(',').map((s) => s.trim()).filter(Boolean)
          : []
      );
      setPaymentDetails(initialData.paymentDetails || '');
    }
  }, [isEditMode, billId, initialData]);

  const handleResumeDraft = () => {
    const draft = pendingDraftRef.current;
    if (!draft) {
      setShowDraftChoiceDialog(false);
      return;
    }
    restoredFromDraftRef.current = true;
    skipLinkedProductsFetchRef.current = true;
    setSupplierId(draft.supplierId);
    setSupplierName(draft.supplierName);
    setSupplierPhone(draft.supplierPhone);
    setLineItems(draft.lineItems.map((item) => ({
      ...item,
      packagingUnitName: item.packagingUnitName ?? '',
      packagingUnitQty: item.packagingUnitQty ?? '',
    })));
    setDueDateTime(draft.dueDateTime || '');
    setNotes(draft.notes || '');
    setUseManualSupplier(draft.useManualSupplier ?? false);
    setSelectedPaymentMethods(draft.selectedPaymentMethods ?? []);
    setPaymentDetails(draft.paymentDetails || '');
    pendingDraftRef.current = null;
    setShowDraftChoiceDialog(false);
    toast.success('Draft restored', { description: 'Your previous entries have been recovered.' });
  };

  const handleStartFresh = () => {
    clearDraft();
    pendingDraftRef.current = null;
    setShowDraftChoiceDialog(false);
    // Reset form to initial state
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setSupplierSearch('');
    setLineItems([{ id: '1', description: '', quantity: '', amount: '', packages: '', packagingUnitName: '', packagingUnitQty: '' }]);
    setDueDateTime('');
    setNotes('');
    setUseManualSupplier(false);
    setSelectedPaymentMethods([]);
    setPaymentDetails('');
    setError(null);
  };

  // Persist form state to sessionStorage when it changes (debounced) — skip when editing
  useEffect(() => {
    if (isEditMode) return;
    if (!supplierId && !useManualSupplier && !supplierName.trim()) return;
    const hasContent = lineItems.some(
      (i) => i.description?.trim() || i.quantity || i.amount
    );
    if (!hasContent && !supplierName.trim()) return;

    const draft: SupplierBillDraft = {
      supplierId,
      supplierName,
      supplierPhone,
      lineItems: lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        amount: item.amount,
        packages: item.packages,
        packagingUnitName: item.packagingUnitName,
        packagingUnitQty: item.packagingUnitQty,
        itemId: item.itemId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        currentStock: item.currentStock,
        unitType: item.unitType,
        sellPrice: item.sellPrice,
        showPackaging: item.showPackaging,
      })),
      dueDateTime,
      notes,
      useManualSupplier,
      selectedPaymentMethods,
      paymentDetails,
    };
    saveDraft(draft);
  }, [
    isEditMode,
    supplierId,
    supplierName,
    supplierPhone,
    lineItems,
    dueDateTime,
    notes,
    useManualSupplier,
    selectedPaymentMethods,
    paymentDetails,
  ]);

  // Owed/cleared counts for filter chips
  const { owedCount, clearedCount, totalOwedAmount } = useMemo(() => {
    const owed = suppliers.filter((s) => s.owed_amount && s.owed_amount > 0);
    const cleared = suppliers.filter((s) => !s.owed_amount || s.owed_amount === 0);
    const total = owed.reduce((sum, s) => sum + (s.owed_amount || 0), 0);
    return { owedCount: owed.length, clearedCount: cleared.length, totalOwedAmount: total };
  }, [suppliers]);

  // Filtered suppliers based on search + owed filter, sorted alphabetically (owed first when "all")
  const filteredSuppliers = useMemo(() => {
    let list = !supplierSearch.trim()
      ? suppliers
      : suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
            (s.contact_phone && s.contact_phone.includes(supplierSearch))
        );
    if (supplierOwedFilter === 'owed') {
      list = list.filter((s) => s.owed_amount && s.owed_amount > 0);
    } else if (supplierOwedFilter === 'cleared') {
      list = list.filter((s) => !s.owed_amount || s.owed_amount === 0);
    }
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    if (supplierOwedFilter === 'all' && owedCount > 0) {
      return sorted.sort((a, b) => {
        const aOwed = (a.owed_amount || 0) > 0 ? 1 : 0;
        const bOwed = (b.owed_amount || 0) > 0 ? 1 : 0;
        if (aOwed !== bOwed) return bOwed - aOwed;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }
    return sorted;
  }, [suppliers, supplierSearch, supplierOwedFilter, owedCount]);

  // Group suppliers by first letter (for alphabetical picker when not searching)
  const suppliersByLetter = useMemo(() => {
    const groups: Record<string, Supplier[]> = {};
    for (const s of filteredSuppliers) {
      const letter = (s.name[0] || '#').toUpperCase();
      const key = /[A-Z0-9]/.test(letter) ? letter : '#';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [filteredSuppliers]);

  const availableLetters = useMemo(
    () => Object.keys(suppliersByLetter).sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))),
    [suppliersByLetter]
  );

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoadingSuppliers(true);
        const base = supplierTypeFilter && supplierTypeFilter !== 'all'
          ? `/api/suppliers?supplierType=${encodeURIComponent(supplierTypeFilter)}`
          : '/api/suppliers';
        const url = `${base}${base.includes('?') ? '&' : '?'}includeOwed=true`;
        const result = await apiGet<Supplier[]>(url);
        if (result.success) {
          setSuppliers(result.data || []);
          // Only pre-fill from URL when we did NOT restore a draft
          if (preSelectedSupplierId && !restoredFromDraftRef.current) {
            const supplier = (result.data || []).find(
              (s) => s.id === preSelectedSupplierId
            );
            if (supplier) {
              setSupplierId(supplier.id);
              setSupplierName(supplier.name);
              setSupplierPhone(supplier.contact_phone || '');
            }
          }
        }
      } catch (err) {
        console.error('Error fetching suppliers:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    }
    fetchSuppliers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierTypeFilter]);

  // Focus search when supplier picker opens
  useEffect(() => {
    if (supplierPickerOpen) {
      setTimeout(() => supplierSearchRef.current?.focus(), 100);
    }
  }, [supplierPickerOpen]);

  // Unpaid bills for this supplier (create + edit drawers): warn if another bill is already owed
  useEffect(() => {
    if (!supplierId || useManualSupplier) {
      setOtherUnpaidBillsForSupplier([]);
      return;
    }
    let cancelled = false;
    setLoadingOtherUnpaidBills(true);
    apiGet<SupplierBill[]>(
      `/api/supplier-bills?supplierId=${encodeURIComponent(supplierId)}`
    )
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const rows = res.data.filter((b) => b.status === 'pending' || b.status === 'overdue');
        setOtherUnpaidBillsForSupplier(billId ? rows.filter((b) => b.id !== billId) : rows);
      })
      .catch(() => {
        if (!cancelled) setOtherUnpaidBillsForSupplier([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOtherUnpaidBills(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, useManualSupplier, billId]);

  // Fetch linked products when supplier changes (skip when restoring from draft or editing)
  useEffect(() => {
    if (!supplierId) return;
    if (isEditMode) return;
    if (skipLinkedProductsFetchRef.current) {
      skipLinkedProductsFetchRef.current = false;
      return;
    }

    async function fetchLinkedProducts() {
      setLoadingLinkedProducts(true);
      try {
        const result = await apiGet<LinkedProduct[]>(
          `/api/suppliers/${supplierId}/products`
        );
        if (result.success && result.data && result.data.length > 0) {
          const newLineItems: BillLineItem[] = result.data.map((product, index) => {
            const displayName = getItemDisplayName(product.item_name, product.variant_name);
            // Prefill buy price: saved default > last inventory batch buy price > empty
            const buyPrice = product.default_cost_price != null
              ? product.default_cost_price
              : product.last_buy_price != null
                ? product.last_buy_price
                : null;
            const priceSource = product.default_cost_price != null
              ? ('default' as const)
              : product.last_buy_price != null
                ? ('last' as const)
                : undefined;
            return {
              id: `linked-${index}-${Date.now()}`,
              description: displayName,
              quantity: '',
              amount: buyPrice != null ? String(buyPrice) : '',
              packages: '',
              packagingUnitName: product.packaging_unit_name || '',
              packagingUnitQty: product.packaging_unit_qty ? String(product.packaging_unit_qty) : '',
              itemId: product.item_id,
              currentStock: product.current_stock,
              unitType: product.unit_type,
              sellPrice: product.current_sell_price,
              priceSource,
            };
          });
          // Merge: preserve existing entries with content, add linked products not already in list
          setLineItems((prev) => {
            const hasContent = (item: BillLineItem) =>
              (item.description?.trim() || item.quantity || item.amount) ? true : false;
            const existingWithContent = prev.filter(hasContent);
            const existingItemIds = new Set(existingWithContent.map((i) => i.itemId).filter(Boolean));
            const newLinked = newLineItems.filter((p) => !existingItemIds.has(p.itemId));
            if (newLinked.length === 0) return prev;
            return [...existingWithContent, ...newLinked];
          });
        }
      } catch (err) {
        console.error('Error fetching linked products:', err);
      } finally {
        setLoadingLinkedProducts(false);
      }
    }

    fetchLinkedProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, linkedProductsRefreshKey]);

  // Filter line items by product search (filters the table only)
  const filteredLineItems = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return lineItems;
    return lineItems.filter((item) =>
      item.description.toLowerCase().includes(q)
    );
  }, [lineItems, productSearch]);

  // Supplier-based batch number placeholders (sequential per bill)
  const batchNumberMap = useMemo(() => {
    const next: Record<string, string> = {};
    const now = Math.floor(Date.now() / 1000);
    let seq = 0;
    for (const item of lineItems) {
      if (!item.itemId) continue;
      seq += 1;
      next[item.id] = generateSupplierBatchNumber(
        supplierName || 'Supplier',
        seq,
        now
      );
    }
    return next;
  }, [lineItems, supplierName]);

  const handleSelectSupplier = (supplier: Supplier) => {
    setSupplierId(supplier.id);
    setSupplierName(supplier.name);
    setSupplierPhone(supplier.contact_phone || '');
    setUseManualSupplier(false);
    setSupplierPickerOpen(false);
    setSupplierSearch('');
  };

  const handleClearSupplier = () => {
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setLineItems([{ id: '1', description: '', quantity: '', amount: '', packages: '', packagingUnitName: '', packagingUnitQty: '' }]);
    setUseManualSupplier(false);
    setSupplierSearch('');
    clearDraft();
  };

  const openEditSupplierDialog = () => {
    if (!supplierId) return;
    const existing = suppliers.find((s) => s.id === supplierId);
    if (!existing) return;
    setEditSupplierName(existing.name || '');
    setEditSupplierPhone(existing.contact_phone || '');
    setEditSupplierEmail(existing.contact_email || '');
    setEditSupplierLocation(existing.location || '');
    setEditSupplierNotes(existing.notes || '');
    setEditSupplierType(existing.supplier_type || '');
    setEditSupplierPaymentMethods(
      existing.preferred_payment_method
        ? existing.preferred_payment_method.split(',').map((s) => s.trim()).filter(Boolean)
        : []
    );
    setEditSupplierPaymentDetails(existing.payment_details || '');
    setEditSupplierError(null);
    setEditSupplierDialogOpen(true);
  };

  const handleUpdateSupplier = async () => {
    if (!supplierId) return;
    setEditSupplierError(null);

    if (!editSupplierName.trim()) {
      setEditSupplierError('Supplier name is required');
      return;
    }

    setIsUpdatingSupplier(true);

    try {
      const result = await apiPatch(`/api/suppliers/${supplierId}`, {
        name: editSupplierName.trim(),
        contactPhone: editSupplierPhone.trim() || null,
        contactEmail: editSupplierEmail.trim() || null,
        location: editSupplierLocation.trim() || null,
        notes: editSupplierNotes.trim() || null,
        supplierType: editSupplierType?.trim() || null,
        preferredPaymentMethod: editSupplierPaymentMethods.length > 0 ? editSupplierPaymentMethods.join(',') : null,
        paymentDetails: editSupplierPaymentDetails.trim() || null,
      });

      if (result.success) {
        const suppliersResult = await apiGet<Supplier[]>('/api/suppliers');
        if (suppliersResult.success && suppliersResult.data) {
          setSuppliers(suppliersResult.data);
          const updated = suppliersResult.data.find((s) => s.id === supplierId);
          if (updated) {
            setSupplierName(updated.name);
            setSupplierPhone(updated.contact_phone || '');
          }
        }

        setEditSupplierDialogOpen(false);
      } else {
        setEditSupplierError(result.message || 'Failed to update supplier');
      }
    } catch (err) {
      console.error('Error updating supplier:', err);
      setEditSupplierError('An error occurred. Please try again.');
    } finally {
      setIsUpdatingSupplier(false);
    }
  };

  const handleUseManual = () => {
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setUseManualSupplier(true);
    setLineItems([{ id: '1', description: '', quantity: '', amount: '', packages: '', packagingUnitName: '', packagingUnitQty: '' }]);
  };

  const handleCreateSupplier = async () => {
    setSupplierError(null);

    if (!newSupplierName.trim()) {
      setSupplierError('Supplier name is required');
      return;
    }

    setIsCreatingSupplier(true);

    try {
      const result = await apiPost('/api/suppliers', {
        name: newSupplierName.trim(),
        contactPhone: newSupplierPhone.trim() || null,
        contactEmail: newSupplierEmail.trim() || null,
        location: newSupplierLocation.trim() || null,
        notes: newSupplierNotes.trim() || null,
        supplierType: newSupplierType?.trim() || null,
      });

      if (result.success) {
        const suppliersResult = await apiGet<Supplier[]>('/api/suppliers');
        if (suppliersResult.success) {
          setSuppliers(suppliersResult.data || []);

          const newSupplier = suppliersResult.data?.find(
            (s) => s.name.trim().toLowerCase() === newSupplierName.trim().toLowerCase()
          );

          if (newSupplier) {
            setSupplierId(newSupplier.id);
            setSupplierName(newSupplier.name);
            setSupplierPhone(newSupplier.contact_phone || '');
            setUseManualSupplier(false);
          }
        }

        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierEmail('');
        setNewSupplierLocation('');
        setNewSupplierNotes('');
        setNewSupplierType('');
        setNewSupplierDialogOpen(false);
      } else {
        setSupplierError(result.message || 'Failed to create supplier');
      }
    } catch (err) {
      console.error('Error creating supplier:', err);
      setSupplierError('An error occurred. Please try again.');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Calculate total from line items (quantity x unit price).
  // If quantity is empty or invalid, the line is ignored (not counted).
  const totalAmount = lineItems.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity || '0');
    const unitPrice = parseFloat(item.amount || '0');
    if (isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
      return sum;
    }
    const itemTotal = quantity * unitPrice;
    return sum + itemTotal;
  }, 0);

  const linkedCount = lineItems.filter((i) => i.itemId).length;

  const formatBillDescription = () => {
    // Include items that have description and quantity; amount can be empty (treated as 0).
    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity
    );
    if (validItems.length === 0) return '';

    const formatItemLine = (item: BillLineItem) => {
      const qty = parseFloat(item.quantity || '0');
      const unitPrice = parseFloat(item.amount || '0');
      const total = qty * unitPrice;
      const pkgs = item.packages ? parseFloat(item.packages) : 0;
      const hasPkgInfo = item.packagingUnitName.trim() && parseFloat(item.packagingUnitQty) > 0 && pkgs > 0;
      const pkgNote = hasPkgInfo ? ` (${pkgs} ${item.packagingUnitName}${pkgs !== 1 ? 's' : ''})` : '';
      return { qty, unitPrice, total, pkgNote };
    };

    if (validItems.length === 1) {
      const item = validItems[0];
      const { qty, unitPrice, total, pkgNote } = formatItemLine(item);
      return `${item.description.trim()}${pkgNote} (${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)})`;
    }

    return validItems
      .map((item, index) => {
        const { qty, unitPrice, total, pkgNote } = formatItemLine(item);
        return `${index + 1}. ${item.description.trim()}${pkgNote} - ${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)}`;
      })
      .join('\n');
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: '', amount: '', packages: '', packagingUnitName: '', packagingUnitQty: '' },
    ]);
  };

  const removeLineItem = async (id: string) => {
    if (lineItems.length <= 1) return;
    const item = lineItems.find((i) => i.id === id);
    if (!item) return;

    // If it's a linked product, unlink from database first
    if (item.itemId && supplierId) {
      try {
        const result = await apiDelete(
          `/api/suppliers/${supplierId}/products?itemId=${item.itemId}`
        );
        if (!result.success) {
          toast.error(result.message || 'Failed to unlink product');
          return;
        }
        toast.success('Product unlinked from supplier');
      } catch (err) {
        console.error('Error unlinking product:', err);
        toast.error('Failed to unlink product from supplier');
        return;
      }
    }

    setLineItems(lineItems.filter((i) => i.id !== id));
  };

  const [fillingBatchFor, setFillingBatchFor] = useState<string | null>(null);

  const handlePrefillBatchNumbers = async () => {
    const linked = lineItems.filter(
      (i) => i.itemId && i.quantity && parseFloat(i.quantity) > 0
    );
    if (linked.length === 0) return;
    setFillingBatchFor('all');
    try {
      const params = new URLSearchParams({
        supplierName: supplierName || 'Supplier',
        count: String(linked.length),
      });
      if (supplierId) params.set('supplierId', supplierId);
      const res = await apiGet<{ batchNumbers: string[] }>(`/api/batches/next?${params}`);
      if (res.success && res.data?.batchNumbers?.length) {
        const byId: Record<string, string> = {};
        linked.forEach((item, i) => {
          byId[item.id] = res.data!.batchNumbers![i] ?? '';
        });
        setLineItems((prev) =>
          prev.map((item) =>
            item.itemId && byId[item.id] ? { ...item, batchNumber: byId[item.id] } : item
          )
        );
      }
    } catch {
      toast.error('Could not fetch batch numbers');
    } finally {
      setFillingBatchFor(null);
    }
  };

  const handlePrefillBatchNumberForItem = async (itemId: string, lineItemId: string) => {
    const existing = lineItems
      .filter((i) => i.itemId && i.batchNumber?.trim())
      .map((i) => i.batchNumber!.trim());
    setFillingBatchFor(lineItemId);
    try {
      const params = new URLSearchParams({
        supplierName: supplierName || 'Supplier',
        count: '1',
        existing: existing.join(','),
      });
      if (supplierId) params.set('supplierId', supplierId);
      const res = await apiGet<{ batchNumbers: string[] }>(`/api/batches/next?${params}`);
      if (res.success && res.data?.batchNumbers?.[0]) {
        setLineItems((prev) =>
          prev.map((item) =>
            item.id === lineItemId ? { ...item, batchNumber: res.data!.batchNumbers![0] } : item
          )
        );
      }
    } catch {
      toast.error('Could not fetch batch number');
    } finally {
      setFillingBatchFor(null);
    }
  };

  const updateLineItem = (id: string, field: 'description' | 'quantity' | 'amount' | 'packages' | 'packagingUnitName' | 'packagingUnitQty' | 'batchNumber' | 'expiryDate', value: string) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Auto-calculate quantity when packages or packagingUnitQty change
        const pkgQty = field === 'packagingUnitQty' ? (parseFloat(value) || 0) : (parseFloat(item.packagingUnitQty) || 0);
        const pkgs = field === 'packages' ? (parseFloat(value) || 0) : (parseFloat(item.packages) || 0);
        if ((field === 'packages' || field === 'packagingUnitQty') && pkgQty > 0 && pkgs > 0) {
          updated.quantity = String(pkgs * pkgQty);
        } else if ((field === 'packages' || field === 'packagingUnitQty') && (pkgQty === 0 || pkgs === 0)) {
          // Clear quantity if either packaging field is cleared
          if (item.packages || item.packagingUnitQty) {
            updated.quantity = '';
          }
        }
        return updated;
      })
    );
  };

  const togglePaymentMethod = (methodId: string) => {
    setSelectedPaymentMethods((prev) =>
      prev.includes(methodId)
        ? prev.filter((m) => m !== methodId)
        : [...prev, methodId]
    );
  };

  const toggleLinePackaging = (id: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, showPackaging: !item.showPackaging } : item
      )
    );
  };

  const handleResetStockForItem = async (item: BillLineItem) => {
    if (
      !item.itemId ||
      item.currentStock == null ||
      item.currentStock === 0
    ) {
      toast.info('No stock to reset for this product.');
      return;
    }
    const lineId = item.id;
    toast(
      `Reset current stock to 0 for "${item.description}"? This cannot be undone.`,
      {
        action: {
          label: 'Continue',
          onClick: async () => {
            setResettingStockItemIds((prev) => new Set(prev).add(lineId));
            try {
              const current = item.currentStock!;
              const adjustmentType = current > 0 ? 'decrease' : 'increase';
              const quantity = Math.abs(current);
              const result = await apiPost('/api/stock/adjust', {
                itemId: item.itemId!,
                adjustmentType,
                quantity,
                reason: 'counting_error',
                notes: 'Reset from Supplier Bill',
              });
              if ((result as { success?: boolean })?.success) {
                setLineItems((prev) =>
                  prev.map((i) =>
                    i.id === lineId ? { ...i, currentStock: 0 } : i
                  )
                );
                toast.success(`Stock reset to zero for "${item.description}".`);
              } else {
                toast.error('Failed to reset stock. Please try again.');
              }
            } catch (err) {
              console.error('Error resetting stock:', err);
              toast.error('Failed to reset stock. Please try again.');
            } finally {
              setResettingStockItemIds((prev) => {
                const next = new Set(prev);
                next.delete(lineId);
                return next;
              });
            }
          },
        },
        cancel: { label: 'Cancel', onClick: () => {} },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError('Supplier name is required');
      return;
    }

    if (!supplierId) {
      setError('Select a supplier from the master list before creating a bill');
      return;
    }

    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity
    );

    if (validItems.length === 0) {
      setError('Please add at least one bill item with description and quantity');
      return;
    }

    for (const item of validItems) {
      const quantity = parseFloat(item.quantity || '0');
      const unitPrice = parseFloat(item.amount || '0');

      if (isNaN(quantity) || quantity <= 0) {
        setError(`Please enter a valid quantity for "${item.description.trim()}"`);
        return;
      }

      if (item.itemId && (isNaN(unitPrice) || unitPrice <= 0)) {
        setError(`Enter a cost greater than 0 for "${item.description.trim()}"`);
        return;
      }
    }

    if (totalAmount < 0) {
      setError('Total amount cannot be negative');
      return;
    }

    if (!dueDateTime) {
      setError('Due date and time are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const billDescription = formatBillDescription();

      if (isEditMode && billId) {
        // PATCH: Update existing bill (no stock updates)
        const result = await apiPatch(`/api/supplier-bills/${billId}`, {
          supplierName: supplierName.trim(),
          supplierPhone: supplierPhone.trim() || null,
          billDescription,
          amount: totalAmount,
          dueDate: dueDateTime,
          notes: notes.trim() || null,
          preferredPaymentMethod: selectedPaymentMethods.length > 0 ? selectedPaymentMethods.join(',') : null,
          paymentDetails: paymentDetails.trim() || null,
        });

        if (result.success) {
          if (onSuccess) onSuccess();
        } else {
          setError(result.message || 'Failed to update bill');
        }
      } else {
        // POST: Create new bill
        const stockSourceItems = lineItems.filter(
          (item) => item.description.trim() && item.quantity && item.amount
        );
        const stockItems = stockSourceItems
          .filter((item) => item.itemId)
          .map((item) => ({
            itemId: item.itemId!,
            quantity: parseFloat(item.quantity),
            costPricePerUnit: parseFloat(item.amount),
            batchNumber: item.batchNumber?.trim() || undefined,
            expiryDate: item.expiryDate ? Math.floor(new Date(item.expiryDate).getTime() / 1000) : undefined,
          }));

        const result = await apiPost('/api/supplier-bills', {
          supplierId: supplierId || null,
          supplierName: supplierName.trim(),
          supplierPhone: supplierPhone.trim() || null,
          billDescription,
          amount: totalAmount,
          dueDate: dueDateTime,
          notes: notes.trim() || null,
          stockItems: stockItems.length > 0 ? stockItems : undefined,
          preferredPaymentMethod: selectedPaymentMethods.length > 0 ? selectedPaymentMethods.join(',') : null,
          paymentDetails: paymentDetails.trim() || null,
        });

        if (result.success) {
          if (supplierId) {
            const linkedWithPrice = lineItems.filter(
              (item) => item.itemId && item.amount && parseFloat(item.amount) > 0
            );
            await Promise.allSettled(
              linkedWithPrice.map((item) =>
                apiPatch(`/api/suppliers/${supplierId}/products`, {
                  itemId: item.itemId!,
                  defaultCostPrice: parseFloat(item.amount),
                })
              )
            );
          }
          clearDraft();
          if (onSuccess) onSuccess();
        } else {
          setError(result.message || 'Failed to create supplier bill');
        }
      }
    } catch (err) {
      console.error('Error creating/updating supplier bill:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default due to today at end of day (23:59) — skip when editing (initialData sets it)
  useEffect(() => {
    if (isEditMode) return;
    if (!dueDateTime) {
      const d = new Date();
      d.setHours(23, 59, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDueDateTime(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
  }, [dueDateTime, isEditMode]);

  // ────────────────── Supplier color based on name ──────────────────
  const getSupplierColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const h = ((hash % 360) + 360) % 360;
    return { bg: `hsl(${h}, 50%, 95%)`, border: `hsl(${h}, 50%, 75%)`, text: `hsl(${h}, 55%, 35%)`, accent: `hsl(${h}, 55%, 50%)` };
  };

  const getInitials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const formatPrice = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

  const formatBillDueDate = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' });

  const summarizeBillDescription = (text: string, maxLen = 80) => {
    const line = text.split('\n')[0]?.trim() || '—';
    return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
  };

  // ────────────────────────── RENDER ──────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Draft choice dialog: resume or start fresh */}
      <Dialog open={showDraftChoiceDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md z-[60]" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#1c6a1e]" />
              Saved draft found
            </DialogTitle>
            <DialogDescription>
              You have a saved draft from a previous session. Would you like to resume where you left off or start a new bill?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleStartFresh}
              className="flex-1"
            >
              Start fresh
            </Button>
            <Button
              type="button"
              onClick={handleResumeDraft}
              className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
            >
              Resume draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* ═══════════════ STEP 1: SUPPLIER SELECTION ═══════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1c6a1e]/10 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-[#1c6a1e]" />
            </div>
            <Label className="text-slate-800 dark:text-slate-200 font-bold text-sm">
              Select Supplier
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            {!useManualSupplier && !supplierId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUseManual}
                className="h-7 text-xs text-slate-500 hover:text-slate-700"
              >
                Enter manually
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewSupplierDialogOpen(true)}
              className="h-7 text-xs border-[#1c6a1e]/30 text-[#1c6a1e] hover:bg-[#1c6a1e]/5"
            >
              <Plus className="w-3 h-3 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Selected supplier banner */}
        {supplierId && !useManualSupplier && (() => {
          const selected = suppliers.find((s) => s.id === supplierId);
          if (!selected) return null;
          const colors = getSupplierColor(selected.name);
          return (
            <div
              className="relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
              style={{ borderColor: colors.accent, backgroundColor: colors.bg }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: colors.accent, color: '#fff' }}
              >
                {getInitials(selected.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm" style={{ color: colors.text }}>
                    {selected.name}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openEditSupplierDialog}
                    className="h-6 px-2 text-[10px] border-slate-300 text-slate-600 hover:bg-white/60 bg-white/80 rounded-full"
                  >
                    Edit
                  </Button>
                  {onOpenManageLinkProducts && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenManageLinkProducts({ ...selected, location: selected.location ?? null, notes: selected.notes ?? null })}
                      className="h-6 px-2 text-[10px] border-[#1c6a1e]/40 text-[#1c6a1e] hover:bg-[#1c6a1e]/10 rounded-full"
                    >
                      <Link2 className="w-3 h-3 mr-1" />
                      Manage linked products
                    </Button>
                  )}
                </div>
                {selected.contact_phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {selected.contact_phone}
                  </p>
                )}
                {linkedCount > 0 && (
                  <p className="text-[10px] mt-1 font-medium" style={{ color: colors.accent }}>
                    {linkedCount} linked product{linkedCount !== 1 ? 's' : ''} auto-filled below
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearSupplier}
                className="absolute top-2 right-2 h-7 w-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })()}

        {/* Manual supplier entry */}
        {useManualSupplier && (
          <div className="space-y-2 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Manual entry</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setUseManualSupplier(false); setSupplierName(''); setSupplierPhone(''); }}
                className="h-6 text-[10px] text-slate-400 hover:text-slate-600"
              >
                Back to list
              </Button>
            </div>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Supplier name"
              required
              className="h-10 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <Input
              type="tel"
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
              placeholder="Phone number (optional)"
              className="h-10 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        )}

        {/* Compact supplier picker trigger */}
        {!supplierId && !useManualSupplier && (
          <div className="space-y-2">
            {loadingSuppliers ? (
              <div className="flex items-center justify-center py-6 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading suppliers...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setSupplierPickerOpen(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 hover:border-[#1c6a1e]/50 hover:bg-[#1c6a1e]/5 dark:hover:bg-[#1c6a1e]/10 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center group-hover:bg-[#1c6a1e]/20 transition-colors">
                    <Building2 className="w-5 h-5 text-slate-500 group-hover:text-[#1c6a1e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                      Select supplier
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} — tap to browse or search
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#1c6a1e] shrink-0" />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleUseManual}
                  className="h-7 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Or enter supplier manually
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Supplier Picker Drawer — compact, search-first, supports hundreds */}
        <Drawer
          open={supplierPickerOpen}
          onOpenChange={(open) => {
            setSupplierPickerOpen(open);
            if (!open) {
              setSupplierSearch('');
              setSupplierOwedFilter('all');
            }
          }}
          direction="right"
        >
          <DrawerContent className="!w-full sm:!w-[420px] md:!w-[480px] !max-w-[95vw] h-full max-h-screen z-[60] rounded-l-2xl flex flex-col">
            <DrawerHeader className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-0">
              <DrawerTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1c6a1e]" />
                Select Supplier
              </DrawerTitle>
              <DrawerDescription className="text-xs mt-1">
                Search, filter by owed status, or jump by letter
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Sticky search + filters */}
              <div className="shrink-0 p-3 space-y-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    ref={supplierSearchRef}
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Search name or phone..."
                    className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                {/* Owed / Cleared filter chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 p-0.5">
                    {[
                      { key: 'all' as const, label: 'All', count: suppliers.length },
                      { key: 'owed' as const, label: 'Owed', count: owedCount, icon: Wallet },
                      { key: 'cleared' as const, label: 'Cleared', count: clearedCount, icon: CircleCheck },
                    ].map(({ key, label, count, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSupplierOwedFilter(key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                          supplierOwedFilter === key
                            ? key === 'owed'
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 shadow-sm'
                              : key === 'cleared'
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 shadow-sm'
                                : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {Icon && <Icon className="w-3 h-3 shrink-0" />}
                        <span>{label}</span>
                        <span className={`tabular-nums ${supplierOwedFilter === key ? 'font-semibold' : 'opacity-75'}`}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <Select value={supplierTypeFilter} onValueChange={setSupplierTypeFilter}>
                    <SelectTrigger className="h-8 w-[120px] text-xs border-slate-200 dark:border-slate-700 rounded-lg">
                      <Tag className="w-3 h-3 mr-1 text-slate-400" />
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

                  {availableLetters.length > 0 && !supplierSearch.trim() && supplierOwedFilter === 'all' && (
                    <div className="flex flex-wrap gap-0.5 max-h-8 overflow-y-auto ml-auto">
                      {availableLetters.map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => {
                            const el = letterSectionRefs.current[letter];
                            el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                          }}
                          className="w-6 h-6 rounded text-[10px] font-semibold text-slate-500 hover:text-[#1c6a1e] hover:bg-[#1c6a1e]/10 transition-colors shrink-0"
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total owed summary when viewing owed filter */}
                {supplierOwedFilter === 'owed' && totalOwedAmount > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30">
                    <Wallet className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      {owedCount} supplier{owedCount !== 1 ? 's' : ''} · {formatPrice(totalOwedAmount)} total owed
                    </span>
                  </div>
                )}
              </div>

              {/* Scrollable list — dense rows */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {filteredSuppliers.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <p className="text-sm text-slate-500">
                      {supplierSearch
                        ? 'No suppliers match your search'
                        : supplierOwedFilter === 'owed'
                          ? 'No suppliers with outstanding balance'
                          : supplierOwedFilter === 'cleared'
                            ? 'No suppliers with zero balance'
                            : 'No suppliers yet'}
                    </p>
                    {supplierOwedFilter !== 'all' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSupplierOwedFilter('all')}
                        className="mt-2 text-xs text-[#1c6a1e] hover:text-[#2a8a30]"
                      >
                        Show all suppliers
                      </Button>
                    )}
                  </div>
                ) : supplierSearch.trim() ? (
                  /* Flat list when searching */
                  <div className="py-1">
                    {filteredSuppliers.map((supplier) => {
                      const colors = getSupplierColor(supplier.name);
                      const owed = supplier.owed_amount && supplier.owed_amount > 0;
                      return (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => handleSelectSupplier(supplier)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: colors.accent, color: '#fff' }}
                          >
                            {getInitials(supplier.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                              {supplier.name}
                            </p>
                            {supplier.contact_phone && (
                              <p className="text-[11px] text-slate-500 truncate">{supplier.contact_phone}</p>
                            )}
                            {owed && (
                              <p className="text-[10px] mt-0.5 font-medium text-amber-600 dark:text-amber-400 truncate" title={supplier.owed_payment_details || undefined}>
                                Owed {formatPrice(supplier.owed_amount!)}
                                {supplier.owed_payment_details && ` · ${supplier.owed_payment_details}`}
                              </p>
                            )}
                          </div>
                          <Check className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Grouped by letter when not searching */
                  <div className="py-1">
                    {availableLetters.map((letter) => (
                      <div key={letter} ref={(el) => { letterSectionRefs.current[letter] = el; }}>
                        <div className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-sm py-1 px-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {letter}
                          </span>
                        </div>
                        {suppliersByLetter[letter]?.map((supplier) => {
                          const colors = getSupplierColor(supplier.name);
                          const owed = supplier.owed_amount && supplier.owed_amount > 0;
                          return (
                            <button
                              key={supplier.id}
                              type="button"
                              onClick={() => handleSelectSupplier(supplier)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: colors.accent, color: '#fff' }}
                              >
                                {getInitials(supplier.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                                  {supplier.name}
                                </p>
                                {supplier.contact_phone && (
                                  <p className="text-[11px] text-slate-500 truncate">{supplier.contact_phone}</p>
                                )}
                                {owed && (
                                  <p className="text-[10px] mt-0.5 font-medium text-amber-600 dark:text-amber-400 truncate" title={supplier.owed_payment_details || undefined}>
                                    Owed {formatPrice(supplier.owed_amount!)}
                                    {supplier.owed_payment_details && ` · ${supplier.owed_payment_details}`}
                                  </p>
                                )}
                              </div>
                              <Check className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSupplierPickerOpen(false);
                    setUseManualSupplier(true);
                    setSupplierSearch('');
                  }}
                  className="flex-1 h-9 text-xs"
                >
                  Enter manually
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSupplierPickerOpen(false);
                    setNewSupplierDialogOpen(true);
                  }}
                  className="flex-1 h-9 text-xs bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  New supplier
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* ═══════════════ STEP 2: BILL ITEMS ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-sm">
                Bill Items
              </Label>
              {loadingLinkedProducts && (
                <div className="flex items-center gap-1 text-[#1c6a1e]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[10px]">Loading products...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {lineItems.some(
                (i) => i.itemId && i.quantity && parseFloat(i.quantity) > 0
              ) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrefillBatchNumbers}
                  disabled={fillingBatchFor === 'all'}
                  className="h-7 text-xs border-slate-300 dark:border-slate-600"
                  title="Fill batch/lot numbers (continues from previous batches)"
                >
                  {fillingBatchFor === 'all' ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Layers className="w-3 h-3 mr-1" />
                  )}
                  Fill lots
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="h-7 text-xs border-slate-300 dark:border-slate-600"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Product search bar - filters the table */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Filter products in table..."
              className="pl-9 h-9 border-2 border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800/50"
            />
            {productSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setProductSearch('')}
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </Button>
            )}
          </div>

          {/* Table-style header (visible on larger screens) */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_90px_56px] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Product</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Buy Price</span>
            <span className="text-right">Total</span>
            <span></span>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {filteredLineItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                {productSearch.trim()
                  ? 'No products match your search'
                  : 'No items yet. Click "Add Item" to add products.'}
              </div>
            ) : (
              filteredLineItems.map((item, index) => {
              const qty = parseFloat(item.quantity || '0');
              const buyPrice = parseFloat(item.amount || '0');
              const itemTotal = qty * buyPrice;
              const hasTotal = !isNaN(itemTotal) && itemTotal > 0;
              const margin = item.sellPrice && buyPrice > 0 ? item.sellPrice - buyPrice : null;
              const hasPkg = !!(item.packagingUnitName.trim() && item.packagingUnitQty && parseFloat(item.packagingUnitQty) > 0);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    item.itemId
                      ? 'border-[#1c6a1e]/30 bg-[#1c6a1e]/[0.02] dark:bg-[#1c6a1e]/[0.04]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  {/* ── Desktop layout ── */}
                  <div className="hidden sm:block">
                    {/* Main row */}
                    <div className="grid sm:grid-cols-[1fr_80px_100px_90px_56px] gap-2 items-center px-3 py-2.5">
                      {/* Product name + meta */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">{index + 1}.</span>
                          {item.itemId ? (
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {item.description}
                            </span>
                          ) : (
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              placeholder="Item description"
                              required
                              className="h-8 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                            />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLinePackaging(item.id)}
                            className="ml-2 h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full"
                          >
                            <Package className="w-3 h-3 mr-1" />
                            {item.showPackaging ? 'Hide packages' : 'Add packages'}
                          </Button>
                        </div>
                        {/* Meta row for linked items */}
                        {item.itemId && (
                          <div className="flex flex-wrap items-center gap-3 mt-0.5 ml-4">
                        <div className="flex items-center gap-1.5 h-6 border border-emerald-200/80 dark:border-emerald-900/50 bg-white/80 dark:bg-slate-900/70 px-2">
                              <Layers className="w-2.5 h-2.5 text-[#1c6a1e] dark:text-emerald-400 shrink-0 -mt-px" />
                              <Input
                                type="text"
                                value={item.batchNumber ?? ''}
                                onChange={(e) => updateLineItem(item.id, 'batchNumber', e.target.value)}
                                placeholder={batchNumberMap[item.id] || 'e.g. CADBU-001'}
                                className="h-6 w-28 text-[10px] font-mono bg-transparent border-0 focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none placeholder:text-slate-400"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrefillBatchNumberForItem(item.itemId!, item.id)}
                                disabled={fillingBatchFor === item.id || fillingBatchFor === 'all'}
                                className="h-6 px-1.5 text-[10px] text-[#1c6a1e] hover:bg-[#1c6a1e]/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                                title="Fill next batch number"
                              >
                                {fillingBatchFor === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Fill'}
                              </Button>
                            </div>
                            <div className="flex items-center gap-1.5 h-6 border border-amber-200/80 dark:border-amber-900/50 bg-white/80 dark:bg-slate-900/70 px-2">
                              <CalendarClock className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400 shrink-0 -mt-px" />
                              <Input
                                type="date"
                                value={item.expiryDate ?? ''}
                                onChange={(e) => updateLineItem(item.id, 'expiryDate', e.target.value)}
                                className="h-6 w-32 text-[10px] bg-transparent border-0 focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:outline-none placeholder:text-slate-400"
                                title="Expiry date (optional)"
                              />
                            </div>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              <Warehouse className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                              {item.currentStock != null ? `${item.currentStock} ${item.unitType || ''}` : '—'} in stock
                            </span>
                            {item.sellPrice != null && item.sellPrice > 0 && (
                              <span className="text-[10px] text-slate-400">
                                Sells @ {formatPrice(item.sellPrice)}
                              </span>
                            )}
                            {margin !== null && (
                              <span className={`text-[10px] font-semibold ${
                                margin > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                <TrendingUp className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                                {margin > 0 ? '+' : ''}{formatPrice(margin)} margin
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Qty: editable even when packaging is set */}
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        className="h-8 text-sm text-center border border-slate-200 dark:border-slate-700 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />

                      {/* Buy price input */}
                      <div className="flex flex-col gap-0.5">
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className={`h-8 text-sm text-center border rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            item.amount
                              ? 'border-[#1c6a1e]/40 bg-[#1c6a1e]/5 font-semibold'
                              : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                          }`}
                        />
                        {item.itemId && item.priceSource && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500">
                            {item.priceSource === 'default' ? 'From supplier' : 'From last purchase'}
                          </span>
                        )}
                      </div>

                      {/* Row total */}
                      <div className="text-right">
                        <span className={`text-xs font-bold ${hasTotal ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                          {hasTotal ? formatPrice(itemTotal) : '—'}
                        </span>
                      </div>

                      {/* Actions: Delete + Reset stock (per linked product) */}
                      <div className="flex items-center gap-1 justify-end">
                        {item.itemId &&
                        item.currentStock != null &&
                        item.currentStock !== 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Reset stock to 0"
                            onClick={() => handleResetStockForItem(item)}
                            disabled={resettingStockItemIds.has(item.id)}
                            className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-lg transition-transform active:scale-90 disabled:opacity-70"
                          >
                            {resettingStockItemIds.has(item.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                          </Button>
                        ) : null}
                        {lineItems.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        ) : (
                          <div className="w-6" />
                        )}
                      </div>
                    </div>

                    {/* Bulk packaging row (desktop) - revealed via toggle */}
                    {item.showPackaging && (
                      <div className="px-3 pb-2.5 pt-0">
                        <div className="flex items-center gap-2 ml-4">
                          <Package className="w-3 h-3 text-indigo-500 shrink-0" />
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={PACKAGING_PRESETS.includes(item.packagingUnitName) ? item.packagingUnitName : ''}
                              onValueChange={(val) => updateLineItem(item.id, 'packagingUnitName', val)}
                            >
                              <SelectTrigger className="h-7 w-28 text-[11px] border border-indigo-200 dark:border-indigo-800 rounded-md bg-white dark:bg-slate-900">
                                <SelectValue placeholder="Pick type" />
                              </SelectTrigger>
                              <SelectContent>
                                {PACKAGING_PRESETS.map((opt) => (
                                  <SelectItem key={opt} value={opt} className="text-xs">
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="text"
                              value={item.packagingUnitName}
                              onChange={(e) => updateLineItem(item.id, 'packagingUnitName', e.target.value)}
                              placeholder="Or type custom (e.g. Sack)"
                              className="h-7 w-40 text-xs border border-indigo-200 dark:border-indigo-800 rounded-md bg-indigo-50/30 dark:bg-indigo-950/20 placeholder:text-indigo-300 dark:placeholder:text-indigo-700"
                            />
                          </div>
                        <span className="text-[10px] text-slate-400">=</span>
                        <Input
                          type="number"
                          value={item.packagingUnitQty}
                          onChange={(e) => updateLineItem(item.id, 'packagingUnitQty', e.target.value)}
                          placeholder="qty"
                          min="1"
                          step="1"
                          className="h-7 w-16 text-xs text-center border border-indigo-200 dark:border-indigo-800 rounded-md bg-indigo-50/30 dark:bg-indigo-950/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-indigo-300 dark:placeholder:text-indigo-700"
                        />
                        <span className="text-[10px] text-slate-400">{item.unitType || 'items'} ×</span>
                        <Input
                          type="number"
                          value={item.packages}
                          onChange={(e) => updateLineItem(item.id, 'packages', e.target.value)}
                          placeholder="0"
                          min="0"
                          step="1"
                          disabled={!hasPkg}
                          className="h-7 w-16 text-xs text-center border border-indigo-300 dark:border-indigo-700 rounded-md bg-indigo-50/50 dark:bg-indigo-950/30 font-semibold disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[10px] text-slate-400">{item.packagingUnitName.trim() || 'pkgs'}</span>
                        {hasPkg && qty > 0 && (
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 ml-1">
                            = {qty} {item.unitType || 'items'}
                          </span>
                        )}
                      </div>
                      </div>
                    )}
                  </div>

                  {/* ── Mobile: stacked layout ── */}
                  <div className="sm:hidden p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{index + 1}.</span>
                        {item.itemId ? (
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {item.description}
                          </span>
                        ) : (
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Item description"
                            required
                            className="h-8 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {item.itemId &&
                        item.currentStock != null &&
                        item.currentStock !== 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Reset stock to 0"
                            onClick={() => handleResetStockForItem(item)}
                            disabled={resettingStockItemIds.has(item.id)}
                            className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30 rounded-lg transition-transform active:scale-90 disabled:opacity-70 shrink-0"
                          >
                            {resettingStockItemIds.has(item.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLinePackaging(item.id)}
                          className="h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-full"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          {item.showPackaging ? 'Pkgs' : 'Pkgs'}
                        </Button>
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Mobile meta */}
                    {item.itemId && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                        <div className="flex items-center gap-1.5 w-full sm:w-auto border border-emerald-200/80 dark:border-emerald-900/50 bg-white/80 dark:bg-slate-900/70 h-6 px-2">
                          <Layers className="w-2.5 h-2.5 text-[#1c6a1e] dark:text-emerald-400 shrink-0" />
                          <Input
                            type="text"
                            value={item.batchNumber ?? ''}
                            onChange={(e) => updateLineItem(item.id, 'batchNumber', e.target.value)}
                            placeholder={batchNumberMap[item.id] || 'Lot (optional)'}
                            className="h-6 flex-1 min-w-0 max-w-32 text-[10px] font-mono bg-transparent border-0 focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none placeholder:text-slate-400"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrefillBatchNumberForItem(item.itemId!, item.id)}
                            disabled={fillingBatchFor === item.id || fillingBatchFor === 'all'}
                            className="h-6 px-1.5 text-[10px] text-[#1c6a1e] hover:bg-[#1c6a1e]/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 shrink-0"
                            title="Fill next batch number"
                          >
                            {fillingBatchFor === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Fill'}
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto border border-amber-200/80 dark:border-amber-900/50 bg-white/80 dark:bg-slate-900/70 h-6 px-2">
                          <CalendarClock className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400 shrink-0" />
                          <Input
                            type="date"
                            value={item.expiryDate ?? ''}
                            onChange={(e) => updateLineItem(item.id, 'expiryDate', e.target.value)}
                            className="h-6 flex-1 min-w-0 max-w-36 text-[10px] bg-transparent border-0 focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:outline-none placeholder:text-slate-400"
                            title="Expiry date (optional)"
                          />
                        </div>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          <Warehouse className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                          {item.currentStock != null ? `${item.currentStock} ${item.unitType || ''}` : '—'}
                        </span>
                        {item.sellPrice != null && item.sellPrice > 0 && (
                          <span className="text-slate-400">Sells @ {formatPrice(item.sellPrice)}</span>
                        )}
                        {margin !== null && (
                          <span className={`font-semibold ${margin > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {margin > 0 ? '+' : ''}{formatPrice(margin)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bulk packaging row (mobile) - revealed via toggle */}
                    {item.showPackaging && (
                      <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30 space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                              Bulk Packaging
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLinePackaging(item.id)}
                            className="h-6 px-2 text-[10px] text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full"
                          >
                            {item.showPackaging ? 'Hide' : 'Edit'}
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="text-[9px] font-medium text-indigo-500 mb-0.5 block">Package</label>
                            <div className="flex items-center gap-1">
                              <Select
                                value={PACKAGING_PRESETS.includes(item.packagingUnitName) ? item.packagingUnitName : ''}
                                onValueChange={(val) => updateLineItem(item.id, 'packagingUnitName', val)}
                              >
                                <SelectTrigger className="h-7 w-20 text-[11px] border border-indigo-200 dark:border-indigo-800 rounded-md bg-white dark:bg-slate-900">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PACKAGING_PRESETS.map((opt) => (
                                    <SelectItem key={opt} value={opt} className="text-xs">
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="text"
                                value={item.packagingUnitName}
                                onChange={(e) => updateLineItem(item.id, 'packagingUnitName', e.target.value)}
                                placeholder="Custom"
                                className="h-7 text-[11px] border border-indigo-200 dark:border-indigo-800 rounded-md bg-white dark:bg-slate-900 flex-1"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-medium text-indigo-500 mb-0.5 block">Per Pkg</label>
                            <Input
                              type="number"
                              value={item.packagingUnitQty}
                              onChange={(e) => updateLineItem(item.id, 'packagingUnitQty', e.target.value)}
                              placeholder="18"
                              min="1"
                              className="h-7 text-xs text-center border border-indigo-200 dark:border-indigo-800 rounded-md bg-white dark:bg-slate-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-medium text-indigo-500 mb-0.5 block"># {item.packagingUnitName.trim() || 'Pkgs'}</label>
                            <Input
                              type="number"
                              value={item.packages}
                              onChange={(e) => updateLineItem(item.id, 'packages', e.target.value)}
                              placeholder="0"
                              min="0"
                              disabled={!hasPkg}
                              className="h-7 text-xs text-center border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-slate-900 font-semibold disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                        {hasPkg && qty > 0 && (
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {item.packages} {item.packagingUnitName}{parseFloat(item.packages) !== 1 ? 's' : ''} × {item.packagingUnitQty} = <span className="text-sm">{qty}</span> {item.unitType || 'items'}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Price row */}
                    <div className="grid gap-2 grid-cols-3">
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                          Qty{item.unitType ? ` (${item.unitType})` : ''}
                        </label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                          placeholder="0"
                          min="0"
                          step="0.01"
                          className="h-8 text-sm border border-slate-200 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                          Buy Price
                        </label>
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className={`h-8 text-sm border rounded-lg ${
                            item.amount
                              ? 'border-[#1c6a1e]/40 bg-[#1c6a1e]/5 font-semibold'
                              : 'border-amber-400 bg-amber-50/50'
                          }`}
                        />
                        {item.itemId && item.priceSource && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5">
                            {item.priceSource === 'default' ? 'From supplier' : 'From last purchase'}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">Total</label>
                        <div className="h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                          <span className={`text-xs font-bold ${hasTotal ? 'text-slate-900 dark:text-white' : 'text-slate-300'}`}>
                            {hasTotal ? formatPrice(itemTotal) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>

          {/* Add Item at bottom - so you don't have to scroll up after adding a row */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="h-7 text-xs border-slate-300 dark:border-slate-600"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Item
            </Button>
          </div>

          {/* Grand total (+ other unpaid for supplier, combined total) */}
          <div className="p-4 bg-gradient-to-r from-[#1c6a1e]/10 via-[#1c6a1e]/5 to-[#2a8a30]/10 dark:from-[#1c6a1e]/20 dark:via-[#1c6a1e]/10 dark:to-[#2a8a30]/20 border-2 border-[#1c6a1e]/30 rounded-xl">
            {(() => {
              const itemCount = lineItems.filter((i) => i.description.trim() && i.amount).length;
              const showSupplierUnpaid =
                supplierId && !useManualSupplier;
              const otherUnpaidTotal = otherUnpaidBillsForSupplier.reduce((s, b) => s + b.amount, 0);
              const hasOtherUnpaid = showSupplierUnpaid && !loadingOtherUnpaidBills && otherUnpaidBillsForSupplier.length > 0;
              const combinedOwedTotal = totalAmount + otherUnpaidTotal;
              const unpaidLabel = billId
                ? otherUnpaidBillsForSupplier.length === 1
                  ? 'Other unpaid bill'
                  : `Other unpaid (${otherUnpaidBillsForSupplier.length})`
                : otherUnpaidBillsForSupplier.length === 1
                  ? 'Already on file (unpaid)'
                  : `Already on file (${otherUnpaidBillsForSupplier.length} unpaid)`;

              return (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                      Bill Total ({itemCount} item{itemCount !== 1 ? 's' : ''})
                    </span>
                    {linkedCount > 0 && (
                      <span className="text-[10px] text-[#1c6a1e]">
                        Stock will be updated for {linkedCount} linked item{linkedCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-stretch gap-3 sm:items-end lg:min-w-[280px]">
                    {showSupplierUnpaid && loadingOtherUnpaidBills && (
                      <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        Checking other unpaid bills…
                      </div>
                    )}

                    {hasOtherUnpaid && (
                      <div className="w-full rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/25 px-3 py-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-600 dark:text-slate-400">This bill</span>
                          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatPrice(totalAmount)}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-amber-900 dark:text-amber-100 font-medium flex items-center gap-1 min-w-0">
                              <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span className="truncate">{unpaidLabel}</span>
                            </span>
                            <span className="font-semibold tabular-nums text-amber-950 dark:text-amber-50 shrink-0">
                              {formatPrice(otherUnpaidTotal)}
                            </span>
                          </div>
                          <ul className="space-y-1 pl-5 border-l-2 border-amber-200/70 dark:border-amber-800/50">
                            {otherUnpaidBillsForSupplier.map((b) => (
                              <li key={b.id} className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
                                <span className="font-medium text-slate-800 dark:text-slate-200">{formatPrice(b.amount)}</span>
                                <span> · {formatBillDueDate(b.due_date)}</span>
                                {b.status === 'overdue' && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1 align-middle text-[9px] h-4 px-1 py-0 border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                                  >
                                    Overdue
                                  </Badge>
                                )}
                                <span className="block truncate text-slate-500 dark:text-slate-500" title={b.bill_description}>
                                  {summarizeBillDescription(b.bill_description, 48)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-2 mt-0.5 border-t border-amber-200/80 dark:border-amber-800/50 flex items-end justify-between gap-3">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Total owed</span>
                          <span className="text-2xl font-black text-[#1c6a1e] leading-none tabular-nums">
                            {formatPrice(combinedOwedTotal)}
                          </span>
                        </div>
                      </div>
                    )}

                    {!hasOtherUnpaid && (
                      <span className="text-2xl font-black text-[#1c6a1e] leading-none tabular-nums self-end">
                        {formatPrice(totalAmount)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 3: DUE DATE ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex flex-col">
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-sm">
                Due Date & Time
              </Label>
              <span className="text-[11px] text-slate-400">
                Choose a quick option or pick an exact date and time.
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: 'Today', days: 0 },
                  { label: '2 Days', days: 2 },
                  { label: '3 Days', days: 3 },
                  { label: '1 Week', days: 7 },
                  { label: '2 Weeks', days: 14 },
                  { label: '1 Month', days: 30 },
                  { label: 'Indefinite', days: null },
                ].map(({ label, days }) => {
                  const isSelected = (() => {
                    if (days === null) {
                      if (!dueDateTime) return false;
                      const selectedDate = new Date(dueDateTime);
                      const farFuture = new Date();
                      farFuture.setFullYear(farFuture.getFullYear() + 10);
                      return selectedDate.getTime() >= farFuture.getTime();
                    }
                    if (!dueDateTime) return false;
                    const selectedDate = new Date(dueDateTime);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    selectedDate.setHours(0, 0, 0, 0);
                    const diffTime = selectedDate.getTime() - today.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays === days;
                  })();

                  return (
                    <Button
                      key={label}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const pad = (n: number) => String(n).padStart(2, '0');
                        if (days === null) {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 10);
                          d.setHours(23, 59, 0, 0);
                          setDueDateTime(
                            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                          );
                        } else {
                          const d = new Date();
                          d.setDate(d.getDate() + days);
                          d.setHours(23, 59, 0, 0);
                          setDueDateTime(
                            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                          );
                        }
                      }}
                      className={`h-7 px-2.5 text-xs rounded-lg ${
                        isSelected
                          ? 'bg-[#1c6a1e] hover:bg-[#2a8a30] text-white shadow-sm'
                          : 'border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900/60'
                      }`}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              {dueDateTime && (
                <span className="hidden md:inline text-[11px] font-medium text-slate-400 whitespace-nowrap">
                  Custom date selected
                </span>
              )}
            </div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="datetime-local"
                value={dueDateTime}
                onChange={(e) => setDueDateTime(e.target.value)}
                required
                className="h-10 w-full rounded-lg border-0 bg-transparent pl-9 pr-3 text-sm text-slate-800 dark:text-slate-50 focus-visible:ring-0 focus-visible:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 4: PAYMENT METHOD ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <Label className="text-slate-800 dark:text-slate-200 font-bold text-sm">
                Payment Method
              </Label>
              <span className="text-[11px] text-slate-400">
                How does this supplier prefer to be paid? (optional)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = selectedPaymentMethods.includes(method.id);
              const Icon = method.icon;
              const colorMap: Record<string, { bg: string; border: string; text: string; activeBg: string; activeBorder: string; activeText: string }> = {
                emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-500 dark:bg-emerald-600', activeBorder: 'border-emerald-500 dark:border-emerald-600', activeText: 'text-white' },
                teal: { bg: 'bg-teal-50 dark:bg-teal-950/20', border: 'border-teal-200 dark:border-teal-800/50', text: 'text-teal-600 dark:text-teal-400', activeBg: 'bg-teal-500 dark:bg-teal-600', activeBorder: 'border-teal-500 dark:border-teal-600', activeText: 'text-white' },
                cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/20', border: 'border-cyan-200 dark:border-cyan-800/50', text: 'text-cyan-600 dark:text-cyan-400', activeBg: 'bg-cyan-500 dark:bg-cyan-600', activeBorder: 'border-cyan-500 dark:border-cyan-600', activeText: 'text-white' },
                green: { bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-200 dark:border-green-800/50', text: 'text-green-600 dark:text-green-400', activeBg: 'bg-green-500 dark:bg-green-600', activeBorder: 'border-green-500 dark:border-green-600', activeText: 'text-white' },
                blue: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800/50', text: 'text-blue-600 dark:text-blue-400', activeBg: 'bg-blue-500 dark:bg-blue-600', activeBorder: 'border-blue-500 dark:border-blue-600', activeText: 'text-white' },
                purple: { bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800/50', text: 'text-purple-600 dark:text-purple-400', activeBg: 'bg-purple-500 dark:bg-purple-600', activeBorder: 'border-purple-500 dark:border-purple-600', activeText: 'text-white' },
                amber: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800/50', text: 'text-amber-600 dark:text-amber-400', activeBg: 'bg-amber-500 dark:bg-amber-600', activeBorder: 'border-amber-500 dark:border-amber-600', activeText: 'text-white' },
                slate: { bg: 'bg-slate-50 dark:bg-slate-800/30', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', activeBg: 'bg-slate-600 dark:bg-slate-500', activeBorder: 'border-slate-600 dark:border-slate-500', activeText: 'text-white' },
              };
              const c = colorMap[method.color] || colorMap.slate;

              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => togglePaymentMethod(method.id)}
                  className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${
                    isSelected
                      ? `${c.activeBg} ${c.activeBorder} ${c.activeText} shadow-md scale-[1.02]`
                      : `${c.bg} ${c.border} ${c.text} hover:shadow-sm hover:scale-[1.01]`
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`} />
                  <span>{method.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>
          {selectedPaymentMethods.length > 0 && (
            <>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-500" />
                Supplier accepts: {selectedPaymentMethods.map((id) => PAYMENT_METHODS.find((m) => m.id === id)?.label).filter(Boolean).join(', ')}
              </p>

              {/* Smart contextual payment details input */}
              <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3 space-y-2 transition-all">
                <div className="flex items-center gap-2">
                  {(() => {
                    const firstMethod = selectedPaymentMethods[0];
                    const method = PAYMENT_METHODS.find((m) => m.id === firstMethod);
                    if (!method) return null;
                    const Icon = method.icon;
                    return <Icon className="w-3.5 h-3.5 text-slate-400" />;
                  })()}
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Payment Details
                  </Label>
                  <span className="text-[10px] text-slate-400">(optional)</span>
                </div>
                <Textarea
                  value={paymentDetails}
                  onChange={(e) => setPaymentDetails(e.target.value)}
                  placeholder={(() => {
                    const hints: string[] = [];
                    if (selectedPaymentMethods.includes('till_number')) hints.push('Till Number: ..., Business name: ...');
                    if (selectedPaymentMethods.includes('paybill')) hints.push('Paybill: ..., Account: ..., Business name: ...');
                    if (selectedPaymentMethods.includes('mpesa')) hints.push('Phone number, Name: ...');
                    if (selectedPaymentMethods.includes('bank_transfer')) hints.push('Bank: ..., Acc: ..., Name: ...');
                    if (selectedPaymentMethods.includes('cheque')) hints.push('Payable to: ...');
                    if (selectedPaymentMethods.includes('cash')) hints.push('Cash contact/pickup point');
                    if (selectedPaymentMethods.includes('credit')) hints.push('Credit terms: ...');
                    if (selectedPaymentMethods.includes('other')) hints.push('Other payment instructions');
                    return hints.length > 0 ? hints.join('\n') : 'Enter payment details...';
                  })()}
                  rows={2}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800/50 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
                {paymentDetails.trim() && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    Payment info will be saved with this bill
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ STEP 5: NOTES ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="space-y-2">
          <Label className="text-slate-600 dark:text-slate-400 font-medium text-xs">
            Notes (Optional)
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this bill..."
            rows={2}
            className="border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm"
          />
        </div>
      )}

      {/* ═══════════════ ACTIONS (fixed at bottom) ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 pb-6 pt-4 mt-6 bg-slate-50 dark:bg-[#0f1a0d] border-t border-slate-200 dark:border-slate-800 z-10">
          <div className="flex gap-3">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl border-2"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-[#1c6a1e] hover:bg-[#2a8a30] text-white font-bold text-sm shadow-lg shadow-[#1c6a1e]/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {isEditMode ? 'Save changes' : `Create Bill — ${formatPrice(totalAmount)}`}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════ NEW SUPPLIER DIALOG ═══════════════ */}
      <Dialog open={newSupplierDialogOpen} onOpenChange={setNewSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md z-[60]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1c6a1e]" />
              Add New Supplier
            </DialogTitle>
            <DialogDescription>
              Create a new supplier that will be available for future bills
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {supplierError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{supplierError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="supplier-name" className="text-slate-700 dark:text-slate-300 font-bold">
                Supplier Name *
              </Label>
              <Input
                id="supplier-name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Enter supplier name"
                required
                className="h-12 border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-phone" className="text-slate-700 dark:text-slate-300 font-bold">
                  Phone
                </Label>
                <Input
                  id="supplier-phone"
                  type="tel"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="Phone number"
                  className="h-12 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email" className="text-slate-700 dark:text-slate-300 font-bold">
                  Email
                </Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  placeholder="Email address"
                  className="h-12 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-location" className="text-slate-700 dark:text-slate-300 font-bold">
                Location
              </Label>
              <Input
                id="supplier-location"
                value={newSupplierLocation}
                onChange={(e) => setNewSupplierLocation(e.target.value)}
                placeholder="Supplier location"
                className="h-12 border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-notes" className="text-slate-700 dark:text-slate-300 font-bold">
                Notes
              </Label>
              <Textarea
                id="supplier-notes"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                placeholder="Additional notes about this supplier"
                rows={3}
                className="border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            {productTypes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[#1c6a1e]" />
                  Type
                </Label>
                <Select value={newSupplierType || 'none'} onValueChange={(v) => setNewSupplierType(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-12 border-2 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select type (optional)" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="none">None</SelectItem>
                    {productTypes.map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.emoji} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewSupplierDialogOpen(false);
                setSupplierError(null);
                setNewSupplierName('');
                setNewSupplierPhone('');
                setNewSupplierEmail('');
                setNewSupplierLocation('');
                setNewSupplierNotes('');
                setNewSupplierType('');
              }}
              disabled={isCreatingSupplier}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateSupplier}
              disabled={isCreatingSupplier}
              className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
            >
              {isCreatingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Supplier
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ EDIT SUPPLIER DIALOG ═══════════════ */}
      <Dialog open={editSupplierDialogOpen} onOpenChange={setEditSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md z-[60]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1c6a1e]" />
              Edit Supplier
            </DialogTitle>
            <DialogDescription>
              Update this supplier&apos;s contact and profile information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editSupplierError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{editSupplierError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-supplier-name" className="text-slate-700 dark:text-slate-300 font-bold">
                Supplier Name *
              </Label>
              <Input
                id="edit-supplier-name"
                value={editSupplierName}
                onChange={(e) => setEditSupplierName(e.target.value)}
                placeholder="Enter supplier name"
                required
                className="h-12 border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-supplier-phone" className="text-slate-700 dark:text-slate-300 font-bold">
                  Phone
                </Label>
                <Input
                  id="edit-supplier-phone"
                  type="tel"
                  value={editSupplierPhone}
                  onChange={(e) => setEditSupplierPhone(e.target.value)}
                  placeholder="Phone number"
                  className="h-12 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier-email" className="text-slate-700 dark:text-slate-300 font-bold">
                  Email
                </Label>
                <Input
                  id="edit-supplier-email"
                  type="email"
                  value={editSupplierEmail}
                  onChange={(e) => setEditSupplierEmail(e.target.value)}
                  placeholder="Email address"
                  className="h-12 border-2 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-supplier-location" className="text-slate-700 dark:text-slate-300 font-bold">
                Location
              </Label>
              <Input
                id="edit-supplier-location"
                value={editSupplierLocation}
                onChange={(e) => setEditSupplierLocation(e.target.value)}
                placeholder="Supplier location"
                className="h-12 border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-supplier-notes" className="text-slate-700 dark:text-slate-300 font-bold">
                Notes
              </Label>
              <Textarea
                id="edit-supplier-notes"
                value={editSupplierNotes}
                onChange={(e) => setEditSupplierNotes(e.target.value)}
                placeholder="Additional notes about this supplier"
                rows={3}
                className="border-2 border-slate-200 dark:border-slate-700"
              />
            </div>

            {productTypes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[#1c6a1e]" />
                  Type
                </Label>
                <Select value={editSupplierType || 'none'} onValueChange={(v) => setEditSupplierType(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-12 border-2 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Select type (optional)" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="none">None</SelectItem>
                    {productTypes.map((t) => (
                      <SelectItem key={t.key} value={t.key}>{t.emoji} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment method & details (same options as bill form) */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <Label className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                  Payment methods accepted
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = editSupplierPaymentMethods.includes(method.id);
                  const Icon = method.icon;
                  const colorMap: Record<string, string> = {
                    emerald: isSelected ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-600 dark:text-emerald-400',
                    teal: isSelected ? 'bg-teal-500 text-white border-teal-500' : 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 text-teal-600 dark:text-teal-400',
                    cyan: isSelected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 text-cyan-600 dark:text-cyan-400',
                    green: isSelected ? 'bg-green-500 text-white border-green-500' : 'bg-green-50 dark:bg-green-950/20 border-green-200 text-green-600 dark:text-green-400',
                    blue: isSelected ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 text-blue-600 dark:text-blue-400',
                    purple: isSelected ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 text-purple-600 dark:text-purple-400',
                    amber: isSelected ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 text-amber-600 dark:text-amber-400',
                    slate: isSelected ? 'bg-slate-600 text-white border-slate-600' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 text-slate-600 dark:text-slate-400',
                  };
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setEditSupplierPaymentMethods((prev) =>
                          prev.includes(method.id)
                            ? prev.filter((m) => m !== method.id)
                            : [...prev, method.id]
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${colorMap[method.color] || colorMap.slate}`}
                    >
                      <Icon className="w-3 h-3" />
                      {method.label}
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600 dark:text-slate-400 font-medium text-xs">
                  Payment details (Till, Paybill, bank account, etc.)
                </Label>
                <Textarea
                  value={editSupplierPaymentDetails}
                  onChange={(e) => setEditSupplierPaymentDetails(e.target.value)}
                  placeholder="e.g. Till: 123456, Paybill: 888888 Acc: 001, Bank: KCB 1234567890"
                  rows={2}
                  className="border-2 border-slate-200 dark:border-slate-700 text-sm rounded-lg"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditSupplierDialogOpen(false);
                setEditSupplierError(null);
              }}
              disabled={isUpdatingSupplier}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateSupplier}
              disabled={isUpdatingSupplier}
              className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
            >
              {isUpdatingSupplier ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
