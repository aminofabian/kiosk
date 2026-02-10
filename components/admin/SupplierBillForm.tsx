'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '@/lib/utils/api-client';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

interface BillLineItem {
  id: string;
  description: string;
  quantity: string;
  amount: string; // unit price
  itemId?: string; // linked product item ID (for stock updates)
  currentStock?: number; // current stock level (display only)
  unitType?: string; // e.g. kg, piece (display only)
  sellPrice?: number; // current sell price (display only)
}

interface SupplierBillFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preSelectedSupplierId?: string;
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
}

export function SupplierBillForm({ onSuccess, onCancel, preSelectedSupplierId }: SupplierBillFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [lineItems, setLineItems] = useState<BillLineItem[]>([
    { id: '1', description: '', quantity: '0', amount: '' },
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
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [loadingLinkedProducts, setLoadingLinkedProducts] = useState(false);
  const [useManualSupplier, setUseManualSupplier] = useState(false);

  // Filtered suppliers based on search, sorted alphabetically by name
  const filteredSuppliers = useMemo(() => {
    const list = !supplierSearch.trim()
      ? suppliers
      : suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
            (s.contact_phone && s.contact_phone.includes(supplierSearch))
        );
    return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [suppliers, supplierSearch]);

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        setLoadingSuppliers(true);
        const result = await apiGet<Supplier[]>('/api/suppliers');
        if (result.success) {
          setSuppliers(result.data || []);
          if (preSelectedSupplierId) {
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
  }, []);

  // Fetch linked products when supplier changes
  useEffect(() => {
    if (!supplierId) return;

    async function fetchLinkedProducts() {
      setLoadingLinkedProducts(true);
      try {
        const result = await apiGet<LinkedProduct[]>(
          `/api/suppliers/${supplierId}/products`
        );
        if (result.success && result.data && result.data.length > 0) {
          const newLineItems: BillLineItem[] = result.data.map((product, index) => {
            const displayName = product.variant_name
              ? `${product.item_name} - ${product.variant_name}`
              : product.item_name;
            // Prefill buy price: saved default > last inventory batch buy price > empty
            const buyPrice = product.default_cost_price != null
              ? product.default_cost_price
              : product.last_buy_price != null
                ? product.last_buy_price
                : null;
            return {
              id: `linked-${index}-${Date.now()}`,
              description: displayName,
              quantity: '0',
              amount: buyPrice != null ? String(buyPrice) : '',
              itemId: product.item_id,
              currentStock: product.current_stock,
              unitType: product.unit_type,
              sellPrice: product.current_sell_price,
            };
          });
          setLineItems(newLineItems);
        }
      } catch (err) {
        console.error('Error fetching linked products:', err);
      } finally {
        setLoadingLinkedProducts(false);
      }
    }

    fetchLinkedProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const handleSelectSupplier = (supplier: Supplier) => {
    setSupplierId(supplier.id);
    setSupplierName(supplier.name);
    setSupplierPhone(supplier.contact_phone || '');
    setUseManualSupplier(false);
  };

  const handleClearSupplier = () => {
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setLineItems([{ id: '1', description: '', quantity: '0', amount: '' }]);
    setUseManualSupplier(false);
    setSupplierSearch('');
  };

  const handleUseManual = () => {
    setSupplierId('');
    setSupplierName('');
    setSupplierPhone('');
    setUseManualSupplier(true);
    setLineItems([{ id: '1', description: '', quantity: '0', amount: '' }]);
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

  // Calculate total from line items (quantity x unit price)
  const totalAmount = lineItems.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity || '0');
    const unitPrice = parseFloat(item.amount || '0');
    const itemTotal = quantity * unitPrice;
    return sum + (isNaN(itemTotal) ? 0 : itemTotal);
  }, 0);

  const linkedCount = lineItems.filter((i) => i.itemId).length;

  const formatBillDescription = () => {
    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity && item.amount
    );
    if (validItems.length === 0) return '';

    if (validItems.length === 1) {
      const item = validItems[0];
      const qty = parseFloat(item.quantity || '1');
      const unitPrice = parseFloat(item.amount || '0');
      const total = qty * unitPrice;
      return `${item.description.trim()} (${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)})`;
    }

    return validItems
      .map((item, index) => {
        const qty = parseFloat(item.quantity || '1');
        const unitPrice = parseFloat(item.amount || '0');
        const total = qty * unitPrice;
        return `${index + 1}. ${item.description.trim()} - ${qty} × KES ${unitPrice.toFixed(2)} = KES ${total.toFixed(2)}`;
      })
      .join('\n');
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now().toString(), description: '', quantity: '0', amount: '' },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: 'description' | 'quantity' | 'amount', value: string) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError('Supplier name is required');
      return;
    }

    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity && item.amount
    );

    if (validItems.length === 0) {
      setError('Please add at least one bill item with description, quantity, and amount');
      return;
    }

    for (const item of validItems) {
      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.amount);

      if (isNaN(quantity) || quantity <= 0) {
        setError(`Please enter a valid quantity for "${item.description.trim()}"`);
        return;
      }

      if (isNaN(unitPrice) || unitPrice <= 0) {
        setError(`Please enter a valid buy price for "${item.description.trim()}"`);
        return;
      }
    }

    if (totalAmount <= 0) {
      setError('Total amount must be greater than 0');
      return;
    }

    if (!dueDateTime) {
      setError('Due date and time are required');
      return;
    }

    setIsSubmitting(true);

    try {
      const billDescription = formatBillDescription();

      const allValid = lineItems.filter(
        (item) => item.description.trim() && item.quantity && item.amount
      );
      const stockItems = allValid
        .filter((item) => item.itemId)
        .map((item) => ({
          itemId: item.itemId!,
          quantity: parseFloat(item.quantity),
          costPricePerUnit: parseFloat(item.amount),
        }));

      const result = await apiPost('/api/supplier-bills', {
        supplierId: supplierId || null,
        supplierName: supplierName.trim(),
        supplierPhone: supplierPhone.trim() || null,
        billDescription: billDescription,
        amount: totalAmount,
        dueDate: dueDateTime,
        notes: notes.trim() || null,
        stockItems: stockItems.length > 0 ? stockItems : undefined,
      });

      if (result.success) {
        // Update default cost price for linked products when user changed the buy price
        if (supplierId) {
          const linkedWithPrice = allValid.filter(
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
        if (onSuccess) onSuccess();
      } else {
        setError(result.message || 'Failed to create supplier bill');
      }
    } catch (err) {
      console.error('Error creating supplier bill:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default due to today at end of day (23:59)
  useEffect(() => {
    if (!dueDateTime) {
      const d = new Date();
      d.setHours(23, 59, 0, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      setDueDateTime(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
  }, [dueDateTime]);

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

  // ────────────────────────── RENDER ──────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            <div className="w-6 h-6 rounded-lg bg-[#259783]/10 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-[#259783]" />
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
              className="h-7 text-xs border-[#259783]/30 text-[#259783] hover:bg-[#259783]/5"
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
                <p className="font-bold text-sm" style={{ color: colors.text }}>
                  {selected.name}
                </p>
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

        {/* Supplier grid picker */}
        {!supplierId && !useManualSupplier && (
          <>
            {loadingSuppliers ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading suppliers...</span>
              </div>
            ) : (
              <>
                {/* Search */}
                {suppliers.length > 4 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder="Search suppliers..."
                      className="pl-9 h-10 border-2 border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                )}

                {/* Grid of supplier cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 pr-1">
                  {filteredSuppliers.map((supplier) => {
                    const colors = getSupplierColor(supplier.name);
                    return (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => handleSelectSupplier(supplier)}
                        className="group relative flex items-center gap-2.5 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all text-left"
                        style={{
                          // subtle accent on hover via inline style
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colors.accent;
                          e.currentTarget.style.backgroundColor = colors.bg;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '';
                          e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: colors.accent, color: '#fff' }}
                        >
                          {getInitials(supplier.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {supplier.name}
                          </p>
                          {supplier.contact_phone && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {supplier.contact_phone}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                      </button>
                    );
                  })}

                  {filteredSuppliers.length === 0 && (
                    <div className="col-span-full py-6 text-center">
                      <p className="text-sm text-slate-400">
                        {supplierSearch ? 'No suppliers match your search' : 'No suppliers yet'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
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
                <div className="flex items-center gap-1 text-[#259783]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[10px]">Loading products...</span>
                </div>
              )}
            </div>
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

          {/* Table-style header (visible on larger screens) */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_90px_28px] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Product</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Buy Price</span>
            <span className="text-right">Total</span>
            <span></span>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {lineItems.map((item, index) => {
              const qty = parseFloat(item.quantity || '0');
              const buyPrice = parseFloat(item.amount || '0');
              const itemTotal = qty * buyPrice;
              const hasTotal = !isNaN(itemTotal) && itemTotal > 0;
              const margin = item.sellPrice && buyPrice > 0 ? item.sellPrice - buyPrice : null;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    item.itemId
                      ? 'border-[#259783]/30 bg-[#259783]/[0.02] dark:bg-[#259783]/[0.04]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  {/* ── Desktop: single-row layout ── */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_90px_28px] gap-2 items-center px-3 py-2.5">
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
                      </div>
                      {/* Meta row for linked items */}
                      {item.itemId && (
                        <div className="flex items-center gap-3 mt-0.5 ml-4">
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

                    {/* Qty input */}
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                      onFocus={(e) => { if (item.quantity === '0') e.target.select(); }}
                      placeholder="0"
                      required
                      min="0"
                      step="0.01"
                      className="h-8 text-sm text-center border border-slate-200 dark:border-slate-700 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    {/* Buy price input */}
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      required
                      min="0"
                      step="0.01"
                      className={`h-8 text-sm text-center border rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        item.amount
                          ? 'border-[#259783]/40 bg-[#259783]/5 font-semibold'
                          : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                      }`}
                    />

                    {/* Row total */}
                    <div className="text-right">
                      <span className={`text-xs font-bold ${hasTotal ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                        {hasTotal ? formatPrice(itemTotal) : '—'}
                      </span>
                    </div>

                    {/* Delete */}
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
                      {lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="h-6 w-6 p-0 text-slate-300 hover:text-red-500 shrink-0 ml-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {/* Mobile meta */}
                    {item.itemId && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
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

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-medium text-slate-400 mb-0.5 block">
                          Qty{item.unitType ? ` (${item.unitType})` : ''}
                        </label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                          onFocus={(e) => { if (item.quantity === '0') e.target.select(); }}
                          placeholder="0"
                          required
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
                          required
                          min="0"
                          step="0.01"
                          className={`h-8 text-sm border rounded-lg ${
                            item.amount
                              ? 'border-[#259783]/40 bg-[#259783]/5 font-semibold'
                              : 'border-amber-400 bg-amber-50/50'
                          }`}
                        />
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
            })}
          </div>

          {/* Grand total */}
          <div className="p-4 bg-gradient-to-r from-[#259783]/10 via-[#259783]/5 to-[#3bd522]/10 dark:from-[#259783]/20 dark:via-[#259783]/10 dark:to-[#3bd522]/20 border-2 border-[#259783]/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                  Bill Total ({lineItems.filter((i) => i.description.trim() && i.amount).length} item{lineItems.filter((i) => i.description.trim() && i.amount).length !== 1 ? 's' : ''})
                </span>
                {linkedCount > 0 && (
                  <span className="text-[10px] text-[#259783]">
                    Stock will be updated for {linkedCount} linked item{linkedCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <span className="text-2xl font-black text-[#259783]">
                {formatPrice(totalAmount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 3: DUE DATE ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <Label className="text-slate-800 dark:text-slate-200 font-bold text-sm">
              Due Date & Time
            </Label>
          </div>
          <div className="space-y-2">
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
                        ? 'bg-[#259783] hover:bg-[#1e7a6a] text-white'
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <Input
              type="datetime-local"
              value={dueDateTime}
              onChange={(e) => setDueDateTime(e.target.value)}
              required
              className="h-10 border-2 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 4: NOTES ═══════════════ */}
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

      {/* ═══════════════ ACTIONS ═══════════════ */}
      {(supplierId || useManualSupplier) && (
        <div className="flex gap-3 pt-1">
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
            className="flex-1 h-12 rounded-xl bg-[#259783] hover:bg-[#1e7a6a] text-white font-bold text-sm shadow-lg shadow-[#259783]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create Bill — {formatPrice(totalAmount)}
              </>
            )}
          </Button>
        </div>
      )}

      {/* ═══════════════ NEW SUPPLIER DIALOG ═══════════════ */}
      <Dialog open={newSupplierDialogOpen} onOpenChange={setNewSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#259783]" />
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
              }}
              disabled={isCreatingSupplier}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateSupplier}
              disabled={isCreatingSupplier}
              className="bg-[#259783] hover:bg-[#1e7a6a] text-white"
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
    </form>
  );
}
