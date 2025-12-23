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

      <div className="hidden md:block space-y-6">
        {showSuccess && (
          <Card className="border-green-500/50 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
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
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Package className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              Select Item
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 border-slate-200 dark:border-slate-700 focus:border-[#259783] focus:ring-[#259783]/20"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto -mx-1 px-1">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No items found</p>
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
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-[#259783] bg-[#259783]/5 shadow-sm ring-2 ring-[#259783]/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-[#259783]/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {item.current_stock.toFixed(2)} {item.unit_type}
                            </span>
                            {isLow && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-[#259783] shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-lg">Adjustment Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {selectedItem ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-5">
                  <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Current Stock</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          {selectedItem.current_stock.toFixed(2)}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {selectedItem.unit_type}
                        </span>
                      </div>
                    </div>
                    {isLowStock && (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm pt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Low stock warning</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Adjustment Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('increase')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          adjustmentType === 'increase'
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/50 shadow-sm ring-2 ring-green-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <TrendingUp
                            className={`h-6 w-6 ${
                              adjustmentType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                            }`}
                          />
                          <span className={`font-semibold ${
                            adjustmentType === 'increase' ? 'text-green-700 dark:text-green-300' : 'text-slate-600 dark:text-slate-400'
                          }`}>Increase</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('decrease')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          adjustmentType === 'decrease'
                            ? 'border-red-500 bg-red-50 dark:bg-red-950/50 shadow-sm ring-2 ring-red-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <TrendingDown
                            className={`h-6 w-6 ${
                              adjustmentType === 'decrease' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                            }`}
                          />
                          <span className={`font-semibold ${
                            adjustmentType === 'decrease' ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'
                          }`}>Decrease</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="quantity" className="text-base font-semibold">
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
                      className="text-lg h-12 border-slate-200 dark:border-slate-700 focus:border-[#259783] focus:ring-[#259783]/20"
                    />
                  </div>

                  {calculatedNewStock !== null && (
                    <div className="p-5 rounded-xl bg-gradient-to-br from-[#259783]/5 to-emerald-50/50 dark:from-[#259783]/10 dark:to-emerald-950/20 border-2 border-[#259783]/20 dark:border-[#259783]/30 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#259783]/20">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">New Stock After Adjustment</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-[#259783] dark:text-[#45d827]">
                            {calculatedNewStock.toFixed(2)}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {selectedItem.unit_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <ArrowRight className="h-4 w-4" />
                        <span>
                          {adjustmentType === 'increase' ? '+' : '-'}
                          {parseFloat(quantity).toFixed(2)} {selectedItem.unit_type}
                        </span>
                      </div>
                      {willGoNegative && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm pt-2 border-t border-red-200 dark:border-red-900">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Stock cannot go negative</span>
                        </div>
                      )}
                      {willBeLowStock && !willGoNegative && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm pt-2 border-t border-amber-200 dark:border-amber-900">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Stock will be low after adjustment</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator className="my-2" />

                  <div className="space-y-3">
                    <Label htmlFor="reason" className="text-base font-semibold">Reason *</Label>
                    <Select
                      value={reason}
                      onValueChange={(v) => setReason(v as AdjustmentReason)}
                    >
                      <SelectTrigger className="h-12 border-slate-200 dark:border-slate-700 focus:border-[#259783] focus:ring-[#259783]/20">
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

                  <div className="space-y-3">
                    <Label htmlFor="notes" className="text-base font-semibold">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional details..."
                      rows={3}
                      className="border-slate-200 dark:border-slate-700 focus:border-[#259783] focus:ring-[#259783]/20 resize-none"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-center gap-2.5">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isSubmitting}
                    className="flex-1 h-11 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || willGoNegative}
                    className="flex-1 h-11 bg-gradient-to-r from-[#259783] to-[#45d827] hover:from-[#45d827] hover:to-[#259783] text-white shadow-md shadow-[#259783]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Package className="h-8 w-8 opacity-50" />
                </div>
                <p className="text-sm font-medium">Select an item to adjust stock</p>
                <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">Choose an item from the left panel</p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}

