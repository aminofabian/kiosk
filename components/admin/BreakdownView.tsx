'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BreakdownForm } from './BreakdownForm';
import { Plus, X, Loader2, Check } from 'lucide-react';
import type { Purchase, PurchaseItem } from '@/lib/db/types';
import type { PurchaseItemStatus } from '@/lib/constants';

interface BreakdownViewProps {
  purchase: Purchase;
  items: (PurchaseItem & { item_name?: string; item_unit_type?: string })[];
  purchaseId: string;
  onItemAdded?: () => void;
}

export function BreakdownView({ purchase, items, purchaseId, onItemAdded }: BreakdownViewProps) {
  const router = useRouter();
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    itemName: '',
    quantityNote: '',
    amount: '',
    notes: '',
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const pendingItems = items.filter((item) => item.status === 'pending');
  const brokenDownItems = items.filter((item) => item.status === 'broken_down');

  const handleAddItem = async () => {
    if (!newItem.itemName || !newItem.amount) {
      setAddItemError('Item name and amount are required');
      return;
    }

    setIsAddingItems(true);
    setAddItemError(null);

    try {
      const response = await fetch(`/api/purchases/${purchaseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            itemName: newItem.itemName,
            quantityNote: newItem.quantityNote,
            amount: parseFloat(newItem.amount),
            notes: newItem.notes || null,
          }],
        }),
      });

      const result = await response.json();

      if (result.success) {
        setNewItem({ itemName: '', quantityNote: '', amount: '', notes: '' });
        setShowAddItemForm(false);
        if (onItemAdded) {
          onItemAdded();
        } else {
          router.refresh();
        }
      } else {
        setAddItemError(result.message || 'Failed to add item');
      }
    } catch (err) {
      setAddItemError('An error occurred. Please try again.');
      console.error('Error adding item:', err);
    } finally {
      setIsAddingItems(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Purchase Summary - Compact */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Supplier:</span>
              <p className="font-medium text-sm">{purchase.supplier_name || 'No supplier'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Date:</span>
              <p className="font-medium text-sm">{formatDate(purchase.purchase_date)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Total:</span>
              <p className="font-bold text-base text-blue-600 dark:text-blue-400">{formatPrice(purchase.total_amount)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Status:</span>
              <Badge
                variant={
                  purchase.status === 'complete'
                    ? 'default'
                    : purchase.status === 'partial'
                    ? 'secondary'
                    : 'destructive'
                }
                className="text-xs"
              >
                {purchase.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Items</h2>
        {!showAddItemForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddItemForm(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        )}
      </div>

      {showAddItemForm && (
        <Card className="border-2 border-blue-300 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="p-3 space-y-2.5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Add New Item</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowAddItemForm(false);
                  setNewItem({ itemName: '', quantityNote: '', amount: '', notes: '' });
                  setAddItemError(null);
                }}
                className="h-7 w-7"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Item Name *</Label>
                <Input
                  value={newItem.itemName}
                  onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                  placeholder="Type item name..."
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    value={newItem.quantityNote}
                    onChange={(e) => setNewItem({ ...newItem, quantityNote: e.target.value })}
                    placeholder="e.g., 2 crates"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount (KES) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.amount}
                    onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                    placeholder="0.00"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="h-8 text-sm"
                />
              </div>
              {addItemError && (
                <div className="p-2 bg-destructive/10 text-destructive rounded text-xs">
                  {addItemError}
                </div>
              )}
              <Button
                onClick={handleAddItem}
                disabled={isAddingItems}
                className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700"
              >
                {isAddingItems ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Add Item
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Items to Break Down ({pendingItems.length})</h3>
          {pendingItems.map((item) => (
            <BreakdownForm
              key={item.id}
              purchaseItem={item}
              purchaseId={purchase.id}
              onBreakdownComplete={onItemAdded}
            />
          ))}
        </div>
      )}

      {/* Broken Down Items */}
      {brokenDownItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Completed Breakdowns ({brokenDownItems.length})</h3>
          {brokenDownItems.map((item) => (
            <Card key={item.id} className="border-green-200 dark:border-green-800">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{item.item_name_snapshot}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.quantity_note} - {formatPrice(item.amount)}
                    </p>
                    {item.item_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Linked to: {item.item_name}
                      </p>
                    )}
                  </div>
                  <Badge variant="default" className="text-xs">Done</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingItems.length === 0 && brokenDownItems.length === 0 && !showAddItemForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No items in this purchase. Click "Add Item" to get started.
        </div>
      )}
    </div>
  );
}

