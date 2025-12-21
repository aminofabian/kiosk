'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { PurchaseItem, Item } from '@/lib/db/types';
import { apiGet, apiPost } from '@/lib/utils/api-client';

interface BreakdownFormProps {
  purchaseItem: PurchaseItem & { item_name?: string; item_unit_type?: string };
  purchaseId: string;
  onBreakdownComplete?: () => void;
}

export function BreakdownForm({ purchaseItem, purchaseId, onBreakdownComplete }: BreakdownFormProps) {
  const router = useRouter();
  const [itemId, setItemId] = useState<string>(purchaseItem.item_id || '__none__');
  const [usableQuantity, setUsableQuantity] = useState<string>('');
  const [wastageQuantity, setWastageQuantity] = useState<string>('0');
  const [buyPricePerUnit, setBuyPricePerUnit] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<Item[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItems() {
      try {
        const result = await apiGet<Item[]>('/api/items?all=true');
        if (result.success) {
          setItems(result.data ?? []);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
      }
    }
    fetchItems();
  }, []);

  // Auto-calculate buy price when usable quantity changes
  useEffect(() => {
    if (usableQuantity && purchaseItem.amount) {
      const usable = parseFloat(usableQuantity);
      const amount = parseFloat(purchaseItem.amount.toString());
      if (usable > 0 && !isNaN(usable) && !isNaN(amount)) {
        const calculated = amount / usable;
        setBuyPricePerUnit(calculated.toFixed(2));
      }
    }
  }, [usableQuantity, purchaseItem.amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (itemId === '__none__' || !itemId) {
      setError('Please select an item to link this purchase to');
      return;
    }

    if (!usableQuantity || parseFloat(usableQuantity) <= 0) {
      setError('Usable quantity must be greater than 0');
      return;
    }

    if (!buyPricePerUnit || parseFloat(buyPricePerUnit) <= 0) {
      setError('Buy price per unit must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiPost(`/api/purchases/${purchaseId}/breakdown`, {
        purchaseItemId: purchaseItem.id,
        itemId: itemId === '__none__' ? null : itemId,
        usableQuantity: parseFloat(usableQuantity),
        wastageQuantity: parseFloat(wastageQuantity) || 0,
        buyPricePerUnit: parseFloat(buyPricePerUnit),
        notes: notes || null,
      });

      if (result.success) {
        if (onBreakdownComplete) {
          onBreakdownComplete();
        } else {
          router.refresh();
        }
      } else {
        setError(result.message || 'Failed to create breakdown');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Breakdown creation error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === itemId && itemId !== '__none__');
  const unitType = selectedItem?.unit_type || purchaseItem.item_unit_type || '';

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg mb-2">
              {purchaseItem.item_name_snapshot}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {purchaseItem.quantity_note} - KES {parseFloat(purchaseItem.amount.toString()).toFixed(0)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item">Link to Item *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.unit_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="usable">Usable Quantity ({unitType}) *</Label>
              <Input
                id="usable"
                type="number"
                step="0.01"
                value={usableQuantity}
                onChange={(e) => setUsableQuantity(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wastage">Wastage Quantity ({unitType})</Label>
              <Input
                id="wastage"
                type="number"
                step="0.01"
                value={wastageQuantity}
                onChange={(e) => setWastageQuantity(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Buy Price Per Unit ({unitType}) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={buyPricePerUnit}
              onChange={(e) => setBuyPricePerUnit(e.target.value)}
              placeholder="Auto-calculated"
              required
            />
            <p className="text-xs text-muted-foreground">
              Calculated from: {parseFloat(purchaseItem.amount.toString()).toFixed(0)} ÷ {usableQuantity || '?'} = {buyPricePerUnit || '?'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="touch"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Confirming...
              </>
            ) : (
              'Confirm Breakdown'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

