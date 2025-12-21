'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, Check, X, ListChecks, ShoppingCart, PenTool } from 'lucide-react';

interface PurchaseItem {
  id: string;
  itemName: string;
  quantityNote: string;
  amount: string;
  itemId: string | null;
  notes: string;
}

interface PurchaseFormProps {
  onSuccess?: (purchaseId: string) => void;
  onCancel?: () => void;
  initialData?: {
    supplierName?: string;
    purchaseDate?: string;
    totalAmount?: string;
    extraCosts?: string;
    notes?: string;
    items?: PurchaseItem[];
  };
  onDataChange?: (data: {
    supplierName: string;
    purchaseDate: string;
    totalAmount: string;
    extraCosts: string;
    notes: string;
    items: PurchaseItem[];
  }) => void;
}

export function PurchaseForm({ onSuccess, onCancel, initialData, onDataChange }: PurchaseFormProps) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState(initialData?.supplierName || '');
  const [purchaseDate, setPurchaseDate] = useState(
    initialData?.purchaseDate || new Date().toISOString().split('T')[0]
  );
  const [totalAmount, setTotalAmount] = useState(initialData?.totalAmount || '');
  const [extraCosts, setExtraCosts] = useState(initialData?.extraCosts || '0');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [items, setItems] = useState<PurchaseItem[]>(initialData?.items || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [currentItem, setCurrentItem] = useState<PurchaseItem>({
    id: '',
    itemName: '',
    quantityNote: '',
    amount: '',
    itemId: null,
    notes: '',
  });
  const isInitialMount = useRef(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!onDataChangeRef.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      if (onDataChangeRef.current) {
        onDataChangeRef.current({
          supplierName,
          purchaseDate,
          totalAmount,
          extraCosts,
          notes,
          items,
        });
      }
    }, 300);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierName, purchaseDate, totalAmount, extraCosts, notes, items]);


  const handleAddItemClick = () => {
    setShowAddItemForm(true);
    setCurrentItem({
      id: '',
      itemName: '',
      quantityNote: '',
      amount: '',
      itemId: null,
      notes: '',
    });
  };

  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        supplierName,
        purchaseDate,
        totalAmount,
        extraCosts,
        notes,
        items,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierName, purchaseDate, totalAmount, extraCosts, notes, items]);

  const handleSaveItem = () => {
    if (!currentItem.itemName || !currentItem.amount) {
      setError('Item name and amount are required');
      return;
    }

    const newItems = [
      ...items,
      {
        ...currentItem,
        id: Date.now().toString(),
      },
    ];
    setItems(newItems);

    setCurrentItem({
      id: '',
      itemName: '',
      quantityNote: '',
      amount: '',
      itemId: null,
      notes: '',
    });
    setShowAddItemForm(false);
    setError(null);
  };

  const handleCancelAddItem = () => {
    setShowAddItemForm(false);
    setCurrentItem({
      id: '',
      itemName: '',
      quantityNote: '',
      amount: '',
      itemId: null,
      notes: '',
    });
    setError(null);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const calculateTotal = () => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );
    const extra = parseFloat(extraCosts) || 0;
    return itemsTotal + extra;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!purchaseDate) {
      setError('Purchase date is required');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    if (items.some((item) => !item.itemName || !item.amount)) {
      setError('Please fill in all item details');
      return;
    }

    const calculatedTotal = calculateTotal();
    if (totalAmount && Math.abs(parseFloat(totalAmount) - calculatedTotal) > 0.01) {
      setError(
        `Total amount mismatch. Calculated: ${calculatedTotal.toFixed(2)}, Entered: ${totalAmount}`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const purchaseDateTimestamp = Math.floor(
        new Date(purchaseDate).getTime() / 1000
      );
      const finalTotal = totalAmount ? parseFloat(totalAmount) : calculatedTotal;

      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplierName: supplierName || null,
          purchaseDate: purchaseDateTimestamp,
          totalAmount: finalTotal,
          extraCosts: parseFloat(extraCosts) || 0,
          notes: notes || null,
          items: items.map((item) => ({
            itemName: item.itemName,
            quantityNote: item.quantityNote,
            amount: parseFloat(item.amount),
            itemId: item.itemId || null,
            notes: item.notes || null,
          })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (onSuccess) {
          onSuccess(result.data.purchaseId);
        } else {
          router.push(`/admin/purchases/${result.data.purchaseId}/breakdown`);
        }
      } else {
        setError(result.message || 'Failed to create purchase');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Purchase creation error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Purchase Details - Compact Header */}
      <div className="space-y-2 bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-amber-200 dark:border-amber-900/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="supplier" className="text-xs font-medium text-amber-900 dark:text-amber-200">Store/Supplier</Label>
            <Input
              id="supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Where are you shopping?"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date" className="text-xs font-medium text-amber-900 dark:text-amber-200">Date *</Label>
            <Input
              id="date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="extra" className="text-xs font-medium text-amber-900 dark:text-amber-200">Extra Costs</Label>
            <Input
              id="extra"
              type="number"
              step="0.01"
              value={extraCosts}
              onChange={(e) => setExtraCosts(e.target.value)}
              placeholder="0.00"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-medium text-amber-900 dark:text-amber-200">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick notes"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Purchase List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">Items</h3>
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs">
              {items.length}
            </Badge>
          </div>
          {!showAddItemForm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItemClick}
              className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20 h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </div>

        {/* Add Item Form - Compact Style */}
        {showAddItemForm && (
          <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <CardContent className="p-3 space-y-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Add Item</h4>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelAddItem}
                  className="h-7 w-7 hover:bg-amber-200 dark:hover:bg-amber-900/40"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200">Item Name *</Label>
                  <Input
                    value={currentItem.itemName}
                    onChange={(e) => {
                      setCurrentItem({ ...currentItem, itemName: e.target.value });
                    }}
                    placeholder="Type item name..."
                    required
                    className="h-8 text-sm border-amber-300 focus:border-amber-500 dark:border-amber-700 dark:focus:border-amber-500"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200">Quantity *</Label>
                    <Input
                      value={currentItem.quantityNote}
                      onChange={(e) =>
                        setCurrentItem({
                          ...currentItem,
                          quantityNote: e.target.value,
                        })
                      }
                      placeholder="e.g., 2 crates"
                      className="h-8 text-sm border-amber-300 focus:border-amber-500 dark:border-amber-700 dark:focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200">Price (KES) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={currentItem.amount}
                      onChange={(e) =>
                        setCurrentItem({ ...currentItem, amount: e.target.value })
                      }
                      placeholder="0.00"
                      className="h-8 text-sm border-amber-300 focus:border-amber-500 dark:border-amber-700 dark:focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200">Notes</Label>
                  <Input
                    value={currentItem.notes}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, notes: e.target.value })
                    }
                    placeholder="Optional notes..."
                    className="h-8 text-sm border-amber-300 focus:border-amber-500 dark:border-amber-700 dark:focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1.5">
                <Button
                  type="button"
                  onClick={handleSaveItem}
                  className="gap-1.5 flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-8 text-xs"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase List Items */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <Card key={item.id} className="hover:shadow-md transition-all border-l-2 border-l-amber-400 bg-white dark:bg-slate-800/50">
                <CardContent className="p-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white leading-tight">
                            {item.itemName}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700 px-1.5 py-0">
                              {item.quantityNote}
                            </Badge>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              KES {parseFloat(item.amount || '0').toFixed(2)}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 h-7 w-7 flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {items.length === 0 && !showAddItemForm && (
          <div className="text-center py-8 bg-white dark:bg-slate-800/30 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700">
            <ListChecks className="w-8 h-8 text-amber-400 dark:text-amber-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">List is empty</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Click "Add" to start</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Purchase Summary - Compact */}
      <Card className="bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/30 border border-amber-300 dark:border-amber-700">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <ShoppingCart className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Summary</h3>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-amber-800 dark:text-amber-200">Subtotal:</span>
              <span className="font-semibold text-amber-900 dark:text-amber-100">
                KES{' '}
                {items
                  .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-amber-800 dark:text-amber-200">Extra:</span>
              <span className="font-semibold text-amber-900 dark:text-amber-100">
                KES {(parseFloat(extraCosts) || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-amber-300 dark:border-amber-700">
              <Label htmlFor="total-summary" className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                Total (KES)
              </Label>
              <Input
                id="total-summary"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-28 h-7 text-xs text-right font-bold border-amber-400 focus:border-amber-600 dark:border-amber-600 dark:focus:border-amber-500 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="flex justify-between items-center pt-1 border-t-2 border-amber-300 dark:border-amber-700">
              <span className="font-bold text-sm text-amber-900 dark:text-amber-100">Grand Total:</span>
              <span className="font-bold text-lg text-amber-700 dark:text-amber-300">
                KES {calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-2.5 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-xs">
          {error}
        </div>
      )}

      {/* Fixed Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:right-auto sm:w-[600px] md:w-[700px] bg-white dark:bg-[#0f1a0d] border-t border-amber-200 dark:border-amber-800 p-3 shadow-lg z-50">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                router.push('/admin/purchases');
              }
            }}
            className="flex-1 h-9 text-sm"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="flex-1 h-9 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save List'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

