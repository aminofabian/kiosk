'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { Item } from '@/lib/db/types';

interface PurchaseItem {
  id: string;
  itemName: string;
  quantityNote: string;
  amount: string;
  itemId: string | null;
  notes: string;
}

interface PurchaseItemRowProps {
  item: PurchaseItem;
  index: number;
  onUpdate: (updates: Partial<PurchaseItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function PurchaseItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: PurchaseItemRowProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    async function fetchItems() {
      try {
        setLoadingItems(true);
        const response = await fetch('/api/items?all=true');
        const result = await response.json();
        if (result.success) {
          setItems(result.data);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
      } finally {
        setLoadingItems(false);
      }
    }
    fetchItems();
  }, []);

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Item {index + 1}</h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Item Name *</Label>
          <Input
            value={item.itemName}
            onChange={(e) => onUpdate({ itemName: e.target.value })}
            placeholder="e.g., Tomatoes"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Link to Item (Optional)</Label>
          <Select
            value={item.itemId || '__none__'}
            onValueChange={(value) => onUpdate({ itemId: value === '__none__' ? null : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {items.map((dbItem) => (
                <SelectItem key={dbItem.id} value={dbItem.id}>
                  {dbItem.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Quantity Note *</Label>
          <Input
            value={item.quantityNote}
            onChange={(e) => onUpdate({ quantityNote: e.target.value })}
            placeholder="e.g., 2 crates, 1 bag, 50 kg"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Amount (KES) *</Label>
          <Input
            type="number"
            step="0.01"
            value={item.amount}
            onChange={(e) => onUpdate({ amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes (Optional)</Label>
        <Input
          value={item.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Additional notes about this item"
        />
      </div>
    </div>
  );
}

