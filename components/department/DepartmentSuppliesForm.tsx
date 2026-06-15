'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import type { Item } from '@/lib/db/types';
import { toast } from 'sonner';

interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
}

interface BillLine {
  id: string;
  itemId: string;
  quantity: string;
  cost: string;
}

interface DepartmentSuppliesFormProps {
  assignedTypes: string[];
  onSuccess?: () => void;
}

export function DepartmentSuppliesForm({
  assignedTypes,
  onSuccess,
}: DepartmentSuppliesFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [lines, setLines] = useState<BillLine[]>([
    { id: '1', itemId: '', quantity: '', cost: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: 'true', sellableOnly: 'true' });
      if (assignedTypes.length > 0) {
        params.set('itemTypes', assignedTypes.join(','));
      }
      const [supRes, itemsRes] = await Promise.all([
        apiGet<Supplier[]>('/api/suppliers'),
        fetch(`/api/items?${params}`).then((r) => r.json()),
      ]);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (itemsRes.success) setItems(itemsRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [assignedTypes]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lineTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const q = parseFloat(line.quantity);
      const c = parseFloat(line.cost);
      if (isNaN(q) || isNaN(c) || q <= 0 || c <= 0) return sum;
      return sum + q * c;
    }, 0);
  }, [lines]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: String(Date.now()), itemId: '', quantity: '', cost: '' },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const updateLine = (id: string, patch: Partial<BillLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const createSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    const result = await apiPost<{ supplierId: string }>('/api/suppliers', {
      name: newSupplierName.trim(),
      contactPhone: newSupplierPhone.trim() || null,
    });
    if (result.success && result.data) {
      toast.success('Supplier added');
      setSupplierId(result.data.supplierId);
      setShowNewSupplier(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
      void loadData();
    } else {
      toast.error(result.message || 'Failed to add supplier');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Select a supplier');
      return;
    }
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;

    const stockItems = lines
      .map((line) => ({
        itemId: line.itemId,
        quantity: parseFloat(line.quantity),
        costPricePerUnit: parseFloat(line.cost),
      }))
      .filter(
        (l) => l.itemId && !isNaN(l.quantity) && l.quantity > 0 && !isNaN(l.costPricePerUnit) && l.costPricePerUnit > 0,
      );

    if (stockItems.length === 0) {
      toast.error('Add at least one product line');
      return;
    }

    const amount = Math.round(lineTotal * 100) / 100;
    const due = new Date();
    due.setDate(due.getDate() + 30);

    setSubmitting(true);
    try {
      const result = await apiPost('/api/supplier-bills', {
        supplierId,
        supplierName: supplier.name,
        supplierPhone: supplier.contact_phone,
        billDescription: `Supply delivery — ${stockItems.length} item(s)`,
        amount,
        dueDate: due.toISOString().split('T')[0],
        notes: notes.trim() || null,
        stockItems,
      });

      if (result.success) {
        toast.success('Supply recorded');
        setLines([{ id: '1', itemId: '', quantity: '', cost: '' }]);
        setNotes('');
        onSuccess?.();
      } else {
        toast.error(result.message || 'Failed to record supply');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#1c6a1e]" />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-3 pb-6">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-slate-500">Supplier</Label>
        {!showNewSupplier ? (
          <div className="flex gap-2">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="flex-1 h-10">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={() => setShowNewSupplier(true)}
              aria-label="Add supplier"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
            <Input
              placeholder="Supplier name"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="h-10"
            />
            <Input
              placeholder="Phone (optional)"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
              className="h-10"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewSupplier(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1 bg-[#1c6a1e]" onClick={() => void createSupplier()}>
                Save supplier
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase text-slate-500">Products received</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addLine} className="h-8 text-[#1c6a1e]">
            <Plus className="w-4 h-4 mr-1" />
            Add line
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[1fr_4rem_4.5rem_auto] gap-1.5 items-center"
            >
              <Select
                value={line.itemId}
                onValueChange={(v) => updateLine(line.id, { itemId: v })}
              >
                <SelectTrigger className="h-9 text-xs min-w-0">
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                className="h-9 text-xs px-1.5"
              />
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="Cost"
                value={line.cost}
                onChange={(e) => updateLine(line.id, { cost: e.target.value })}
                className="h-9 text-xs px-1.5"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-red-500"
                onClick={() => removeLine(line.id)}
                disabled={lines.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-right text-sm font-bold text-[#1c6a1e] tabular-nums">
          Total: KES {lineTotal.toFixed(0)}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase text-slate-500">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Delivery details..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      <Button
        type="submit"
        disabled={submitting || lineTotal <= 0}
        className="w-full h-11 bg-[#1c6a1e] hover:bg-[#165a19]"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Truck className="w-4 h-4 mr-2" />
            Record supply
          </>
        )}
      </Button>
    </form>
  );
}
