'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, X, Loader2, Check, AlertCircle } from 'lucide-react';
import type { Purchase, PurchaseItem, Item } from '@/lib/db/types';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { parseQuantityFromNote } from '@/lib/purchase/breakdown-defaults';

interface BreakdownViewProps {
  purchase: Purchase;
  items: (PurchaseItem & { item_name?: string; item_unit_type?: string })[];
  purchaseId: string;
  onItemAdded?: () => void;
}

interface BreakdownPreview {
  purchaseItemId: string;
  itemNameSnapshot: string;
  quantityNote: string;
  amount: number;
  linkedItemName: string | null;
  linkedItemId: string | null;
  unitType: string;
  usableQuantity: number;
  buyPricePerUnit: number | null;
  canAutoConfirm: boolean;
  reason: string | null;
}

interface LineOverride {
  itemId: string | null;
  usableQuantity: string;
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
  const [previews, setPreviews] = useState<BreakdownPreview[]>([]);
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [overrides, setOverrides] = useState<Record<string, LineOverride>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const pendingItems = items.filter((item) => item.status === 'pending');
  const brokenDownItems = items.filter((item) => item.status === 'broken_down');

  const loadPreview = useCallback(async () => {
    if (pendingItems.length === 0) {
      setPreviews([]);
      return;
    }

    setLoadingPreview(true);
    try {
      const [previewResult, itemsResult] = await Promise.all([
        apiGet<{ previews: BreakdownPreview[]; readyCount: number; totalCount: number }>(
          `/api/purchases/${purchaseId}/breakdown/bulk`,
        ),
        apiGet<Item[]>('/api/items?all=true'),
      ]);

      if (itemsResult.success && itemsResult.data) {
        setCatalogItems(itemsResult.data);
      }

      if (previewResult.success && previewResult.data) {
        setPreviews(previewResult.data.previews);
        const nextOverrides: Record<string, LineOverride> = {};
        for (const preview of previewResult.data.previews) {
          nextOverrides[preview.purchaseItemId] = {
            itemId: preview.linkedItemId,
            usableQuantity: String(preview.usableQuantity),
          };
        }
        setOverrides(nextOverrides);
      }
    } catch (err) {
      console.error('Error loading breakdown preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [pendingItems.length, purchaseId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

  const getLineValues = (preview: BreakdownPreview) => {
    const override = overrides[preview.purchaseItemId];
    const itemId = override?.itemId ?? preview.linkedItemId;
    const usableQuantity = parseFloat(override?.usableQuantity || '0');
    const amount = parseFloat(preview.amount.toString());
    const buyPricePerUnit =
      itemId && usableQuantity > 0
        ? Number((amount / usableQuantity).toFixed(2))
        : preview.buyPricePerUnit;

    const linkedItem = catalogItems.find((item) => item.id === itemId);
    const canConfirm = Boolean(itemId && usableQuantity > 0 && buyPricePerUnit && buyPricePerUnit > 0);

    return {
      itemId,
      usableQuantity,
      buyPricePerUnit,
      linkedItem,
      canConfirm,
    };
  };

  const readyCount = previews.filter((preview) => getLineValues(preview).canConfirm).length;

  const handleConfirmAll = async () => {
    setConfirmError(null);

    const lines = previews
      .map((preview) => {
        const { itemId, usableQuantity, buyPricePerUnit, canConfirm } = getLineValues(preview);
        if (!canConfirm || !itemId || !buyPricePerUnit) return null;
        return {
          purchaseItemId: preview.purchaseItemId,
          itemId,
          usableQuantity,
          wastageQuantity: 0,
          buyPricePerUnit,
        };
      })
      .filter(Boolean);

    if (lines.length === 0) {
      setConfirmError('No items are ready to confirm. Link each item to inventory first.');
      return;
    }

    setIsConfirmingAll(true);
    try {
      const result = await apiPost(`/api/purchases/${purchaseId}/breakdown/bulk`, { lines });

      if (result.success) {
        if (onItemAdded) {
          onItemAdded();
        } else {
          router.refresh();
        }
      } else {
        setConfirmError(result.message || 'Failed to confirm breakdowns');
      }
    } catch (err) {
      console.error('Bulk breakdown error:', err);
      setConfirmError('An error occurred. Please try again.');
    } finally {
      setIsConfirmingAll(false);
    }
  };

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              itemName: newItem.itemName,
              quantityNote: newItem.quantityNote,
              amount: parseFloat(newItem.amount),
              notes: newItem.notes || null,
            },
          ],
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

  const updateOverride = (purchaseItemId: string, updates: Partial<LineOverride>) => {
    setOverrides((current) => ({
      ...current,
      [purchaseItemId]: {
        itemId: current[purchaseItemId]?.itemId ?? null,
        usableQuantity:
          current[purchaseItemId]?.usableQuantity ??
          String(parseQuantityFromNote('')),
        ...updates,
      },
    }));
  };

  return (
    <div className="space-y-4 py-2">
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
              <p className="font-bold text-base text-blue-600 dark:text-blue-400">
                {formatPrice(purchase.total_amount)}
              </p>
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

      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">
                Ready to confirm ({readyCount}/{previews.length || pendingItems.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quantities and prices are filled in automatically. Confirm everything in one step.
              </p>
            </div>
          </div>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {previews.map((preview) => {
                const { itemId, usableQuantity, buyPricePerUnit, linkedItem, canConfirm } =
                  getLineValues(preview);

                return (
                  <Card
                    key={preview.purchaseItemId}
                    className={
                      canConfirm
                        ? 'border-emerald-200 dark:border-emerald-900/50'
                        : 'border-amber-200 dark:border-amber-900/50'
                    }
                  >
                    <CardContent className="p-3 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">
                            {preview.itemNameSnapshot}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {preview.quantityNote || 'No quantity note'} •{' '}
                            {formatPrice(parseFloat(preview.amount.toString()))}
                          </p>
                        </div>
                        <Badge variant={canConfirm ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {canConfirm ? 'Ready' : 'Needs link'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Inventory item</Label>
                          <Select
                            value={itemId || '__none__'}
                            onValueChange={(value) =>
                              updateOverride(preview.purchaseItemId, {
                                itemId: value === '__none__' ? null : value,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select item...</SelectItem>
                              {catalogItems.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.unit_type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Qty ({linkedItem?.unit_type || preview.unitType || 'units'})
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={overrides[preview.purchaseItemId]?.usableQuantity ?? ''}
                            onChange={(e) =>
                              updateOverride(preview.purchaseItemId, {
                                usableQuantity: e.target.value,
                              })
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Buy price:{' '}
                          {buyPricePerUnit ? `KES ${buyPricePerUnit.toFixed(2)}` : '—'}
                        </span>
                        {!canConfirm && preview.reason && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {preview.reason}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {confirmError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {confirmError}
            </div>
          )}

          <Button
            onClick={handleConfirmAll}
            disabled={isConfirmingAll || loadingPreview || readyCount === 0}
            size="touch"
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
          >
            {isConfirmingAll ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Confirming {readyCount} item{readyCount === 1 ? '' : 's'}...
              </>
            ) : (
              <>
                <Check className="mr-2 h-5 w-5" />
                Confirm All ({readyCount} item{readyCount === 1 ? '' : 's'})
              </>
            )}
          </Button>
        </div>
      )}

      {brokenDownItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">
            Completed Breakdowns ({brokenDownItems.length})
          </h3>
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
                  <Badge variant="default" className="text-xs">
                    Done
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingItems.length === 0 && brokenDownItems.length === 0 && !showAddItemForm && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No items in this purchase. Click &quot;Add Item&quot; to get started.
        </div>
      )}
    </div>
  );
}
