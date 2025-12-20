'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Trash2, Check, X } from 'lucide-react';
import type { Item } from '@/lib/db/types';

const COMMON_ITEM_NAMES = [
  'Tomatoes', 'Onions', 'Potatoes', 'Carrots', 'Cabbage', 'Bell Peppers', 'Eggplant', 'Okra',
  'Green Beans', 'Cauliflower', 'Broccoli', 'Spinach', 'Lettuce', 'Cucumber', 'Zucchini',
  'Bananas', 'Apples', 'Oranges', 'Mangoes', 'Grapes', 'Strawberries', 'Watermelon', 'Pineapple',
  'Papaya', 'Avocado', 'Pears', 'Cherries', 'Peaches', 'Plums', 'Berries',
  'Rice', 'Wheat', 'Maize', 'Oats', 'Barley', 'Quinoa', 'Millet', 'Sorghum', 'Flour', 'Pasta', 'Noodles',
  'Salt', 'Black Pepper', 'Turmeric', 'Cumin', 'Coriander', 'Garlic', 'Ginger', 'Chili Powder', 'Paprika',
  'Cinnamon', 'Cardamom', 'Cloves',
  'Water', 'Juice', 'Soda', 'Tea', 'Coffee', 'Milk', 'Yogurt Drink', 'Energy Drink', 'Soft Drink',
  'Chips', 'Biscuits', 'Cookies', 'Crackers', 'Nuts', 'Popcorn', 'Chocolate', 'Candy', 'Cakes', 'Pastries',
  'Kale', 'Coriander', 'Parsley', 'Mint', 'Basil', 'Arugula', 'Spring Onions', 'Dill', 'Chives',
  'Cheese', 'Yogurt', 'Butter', 'Eggs', 'Cream', 'Sour Cream', 'Cottage Cheese', 'Mozzarella',
  'Beef', 'Chicken', 'Pork', 'Lamb', 'Fish', 'Turkey', 'Bacon', 'Sausages', 'Ham', 'Mince',
  'Bread', 'White Bread', 'Brown Bread', 'Baguette', 'Croissant', 'Donuts', 'Muffins',
  'Ice Cream', 'Frozen Vegetables', 'Frozen Fruits', 'Frozen Meat', 'Frozen Fish', 'Frozen Pizza',
  'Canned Tomatoes', 'Canned Beans', 'Canned Corn', 'Canned Peas', 'Canned Fish', 'Canned Fruits',
].sort();

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
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isCustomItemName, setIsCustomItemName] = useState(false);
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

  useEffect(() => {
    async function fetchItems() {
      try {
        setLoadingItems(true);
        const response = await fetch('/api/items?all=true');
        const result = await response.json();
        if (result.success) {
          setAvailableItems(result.data);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
      } finally {
        setLoadingItems(false);
      }
    }
    fetchItems();
  }, []);

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
    setIsCustomItemName(false);
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
    setIsCustomItemName(false);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Purchase Details */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-4">Purchase Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier Name</Label>
              <Input
                id="supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g., Market Vendor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Purchase Date *</Label>
              <Input
                id="date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="extra">Extra Costs (KES)</Label>
          <Input
            id="extra"
            type="number"
            step="0.01"
            value={extraCosts}
            onChange={(e) => setExtraCosts(e.target.value)}
            placeholder="Transport, tips, etc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this purchase"
          />
        </div>
      </div>

      <Separator />

      {/* Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Items ({items.length})</h3>
          {!showAddItemForm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItemClick}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>

        {/* Add Item Form */}
        {showAddItemForm && (
          <Card className="border-2 border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-emerald-700">Add New Item</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCancelAddItem}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item Name *</Label>
                  {!isCustomItemName ? (
                    <Select
                      value={currentItem.itemName || ''}
                      onValueChange={(value) => {
                        if (value === '__custom__') {
                          setIsCustomItemName(true);
                          setCurrentItem({ ...currentItem, itemName: '', itemId: null });
                        } else {
                          // Try to find matching item from DB to auto-link
                          const selectedItem = availableItems.find(item => item.name === value);
                          setCurrentItem({ 
                            ...currentItem, 
                            itemName: value,
                            itemId: selectedItem?.id || null,
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item or enter custom" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_ITEM_NAMES.map((itemName) => (
                          <SelectItem key={itemName} value={itemName}>
                            {itemName}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">+ Custom Name</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={currentItem.itemName}
                        onChange={(e) => {
                          setCurrentItem({ ...currentItem, itemName: e.target.value });
                        }}
                        placeholder="e.g., Tomatoes"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomItemName(false);
                          setCurrentItem({ ...currentItem, itemName: '' });
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        ← Select from suggestions
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Link to Item</Label>
                  <Select
                    value={currentItem.itemId || '__none__'}
                    onValueChange={(value) =>
                      setCurrentItem({
                        ...currentItem,
                        itemId: value === '__none__' ? null : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {availableItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity Note *</Label>
                  <Input
                    value={currentItem.quantityNote}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        quantityNote: e.target.value,
                      })
                    }
                    placeholder="e.g., 2 crates, 1 bag, 50 kg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount (KES) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentItem.amount}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={currentItem.notes}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, notes: e.target.value })
                  }
                  placeholder="Additional notes about this item"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleSaveItem}
                  className="gap-2 flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Item
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, index) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="font-semibold">{item.itemName}</span>
                        {item.itemId && (
                          <Badge variant="outline" className="text-xs">
                            Linked
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Quantity:</span>{' '}
                          {item.quantityNote}
                        </div>
                        <div>
                          <span className="font-medium">Amount:</span>{' '}
                          <span className="text-emerald-600 font-semibold">
                            KES {parseFloat(item.amount || '0').toFixed(2)}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="text-gray-500 italic">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {items.length === 0 && !showAddItemForm && (
          <div className="text-center py-8 text-gray-500">
            <p>No items added yet. Click "Add Item" to get started.</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Summary */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Items Total:</span>
            <span className="font-semibold">
              KES{' '}
              {items
                .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
                .toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Extra Costs:</span>
            <span className="font-semibold">
              KES {(parseFloat(extraCosts) || 0).toFixed(2)}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="total-summary" className="text-sm font-medium text-gray-700">
                Total Amount (KES)
              </Label>
              <Input
                id="total-summary"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="Enter total amount"
                className="w-40 text-right font-semibold"
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-lg">Grand Total:</span>
              <span className="font-bold text-xl text-emerald-600">
                KES {calculateTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          size="touch"
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else {
              router.push('/admin/purchases');
            }
          }}
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="touch"
          disabled={isSubmitting || items.length === 0}
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Purchase'
          )}
        </Button>
      </div>
    </form>
  );
}

