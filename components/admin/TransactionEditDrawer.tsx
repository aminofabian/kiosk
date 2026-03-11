'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
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
import { Loader2, Plus, Trash2, Search, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '@/lib/utils/api-client';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'credit', label: 'Credit' },
] as const;

interface EditItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
}

interface SaleDetail {
  sale: {
    id: string;
    total_amount: number;
    payment_method: string;
    customer_name: string | null;
    customer_phone: string | null;
  };
  items: Array<{
    item_id: string;
    item_name: string;
    quantity_sold: number;
    sell_price_per_unit: number;
  }>;
}

interface SuggestItem {
  id: string;
  name: string;
  current_sell_price: number;
  variant_name?: string | null;
}

const formatPrice = (price: number) =>
  `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface TransactionEditDrawerProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransactionEditDrawer({
  saleId,
  open,
  onOpenChange,
  onSuccess,
}: TransactionEditDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EditItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [addSuggestions, setAddSuggestions] = useState<SuggestItem[]>([]);
  const [showAddSearch, setShowAddSearch] = useState(false);

  const fetchSale = useCallback(async () => {
    if (!saleId || !open) return;
    setLoading(true);
    try {
      const result = await apiGet<SaleDetail>(`/api/sales/${saleId}`);
      if (result.success && result.data) {
        const { sale, items: saleItems } = result.data;
        setItems(
          saleItems.map((i) => ({
            itemId: i.item_id,
            itemName: i.item_name,
            quantity: i.quantity_sold,
            price: i.sell_price_per_unit,
          }))
        );
        const pm = ['cash', 'mpesa', 'credit'].includes(sale.payment_method)
          ? sale.payment_method
          : 'cash';
        setPaymentMethod(pm);
        setCustomerName(sale.customer_name || '');
        setCustomerPhone(sale.customer_phone || '');
      } else {
        toast.error(result.message || 'Failed to load sale');
        onOpenChange(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sale');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [saleId, open, onOpenChange]);

  useEffect(() => {
    if (open && saleId) fetchSale();
  }, [open, saleId, fetchSale]);

  useEffect(() => {
    if (!addSearch.trim()) {
      setAddSuggestions([]);
      return;
    }
    const controller = new AbortController();
    fetch(
      `/api/items/suggest?q=${encodeURIComponent(addSearch)}&limit=8`,
      { signal: controller.signal, cache: 'no-store' }
    )
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setAddSuggestions(res.data);
        else setAddSuggestions([]);
      })
      .catch(() => setAddSuggestions([]));
    return () => controller.abort();
  }, [addSearch]);

  const updateItem = (idx: number, updates: Partial<EditItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = (suggestion: SuggestItem) => {
    const name = suggestion.variant_name
      ? `${suggestion.name} - ${suggestion.variant_name}`
      : suggestion.name;
    if (items.some((i) => i.itemId === suggestion.id)) {
      toast.error('Item already in sale');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        itemId: suggestion.id,
        itemName: name,
        quantity: 1,
        price: suggestion.current_sell_price,
      },
    ]);
    setAddSearch('');
    setAddSuggestions([]);
    setShowAddSearch(false);
  };

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    if (paymentMethod === 'credit' && !customerName.trim()) {
      toast.error('Customer name is required for credit sales');
      return;
    }
    setSaving(true);
    try {
      const voidResult = await apiPatch(`/api/sales/${saleId}`, {
        action: 'void',
        reason: 'Edited by admin',
      });
      if (!voidResult.success) {
        toast.error(voidResult.message || 'Failed to void original sale');
        return;
      }
      const createBody = {
        fromEdit: true,
        items: items.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          price: i.price,
        })),
        paymentMethod,
        customerName: paymentMethod === 'credit' ? customerName.trim() || undefined : undefined,
        customerPhone: paymentMethod === 'credit' ? customerPhone.trim() || undefined : undefined,
      };
      const createResult = await apiPost<{ saleId: string }>('/api/sales', createBody);
      if (createResult.success) {
        toast.success('Transaction updated');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(createResult.message || 'Failed to create updated sale');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Edit transaction</DrawerTitle>
          <DrawerDescription>
            Changes will void the original sale and create a corrected one.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Items</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowAddSearch(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add item
                  </Button>
                </div>
                {showAddSearch && (
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search items..."
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => {
                        setShowAddSearch(false);
                        setAddSearch('');
                        setAddSuggestions([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {addSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-white dark:bg-slate-900 shadow-lg max-h-48 overflow-y-auto">
                        {addSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between items-center"
                            onClick={() => addItem(s)}
                          >
                            <span className="truncate">
                              {s.variant_name ? `${s.name} - ${s.variant_name}` : s.name}
                            </span>
                            <span className="text-slate-500 shrink-0 ml-2">
                              {formatPrice(s.current_sell_price)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={`${item.itemId}-${idx}`}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.itemName}</p>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8 w-20"
                          />
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={item.price}
                            onChange={(e) =>
                              updateItem(idx, { price: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8 w-24"
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums shrink-0">
                        {formatPrice(item.quantity * item.price)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 shrink-0"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <Label>Payment method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>
                        {pm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'credit' && (
                <div className="space-y-2">
                  <Label>Customer (for credit)</Label>
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="Phone (optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-lg font-semibold">
                  Total: {formatPrice(totalAmount)}
                </p>
              </div>
            </div>
          )}
        </div>
        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
