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
  ChevronRight,
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

type Step = 'select' | 'adjust';

interface StockAdjustFormMobileProps {
  items: Item[];
  loadingItems: boolean;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  adjustmentType: 'increase' | 'decrease';
  setAdjustmentType: (type: 'increase' | 'decrease') => void;
  quantity: string;
  setQuantity: (qty: string) => void;
  reason: AdjustmentReason;
  setReason: (reason: AdjustmentReason) => void;
  notes: string;
  setNotes: (notes: string) => void;
  isSubmitting: boolean;
  error: string | null;
  showSuccess: boolean;
  onReset: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

function SelectItemStep({
  items,
  searchQuery,
  setSearchQuery,
  selectedItemId,
  setSelectedItemId,
  onNext,
}: {
  items: Item[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  onNext: () => void;
}) {
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

  return (
    <div className="space-y-4 pb-24">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-14 text-base"
        />
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto -mx-1 px-1">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-base">No items found</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.id === selectedItemId;
            const isLow = item.current_stock < 10;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base mb-1">{item.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedItem && (
        <Button
          type="button"
          onClick={onNext}
          className="fixed bottom-16 left-0 right-0 mx-4 h-14 text-base bg-gradient-to-r from-emerald-600 to-teal-600 z-[60] shadow-lg"
          size="lg"
        >
          Continue with {selectedItem.name}
          <ChevronRight className="ml-2 h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

function AdjustDetailsStep({
  selectedItem,
  adjustmentType,
  setAdjustmentType,
  quantity,
  setQuantity,
  reason,
  setReason,
  notes,
  setNotes,
  calculatedNewStock,
  willGoNegative,
  willBeLowStock,
  isLowStock,
  isSubmitting,
  error,
  onBack,
  onReset,
  onSubmit,
}: {
  selectedItem: Item;
  adjustmentType: 'increase' | 'decrease';
  setAdjustmentType: (type: 'increase' | 'decrease') => void;
  quantity: string;
  setQuantity: (qty: string) => void;
  reason: AdjustmentReason;
  setReason: (reason: AdjustmentReason) => void;
  notes: string;
  setNotes: (notes: string) => void;
  calculatedNewStock: number | null;
  willGoNegative: boolean;
  willBeLowStock: boolean;
  isLowStock: boolean;
  isSubmitting: boolean;
  error: string | null;
  onBack: () => void;
  onReset: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}) {
  const handleQuantityQuickSet = (multiplier: number) => {
    const newQty = selectedItem.current_stock * multiplier;
    setQuantity(newQty.toFixed(2));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="p-5 rounded-xl bg-muted space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-muted-foreground">Item</span>
          <span className="font-semibold text-lg">{selectedItem.name}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-base font-medium text-muted-foreground">Current Stock</span>
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
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm pt-2 border-t border-border">
            <AlertTriangle className="h-4 w-4" />
            <span>Low stock warning</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-base">Adjustment Type</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAdjustmentType('increase')}
            className={`p-5 rounded-xl border-2 transition-all active:scale-[0.98] ${
              adjustmentType === 'increase'
                ? 'border-green-500 bg-green-50 dark:bg-green-950 shadow-md'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <TrendingUp
                className={`h-6 w-6 ${
                  adjustmentType === 'increase' ? 'text-green-600' : 'text-muted-foreground'
                }`}
              />
              <span className="font-semibold text-base">Increase</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setAdjustmentType('decrease')}
            className={`p-5 rounded-xl border-2 transition-all active:scale-[0.98] ${
              adjustmentType === 'decrease'
                ? 'border-red-500 bg-red-50 dark:bg-red-950 shadow-md'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <TrendingDown
                className={`h-6 w-6 ${
                  adjustmentType === 'decrease' ? 'text-red-600' : 'text-muted-foreground'
                }`}
              />
              <span className="font-semibold text-base">Decrease</span>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="quantity-mobile" className="text-base">
          Quantity ({selectedItem.unit_type}) *
        </Label>
        <Input
          id="quantity-mobile"
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0.00"
          required
          className="text-xl h-14"
        />
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleQuantityQuickSet(0.1)}
            className="h-12 text-sm"
          >
            10%
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleQuantityQuickSet(0.25)}
            className="h-12 text-sm"
          >
            25%
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuantity(selectedItem.current_stock.toFixed(2))}
            className="h-12 text-sm"
          >
            Full
          </Button>
        </div>
      </div>

      {calculatedNewStock !== null && (
        <div className="p-5 rounded-xl bg-primary/5 border-2 border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-medium">New Stock</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-primary">
                {calculatedNewStock.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">
                {selectedItem.unit_type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-primary/20">
            <ArrowRight className="h-4 w-4" />
            <span className="text-muted-foreground">
              {adjustmentType === 'increase' ? '+' : '-'}
              {parseFloat(quantity).toFixed(2)} {selectedItem.unit_type}
            </span>
          </div>
          {willGoNegative && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm pt-2 border-t border-primary/20">
              <AlertTriangle className="h-4 w-4" />
              <span>Stock cannot go negative</span>
            </div>
          )}
          {willBeLowStock && !willGoNegative && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm pt-2 border-t border-primary/20">
              <AlertTriangle className="h-4 w-4" />
              <span>Stock will be low after adjustment</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Label htmlFor="reason-mobile" className="text-base">Reason *</Label>
        <Select
          value={reason}
          onValueChange={(v) => setReason(v as AdjustmentReason)}
        >
          <SelectTrigger id="reason-mobile" className="h-14 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADJUSTMENT_REASONS.map((r) => (
              <SelectItem key={r} value={r} className="text-base">
                {REASON_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label htmlFor="notes-mobile" className="text-base">Notes (Optional)</Label>
        <Textarea
          id="notes-mobile"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any additional details..."
          rows={4}
          className="text-base"
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting || willGoNegative}
          className="w-full h-14 text-base bg-gradient-to-r from-emerald-600 to-teal-600"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Apply Adjustment
            </>
          )}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="h-12"
          >
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            disabled={isSubmitting}
            className="h-12"
          >
            <X className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>
    </form>
  );
}

export function StockAdjustFormMobile({
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
  onReset,
  onSubmit,
}: StockAdjustFormMobileProps) {
  const [step, setStep] = useState<Step>('select');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const calculatedNewStock = useMemo(() => {
    if (!selectedItem || !quantity) return null;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return null;
    return adjustmentType === 'increase'
      ? selectedItem.current_stock + qty
      : Math.max(0, selectedItem.current_stock - qty);
  }, [selectedItem, quantity, adjustmentType]);

  const isLowStock = selectedItem ? selectedItem.current_stock < 10 : false;
  const willGoNegative = calculatedNewStock !== null && calculatedNewStock < 0;
  const willBeLowStock = calculatedNewStock !== null && calculatedNewStock < 10 && calculatedNewStock >= 0;

  useEffect(() => {
    if (!selectedItemId) {
      setStep('select');
      setSearchQuery('');
    }
  }, [selectedItemId]);

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
    <div className="space-y-4">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6" />
            {step === 'select' ? 'Select Item' : 'Adjust Stock'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'select' ? (
            <SelectItemStep
              items={items}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedItemId={selectedItemId}
              setSelectedItemId={setSelectedItemId}
              onNext={() => setStep('adjust')}
            />
          ) : selectedItem ? (
            <AdjustDetailsStep
              selectedItem={selectedItem}
              adjustmentType={adjustmentType}
              setAdjustmentType={setAdjustmentType}
              quantity={quantity}
              setQuantity={setQuantity}
              reason={reason}
              setReason={setReason}
              notes={notes}
              setNotes={setNotes}
              calculatedNewStock={calculatedNewStock}
              willGoNegative={willGoNegative}
              willBeLowStock={willBeLowStock}
              isLowStock={isLowStock}
              isSubmitting={isSubmitting}
              error={error}
              onBack={() => setStep('select')}
              onReset={() => {
                onReset();
                setStep('select');
              }}
              onSubmit={onSubmit}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select an item to adjust stock</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
