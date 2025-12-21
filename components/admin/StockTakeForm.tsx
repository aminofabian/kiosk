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
  FileText,
} from 'lucide-react';
import type { Item } from '@/lib/db/types';
import type { AdjustmentReason } from '@/lib/constants';
import { ADJUSTMENT_REASONS } from '@/lib/constants';

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock / New Delivery',
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
    <div className="max-w-7xl mx-auto space-y-6">
      {showSuccess && (
        <Card className="border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg text-green-900 dark:text-green-100">
                  Stock take completed successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-200 mt-1">
                  {itemsWithDifference} item(s) adjusted. Redirecting...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && !showSuccess && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm font-medium text-red-900 dark:text-red-100">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Search className="h-4 w-4 text-white" />
                </div>
                Add Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Search items to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 text-base border-2 focus:border-[#259783]"
                />
              </div>

              <div className="space-y-2 max-h-[400px] md:max-h-[500px] overflow-y-auto -mx-1 px-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
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
                        className="w-full text-left p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-[#259783] hover:bg-[#259783]/5 dark:hover:bg-[#259783]/10 transition-all active:scale-[0.98] group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate text-sm text-slate-900 dark:text-white group-hover:text-[#259783] transition-colors">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                {item.current_stock.toFixed(2)} {item.unit_type}
                              </span>
                              {isLow && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  Low Stock
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="w-7 h-7 rounded-md bg-[#259783]/10 group-hover:bg-[#259783] flex items-center justify-center transition-colors shrink-0">
                            <Plus className="h-4 w-4 text-[#259783] group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {stockTakeItems.length > 0 && (
            <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Copy className="h-4 w-4 text-white" />
                  </div>
                  Quick Settings
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Apply default values to all items
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Default Reason</Label>
                  <Select
                    value={globalReason}
                    onValueChange={(v) => setGlobalReason(v as AdjustmentReason)}
                  >
                    <SelectTrigger className="h-11 border-2">
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
                  <Label className="text-sm font-semibold">Default Notes</Label>
                  <Textarea
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                    placeholder="Enter notes to apply to all items..."
                    rows={3}
                    className="text-sm border-2 resize-none"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleApplyGlobalSettings}
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Apply to All Items
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {stockTakeItems.length > 0 ? (
            <>
              <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-md">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div>Items to Count</div>
                        <div className="text-sm font-normal text-muted-foreground mt-0.5">
                          {stockTakeItems.length} item{stockTakeItems.length !== 1 ? 's' : ''} added
                        </div>
                      </div>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="text-xs font-medium">
                        {itemsWithDifference} with differences
                      </Badge>
                      {totalDifference !== 0 && (
                        <Badge
                          variant={totalDifference > 0 ? 'default' : 'destructive'}
                          className="text-xs font-bold px-3 py-1"
                        >
                          {totalDifference > 0 ? '+' : ''}
                          {totalDifference.toFixed(2)} total
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4 max-h-[500px] md:max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                      {stockTakeItems.map((item, index) => {
                        const actual = parseFloat(item.actualStock) || 0;
                        const diff = actual - item.systemStock;
                        const hasDifference = Math.abs(diff) > 0.01;
                        const isNegative = diff < 0;

                        return (
                          <Card
                            key={item.itemId}
                            className={`border-2 shadow-md transition-all hover:shadow-lg ${
                              hasDifference
                                ? isNegative
                                  ? 'border-red-300/60 bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/20 dark:to-rose-950/20'
                                  : 'border-green-300/60 bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/20 dark:to-emerald-950/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                            }`}
                          >
                            <CardContent className="p-6 space-y-5">
                              {/* Item Header */}
                              <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-slate-100 dark:border-slate-700">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-1 h-8 rounded-full ${
                                      hasDifference 
                                        ? isNegative 
                                          ? 'bg-red-500' 
                                          : 'bg-green-500'
                                        : 'bg-slate-300 dark:bg-slate-600'
                                    }`}></div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-lg text-slate-900 dark:text-white truncate">
                                        {item.itemName}
                                      </h4>
                                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        {item.unitType}
                                      </p>
                                    </div>
                                    {hasDifference && (
                                      <Badge
                                        variant={isNegative ? 'destructive' : 'default'}
                                        className="text-xs font-bold px-3 py-1 shadow-sm"
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
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(item.itemId)}
                                  className="h-10 w-10 text-slate-400 hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors rounded-lg"
                                  title="Remove item"
                                >
                                  <X className="h-5 w-5" />
                                </Button>
                              </div>

                              {/* Stock Comparison Section */}
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* System Stock - Read Only */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                      System Stock
                                    </Label>
                                    <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-bold text-2xl text-slate-900 dark:text-white">
                                          {item.systemStock.toFixed(2)}
                                        </span>
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                          {item.unitType}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* New Stock - Input */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-[#259783]"></div>
                                      New Stock *
                                    </Label>
                                    <div className="space-y-2">
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
                                        placeholder="Enter new stock count"
                                        required
                                        className="h-14 text-lg font-bold border-2 focus:border-[#259783] focus:ring-2 focus:ring-[#259783]/20"
                                      />
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleCopySystemStock(item.itemId)}
                                        className="w-full h-10 border-2 hover:bg-[#259783] hover:text-white hover:border-[#259783] transition-colors text-sm font-medium"
                                        title=""
                                      >
                                        <Copy className="h-4 w-4 mr-2" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Difference Display */}
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${hasDifference ? (isNegative ? 'bg-red-500' : 'bg-green-500') : 'bg-slate-400'}`}></div>
                                    Difference
                                  </Label>
                                  <div
                                    className={`p-4 rounded-xl border-2 font-bold transition-all ${
                                      !hasDifference
                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                                        : isNegative
                                        ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 shadow-sm'
                                        : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 shadow-sm'
                                    }`}
                                  >
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl">
                                        {diff >= 0 ? '+' : ''}
                                        {diff.toFixed(2)}
                                      </span>
                                      <span className="text-sm font-medium opacity-75">
                                        {item.unitType}
                                      </span>
                                    </div>
                                    {hasDifference && (
                                      <p className="text-xs font-normal mt-2 opacity-80">
                                        {isNegative ? 'Stock decreased' : 'Stock increased'}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Reason & Notes Section */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-2 border-slate-100 dark:border-slate-700">
                                <div className="space-y-2">
                                  <Label className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                                    <AlertTriangle className="h-3 w-3" />
                                    Reason *
                                  </Label>
                                  <Select
                                    value={item.reason}
                                    onValueChange={(value) =>
                                      handleUpdateItem(item.itemId, {
                                        reason: value as AdjustmentReason,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-12 text-base font-medium border-2 focus:ring-2 focus:ring-[#259783]/20">
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
                                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                    <FileText className="h-3 w-3" />
                                    Notes (Optional)
                                  </Label>
                                  <Input
                                    value={item.notes}
                                    onChange={(e) =>
                                      handleUpdateItem(item.itemId, {
                                        notes: e.target.value,
                                      })
                                    }
                                    placeholder="Add notes..."
                                    className="h-12 text-base border-2 focus:ring-2 focus:ring-[#259783]/20"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <Separator className="my-6" />

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      {onCancel ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onCancel}
                          disabled={isSubmitting}
                          className="flex-1 h-12 border-2 font-semibold"
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push('/admin/stock')}
                          disabled={isSubmitting}
                          className="flex-1 h-12 border-2 font-semibold"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 h-12 bg-gradient-to-r from-[#259783] to-[#3bd522] hover:from-[#259783]/90 hover:to-[#3bd522]/90 text-white font-bold shadow-lg shadow-[#259783]/30 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-2 h-5 w-5" />
                            Complete Stock Take ({stockTakeItems.length} {stockTakeItems.length === 1 ? 'item' : 'items'})
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Package className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  No items added yet
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Search and add items from the left panel to start your stock take
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
