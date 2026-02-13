'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { toast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  location?: string | null;
  notes?: string | null;
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
  currentStock?: number; // current stock level (display only)
  unitType?: string; // e.g. kg, piece (display only)
  sellPrice?: number; // current sell price (display only)
  showPackaging?: boolean; // UI: whether packaging row is expanded
}

interface SupplierBillFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preSelectedSupplierId?: string;
  onOpenManageLinkProducts?: (supplier: Supplier) => void;
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

export function SupplierBillForm({ onSuccess, onCancel, preSelectedSupplierId, onOpenManageLinkProducts }: SupplierBillFormProps) {
  const PACKAGING_PRESETS = ['Carton', 'Sack', 'Net', 'Crate', 'Box', 'Bag', 'Bale', 'Bundle', 'Tray'];
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
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);
  const [editSupplierError, setEditSupplierError] = useState<string | null>(null);
  const [isResettingStock, setIsResettingStock] = useState(false);

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
              quantity: '',
              amount: buyPrice != null ? String(buyPrice) : '',
              packages: '',
              packagingUnitName: product.packaging_unit_name || '',
              packagingUnitQty: product.packaging_unit_qty ? String(product.packaging_unit_qty) : '',
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
    setLineItems([{ id: '1', description: '', quantity: '', amount: '', packages: '', packagingUnitName: '', packagingUnitQty: '' }]);
    setUseManualSupplier(false);
    setSupplierSearch('');
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

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: 'description' | 'quantity' | 'amount' | 'packages' | 'packagingUnitName' | 'packagingUnitQty', value: string) => {
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

  const toggleLinePackaging = (id: string) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, showPackaging: !item.showPackaging } : item
      )
    );
  };

  const handleResetStockToZero = async () => {
    if (isResettingStock) return;

    const itemsToReset = lineItems.filter(
      (item) =>
        item.itemId &&
        item.currentStock != null &&
        item.currentStock !== 0
    );

    if (itemsToReset.length === 0) {
      toast.info('No linked products with stock to reset.');
      return;
    }

    toast(
      `This will reset current stock to 0 for ${itemsToReset.length} linked product${
        itemsToReset.length !== 1 ? 's' : ''
      } (including negatives). This cannot be undone.`,
      {
        action: {
          label: 'Continue',
          onClick: async () => {
            setIsResettingStock(true);
            try {
              const results = await Promise.allSettled(
                itemsToReset.map((item) => {
                  const current = item.currentStock!;
                  const adjustmentType = current > 0 ? 'decrease' : 'increase';
                  const quantity = Math.abs(current);

                  return apiPost('/api/stock/adjust', {
                    itemId: item.itemId!,
                    adjustmentType,
                    quantity,
                    reason: 'counting_error',
                    notes: 'Reset from Supplier Bill',
                  });
                })
              );

              const succeededItemIds = new Set(
                itemsToReset
                  .map((item, index) => {
                    const res = results[index];
                    if (
                      res.status === 'fulfilled' &&
                      (res.value as { success?: boolean })?.success
                    ) {
                      return item.itemId!;
                    }
                    return null;
                  })
                  .filter((id): id is string => Boolean(id))
              );

              if (succeededItemIds.size === 0) {
                toast.error('Failed to reset stock. Please try again.');
                return;
              }

              setLineItems((prev) =>
                prev.map((item) =>
                  item.itemId && succeededItemIds.has(item.itemId)
                    ? { ...item, currentStock: 0 }
                    : item
                )
              );

              toast.success(
                `Stock reset to zero for ${succeededItemIds.size} product${
                  succeededItemIds.size !== 1 ? 's' : ''
                }.`
              );
            } catch (err) {
              console.error('Error resetting stock:', err);
              toast.error('Failed to reset stock. Please try again.');
            } finally {
              setIsResettingStock(false);
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

    const validItems = lineItems.filter(
      (item) => item.description.trim() && item.quantity
    );

    if (validItems.length === 0) {
      setError('Please add at least one bill item with description and quantity');
      return;
    }

    for (const item of validItems) {
      const quantity = parseFloat(item.quantity || '0');

      if (isNaN(quantity) || quantity <= 0) {
        setError(`Please enter a valid quantity for "${item.description.trim()}"`);
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

      // Lines that will actually update stock (must have quantity and buy price)
      const stockSourceItems = lineItems.filter(
        (item) => item.description.trim() && item.quantity && item.amount
      );
      const stockItems = stockSourceItems
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
          // Any linked product with a non-zero amount should update its default cost,
          // even if quantity was left empty (e.g. adjusting price only).
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
                      className="h-6 px-2 text-[10px] border-[#259783]/40 text-[#259783] hover:bg-[#259783]/10 rounded-full"
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
            <div className="flex items-center gap-2">
              {linkedCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetStockToZero}
                  disabled={isResettingStock}
                  className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {isResettingStock ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Reset stock
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3 mr-1" />
                      Reset stock
                    </>
                  )}
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
              const hasPkg = !!(item.packagingUnitName.trim() && item.packagingUnitQty && parseFloat(item.packagingUnitQty) > 0);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    item.itemId
                      ? 'border-[#259783]/30 bg-[#259783]/[0.02] dark:bg-[#259783]/[0.04]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  {/* ── Desktop layout ── */}
                  <div className="hidden sm:block">
                    {/* Main row */}
                    <div className="grid sm:grid-cols-[1fr_80px_100px_90px_28px] gap-2 items-center px-3 py-2.5">
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
                      <Input
                        type="number"
                        value={item.amount}
                        onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                        placeholder="0.00"
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
                          ? 'bg-[#259783] hover:bg-[#1e7a6a] text-white shadow-sm'
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
        <DialogContent className="sm:max-w-md z-[60]">
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

      {/* ═══════════════ EDIT SUPPLIER DIALOG ═══════════════ */}
      <Dialog open={editSupplierDialogOpen} onOpenChange={setEditSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md z-[60]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#259783]" />
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
              className="bg-[#259783] hover:bg-[#1e7a6a] text-white"
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
