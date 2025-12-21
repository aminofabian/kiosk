'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  X,
} from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { AdjustmentReason } from '@/lib/constants';
import { ADJUSTMENT_REASONS } from '@/lib/constants';
import { StockAdjustFormMobile } from './StockAdjustFormMobile';

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock / New Delivery',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

interface StockAdjustFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StockAdjustForm(props: StockAdjustFormProps = {}) {
  const { onSuccess, onCancel } = props;
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<AdjustmentReason>('restock');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    async function fetchItems() {
      try {
        setLoadingItems(true);
        const response = await fetch('/api/items?all=true&sellableOnly=true');
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

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.unit_type.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const calculatedNewStock = useMemo(() => {
    if (!selectedItem || !quantity) return null;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return null;
    return adjustmentType === 'increase'
      ? selectedItem.current_stock + qty
      : Math.max(0, selectedItem.current_stock - qty);
  }, [selectedItem, quantity, adjustmentType]);

  const isLowStock = selectedItem && selectedItem.current_stock < 10;
  const willGoNegative = calculatedNewStock !== null && calculatedNewStock < 0;
  const willBeLowStock = calculatedNewStock !== null && calculatedNewStock < 10 && calculatedNewStock >= 0;

  const handleQuantityQuickSet = (multiplier: number) => {
    if (!selectedItem) return;
    const newQty = selectedItem.current_stock * multiplier;
    setQuantity(newQty.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    if (adjustmentType === 'decrease' && selectedItem && qty > selectedItem.current_stock) {
      setError(`Cannot decrease by more than current stock (${selectedItem.current_stock.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: selectedItemId,
          adjustmentType,
          quantity: qty,
          reason,
          notes: notes || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push('/admin/stock');
          }
        }, 1500);
      } else {
        setError(result.message || 'Failed to adjust stock');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Stock adjustment error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedItemId('');
    setQuantity('');
    setNotes('');
    setSearchQuery('');
    setError(null);
  };

  if (loadingItems) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading items...</p>
        </div>
      </div>
    );
  }

  const sharedProps = {
    items,
    loadingItems,
    selectedItemId,
    setSelectedItemId,
    adjustmentType,
    setAdjustmentType,
    quantity,
    setQuantity,
    reason,
    setReason,
    notes,
    setNotes,
    isSubmitting,
    error,
    showSuccess,
    onReset: handleReset,
    onSubmit: async (e: React.FormEvent) => {
      await handleSubmit(e);
    },
  };

  return (
    <>
      <div className="block md:hidden">
        <StockAdjustFormMobile {...sharedProps} />
      </div>

      <div className="hidden md:block max-w-4xl space-y-6">
        {showSuccess && (
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    Stock adjusted successfully!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-200">
                    Redirecting to stock page...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Select Item
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11"
              />
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No items found</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = item.id === selectedItemId;
                  const isLow = item.current_stock < 10;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                              {item.current_stock.toFixed(2)} {item.unit_type}
                            </span>
                            {isLow && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adjustment Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItem ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Current Stock</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">
                          {selectedItem.current_stock.toFixed(2)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedItem.unit_type}
                        </span>
                      </div>
                    </div>
                    {isLowStock && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Low stock warning</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Adjustment Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('increase')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          adjustmentType === 'increase'
                            ? 'border-green-500 bg-green-50 dark:bg-green-950'
                            : 'border-border hover:border-green-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TrendingUp
                            className={`h-5 w-5 ${
                              adjustmentType === 'increase' ? 'text-green-600' : 'text-muted-foreground'
                            }`}
                          />
                          <span className="font-medium">Increase</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('decrease')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          adjustmentType === 'decrease'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950'
                            : 'border-border hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TrendingDown
                            className={`h-5 w-5 ${
                              adjustmentType === 'decrease' ? 'text-red-600' : 'text-muted-foreground'
                            }`}
                          />
                          <span className="font-medium">Decrease</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">
                      Quantity ({selectedItem.unit_type}) *
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      step="0.01"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0.00"
                      required
                      className="text-lg h-12"
                    />
                    {selectedItem && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityQuickSet(0.1)}
                        >
                          10%
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityQuickSet(0.25)}
                        >
                          25%
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setQuantity(selectedItem.current_stock.toFixed(2))}
                        >
                          Full Stock
                        </Button>
                      </div>
                    )}
                  </div>

                  {calculatedNewStock !== null && (
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">New Stock After Adjustment</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-primary">
                            {calculatedNewStock.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {selectedItem.unit_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {adjustmentType === 'increase' ? '+' : '-'}
                          {parseFloat(quantity).toFixed(2)} {selectedItem.unit_type}
                        </span>
                      </div>
                      {willGoNegative && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Stock cannot go negative</span>
                        </div>
                      )}
                      {willBeLowStock && !willGoNegative && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Stock will be low after adjustment</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason *</Label>
                    <Select
                      value={reason}
                      onValueChange={(v) => setReason(v as AdjustmentReason)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {REASON_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional details..."
                      rows={3}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || willGoNegative}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Apply Adjustment
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select an item to adjust stock</p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}

