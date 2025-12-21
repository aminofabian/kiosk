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
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { AdjustmentReason } from '@/lib/constants';
import { ADJUSTMENT_REASONS } from '@/lib/constants';

const REASON_LABELS: Record<AdjustmentReason, string> = {
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

interface StockTakeItem {
  itemId: string;
  itemName: string;
  unitType: string;
  systemStock: number;
  actualStock: string;
  difference: number;
  reason: AdjustmentReason;
  notes: string;
}

interface StockTakeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StockTakeForm(props: StockTakeFormProps = {}) {
  const { onSuccess, onCancel } = props;
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [globalReason, setGlobalReason] = useState<AdjustmentReason>('counting_error');
  const [globalNotes, setGlobalNotes] = useState('');

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
    const availableItems = items.filter(
      (item) => !stockTakeItems.some((sti) => sti.itemId === item.id)
    );
    if (!searchQuery.trim()) return availableItems;
    const query = searchQuery.toLowerCase();
    return availableItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.unit_type.toLowerCase().includes(query)
    );
  }, [items, stockTakeItems, searchQuery]);

  const handleAddItem = (item: Item) => {
    if (stockTakeItems.some((sti) => sti.itemId === item.id)) {
      setError('Item already added to stock take');
      return;
    }

    const newItem: StockTakeItem = {
      itemId: item.id,
      itemName: item.name,
      unitType: item.unit_type,
      systemStock: item.current_stock,
      actualStock: item.current_stock.toFixed(2),
      difference: 0,
      reason: globalReason,
      notes: globalNotes,
    };

    setStockTakeItems([...stockTakeItems, newItem]);
    setSearchQuery('');
    setError(null);
  };

  const handleUpdateItem = (itemId: string, updates: Partial<StockTakeItem>) => {
    setStockTakeItems(
      stockTakeItems.map((item) => {
        if (item.itemId === itemId) {
          const updated = { ...item, ...updates };
          if (updates.actualStock !== undefined) {
            const actual = parseFloat(updates.actualStock) || 0;
            updated.difference = actual - item.systemStock;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setStockTakeItems(stockTakeItems.filter((item) => item.itemId !== itemId));
  };

  const handleCopySystemStock = (itemId: string) => {
    const item = stockTakeItems.find((i) => i.itemId === itemId);
    if (item) {
      handleUpdateItem(itemId, { actualStock: item.systemStock.toFixed(2) });
    }
  };

  const handleApplyGlobalSettings = () => {
    setStockTakeItems(
      stockTakeItems.map((item) => ({
        ...item,
        reason: globalReason,
        notes: globalNotes,
      }))
    );
  };

  const totalDifference = useMemo(() => {
    return stockTakeItems.reduce((sum, item) => {
      const actual = parseFloat(item.actualStock) || 0;
      return sum + (actual - item.systemStock);
    }, 0);
  }, [stockTakeItems]);

  const itemsWithDifference = useMemo(() => {
    return stockTakeItems.filter((item) => {
      const actual = parseFloat(item.actualStock) || 0;
      return Math.abs(actual - item.systemStock) > 0.01;
    }).length;
  }, [stockTakeItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (stockTakeItems.length === 0) {
      setError('Please add at least one item to count');
      return;
    }

    const invalidItems = stockTakeItems.filter(
      (item) => !item.actualStock || isNaN(parseFloat(item.actualStock))
    );

    if (invalidItems.length > 0) {
      setError('Please enter actual stock for all items');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/stock/take', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: stockTakeItems.map((item) => ({
            itemId: item.itemId,
            actualStock: parseFloat(item.actualStock),
            reason: item.reason,
            notes: item.notes || null,
          })),
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
        }, 2000);
      } else {
        setError(result.message || 'Failed to complete stock take');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Stock take error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
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

  return (
    <div className="max-w-6xl space-y-6">
      {showSuccess && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Stock take completed successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-200">
                  {itemsWithDifference} item(s) adjusted. Redirecting...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5" />
                Add Items
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

              <div className="space-y-2 max-h-[400px] md:max-h-[500px] overflow-y-auto -mx-1 px-1">
                {filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery ? 'No items found' : 'All items added'}
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.current_stock < 10;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddItem(item)}
                        className="w-full text-left p-3 md:p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-muted/50 transition-all active:scale-[0.98] touch-target"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {item.current_stock.toFixed(2)} {item.unit_type}
                              </span>
                              {isLow && (
                                <Badge variant="destructive" className="text-xs">
                                  Low
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-primary shrink-0" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {stockTakeItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm">Default Reason</Label>
                  <Select
                    value={globalReason}
                    onValueChange={(v) => setGlobalReason(v as AdjustmentReason)}
                  >
                    <SelectTrigger className="h-10">
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
                  <Label className="text-sm">Default Notes</Label>
                  <Textarea
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                    placeholder="Apply to all items..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyGlobalSettings}
                  className="w-full text-sm"
                  size="sm"
                >
                  Apply to All Items
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {stockTakeItems.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Items to Count ({stockTakeItems.length})
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-muted-foreground">
                        {itemsWithDifference} with differences
                      </div>
                      {totalDifference !== 0 && (
                        <Badge
                          variant={totalDifference > 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {totalDifference > 0 ? '+' : ''}
                          {totalDifference.toFixed(2)} total
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3 max-h-[500px] md:max-h-[600px] overflow-y-auto">
                      {stockTakeItems.map((item, index) => {
                        const actual = parseFloat(item.actualStock) || 0;
                        const diff = actual - item.systemStock;
                        const hasDifference = Math.abs(diff) > 0.01;
                        const isNegative = diff < 0;

                        return (
                          <Card
                            key={item.itemId}
                            className={`border-2 ${
                              hasDifference
                                ? isNegative
                                  ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                                  : 'border-green-200 bg-green-50/50 dark:bg-green-950/20'
                                : 'border-border'
                            }`}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold">{item.itemName}</h4>
                                    {hasDifference && (
                                      <Badge
                                        variant={isNegative ? 'destructive' : 'default'}
                                        className="text-xs"
                                      >
                                        {isNegative ? (
                                          <TrendingDown className="h-3 w-3 mr-1" />
                                        ) : (
                                          <TrendingUp className="h-3 w-3 mr-1" />
                                        )}
                                        {diff > 0 ? '+' : ''}
                                        {diff.toFixed(2)}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {item.unitType}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.itemId)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">
                                    System Stock
                                  </Label>
                                  <div className="p-2 bg-muted rounded-md font-medium text-sm">
                                    {item.systemStock.toFixed(2)} {item.unitType}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">
                                    Actual Stock ({item.unitType}) *
                                  </Label>
                                  <div className="flex gap-1">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.actualStock}
                                      onChange={(e) =>
                                        handleUpdateItem(item.itemId, {
                                          actualStock: e.target.value,
                                        })
                                      }
                                      placeholder="0.00"
                                      required
                                      className="h-11 md:h-10 text-base md:text-sm"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleCopySystemStock(item.itemId)}
                                      className="h-11 w-11 md:h-10 md:w-10 shrink-0"
                                      title="Copy system stock"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">
                                    Difference
                                  </Label>
                                  <div
                                    className={`p-2 rounded-md font-bold text-sm ${
                                      !hasDifference
                                        ? 'bg-muted'
                                        : isNegative
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}
                                  >
                                    {diff >= 0 ? '+' : ''}
                                    {diff.toFixed(2)} {item.unitType}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                                <div className="space-y-1">
                                  <Label className="text-xs">Reason *</Label>
                                  <Select
                                    value={item.reason}
                                    onValueChange={(value) =>
                                      handleUpdateItem(item.itemId, {
                                        reason: value as AdjustmentReason,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-11 md:h-10 text-base md:text-sm">
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
                                <div className="space-y-1">
                                  <Label className="text-xs">Notes</Label>
                                  <Input
                                    value={item.notes}
                                    onChange={(e) =>
                                      handleUpdateItem(item.itemId, {
                                        notes: e.target.value,
                                      })
                                    }
                                    placeholder="Optional notes"
                                    className="h-11 md:h-10 text-base md:text-sm"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <Separator />

                    {error && (
                      <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push('/admin/stock')}
                        disabled={isSubmitting}
                        className="flex-1 h-12 md:h-10"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 h-12 md:h-10 bg-gradient-to-r from-blue-600 to-indigo-600"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete Stock Take ({stockTakeItems.length} items)
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No items added yet</p>
                <p className="text-sm text-muted-foreground">
                  Search and add items from the left panel to start stock taking
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
