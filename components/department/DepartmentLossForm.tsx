'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { apiPost } from '@/lib/utils/api-client';
import type { Item } from '@/lib/db/types';
import type { AdjustmentReason } from '@/lib/constants';
import { isDiscreteUnitType } from '@/lib/constants';
import { toast } from 'sonner';

const LOSS_REASONS: { key: AdjustmentReason; label: string }[] = [
  { key: 'spoilage', label: 'Spoilage' },
  { key: 'damage', label: 'Damage' },
  { key: 'theft', label: 'Theft' },
  { key: 'other', label: 'Other' },
];

interface DepartmentLossFormProps {
  assignedTypes: string[];
  onSuccess?: () => void;
}

export function DepartmentLossForm({ assignedTypes, onSuccess }: DepartmentLossFormProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('spoilage');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: 'true', sellableOnly: 'true' });
      if (assignedTypes.length > 0) {
        params.set('itemTypes', assignedTypes.join(','));
      }
      const res = await fetch(`/api/items?${params}`);
      const result = await res.json();
      if (result.success) setItems(result.data);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [assignedTypes]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const selectedItem = items.find((i) => i.id === itemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId || !selectedItem) {
      toast.error('Select a product');
      return;
    }
    const isDiscrete = isDiscreteUnitType(selectedItem.unit_type);
    const qty = isDiscrete ? parseInt(quantity, 10) : parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    if (qty > selectedItem.current_stock) {
      toast.error('Quantity exceeds current stock');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiPost('/api/stock/adjust', {
        itemId,
        adjustmentType: 'decrease',
        quantity: qty,
        reason,
        notes: notes.trim() || null,
      });
      if (result.success) {
        toast.success('Loss recorded');
        setQuantity('');
        setNotes('');
        onSuccess?.();
        void loadItems();
      } else {
        toast.error(result.message || 'Failed to record loss');
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
        <Label className="text-xs font-semibold uppercase text-slate-500">Product</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} ({item.current_stock} {item.unit_type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-slate-500">Reason</Label>
        <div className="flex flex-wrap gap-1.5">
          {LOSS_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setReason(r.key)}
              className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                reason === r.key
                  ? 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-slate-500">
          Quantity {selectedItem ? `(${selectedItem.unit_type})` : ''}
        </Label>
        <Input
          type="number"
          min="0"
          step={selectedItem && isDiscreteUnitType(selectedItem.unit_type) ? '1' : '0.01'}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-10"
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-slate-500">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Optional details..."
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full h-11 bg-red-600 hover:bg-red-700"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Record loss
          </>
        )}
      </Button>
    </form>
  );
}
