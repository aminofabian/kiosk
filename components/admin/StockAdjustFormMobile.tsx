'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
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
import { ADJUSTMENT_REASONS, isDiscreteUnitType } from '@/lib/constants';

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock / New Delivery',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

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
  onReset: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

function AdjustDetailsDrawerContent({
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
  onClose,
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
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 p-4 pb-8 overflow-y-auto">
      <div className="p-4 rounded-xl bg-muted space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Current Stock</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">
              {isDiscreteUnitType(selectedItem.unit_type)
                ? Math.round(selectedItem.current_stock).toString()
                : selectedItem.current_stock.toFixed(2)}
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

      <div className="space-y-2">
        <Label className="text-sm font-medium">Adjustment Type</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAdjustmentType('increase')}
            className={`p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
              adjustmentType === 'increase'
                ? 'border-green-500 bg-green-50 dark:bg-green-950 shadow-md'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5">
              <TrendingUp
                className={`h-5 w-5 ${
                  adjustmentType === 'increase' ? 'text-green-600' : 'text-muted-foreground'
                }`}
              />
              <span className="font-semibold text-sm">Increase</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setAdjustmentType('decrease')}
            className={`p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
              adjustmentType === 'decrease'
                ? 'border-red-500 bg-red-50 dark:bg-red-950 shadow-md'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5">
              <TrendingDown
                className={`h-5 w-5 ${
                  adjustmentType === 'decrease' ? 'text-red-600' : 'text-muted-foreground'
                }`}
              />
              <span className="font-semibold text-sm">Decrease</span>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity-mobile" className="text-sm font-medium">
          Quantity ({selectedItem.unit_type}) *
        </Label>
        <Input
          id="quantity-mobile"
          type="number"
          step={isDiscreteUnitType(selectedItem.unit_type) ? "1" : "0.01"}
          min="0"
          value={quantity}
          onChange={(e) => {
            const value = e.target.value;
            if (isDiscreteUnitType(selectedItem.unit_type)) {
              const intValue = parseInt(value, 10);
              if (value === '' || (!isNaN(intValue) && intValue >= 0)) {
                setQuantity(value === '' ? '' : intValue.toString());
              }
            } else {
              setQuantity(value);
            }
          }}
          placeholder={isDiscreteUnitType(selectedItem.unit_type) ? "0" : "0.00"}
          required
          className="text-lg h-12"
        />
      </div>

      {calculatedNewStock !== null && (
        <div className="p-4 rounded-xl bg-primary/5 border-2 border-primary/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">New Stock</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {isDiscreteUnitType(selectedItem.unit_type)
                  ? Math.round(calculatedNewStock).toString()
                  : calculatedNewStock.toFixed(2)}
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
              {isDiscreteUnitType(selectedItem.unit_type)
                ? (parseInt(quantity, 10) || 0).toString()
                : parseFloat(quantity).toFixed(2)} {selectedItem.unit_type}
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

      <div className="space-y-2">
        <Label htmlFor="reason-mobile" className="text-sm font-medium">Reason *</Label>
        <Select
          value={reason}
          onValueChange={(v) => setReason(v as AdjustmentReason)}
        >
          <SelectTrigger id="reason-mobile" className="h-12 text-base">
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

      <div className="space-y-2">
        <Label htmlFor="notes-mobile" className="text-sm font-medium">Notes (Optional)</Label>
        <Textarea
          id="notes-mobile"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any additional details..."
          rows={3}
          className="text-base"
        />
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || willGoNegative}
          className="w-full h-12 text-base bg-gradient-to-r from-emerald-600 to-teal-600"
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
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="w-full h-10"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
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
  onReset,
  onSubmit,
}: StockAdjustFormMobileProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.unit_type.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const calculatedNewStock = useMemo(() => {
    if (!selectedItem || !quantity) return null;
    const isDiscrete = isDiscreteUnitType(selectedItem.unit_type);
    const qty = isDiscrete ? parseInt(quantity, 10) : parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return null;
    return adjustmentType === 'increase'
      ? selectedItem.current_stock + qty
      : Math.max(0, selectedItem.current_stock - qty);
  }, [selectedItem, quantity, adjustmentType]);

  const isLowStock = selectedItem ? selectedItem.current_stock < 10 : false;
  const willGoNegative = calculatedNewStock !== null && calculatedNewStock < 0;
  const willBeLowStock = calculatedNewStock !== null && calculatedNewStock < 10 && calculatedNewStock >= 0;

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    // Reset form state when closing drawer
    onReset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    await onSubmit(e);
    // Don't close drawer here - let the parent handle success state
  };

  // Close drawer when reset is triggered (e.g., after successful submission)
  useEffect(() => {
    if (!selectedItemId && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [selectedItemId, drawerOpen]);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6" />
            Select Item
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
                  const isLow = item.current_stock < 10;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemSelect(item.id)}
                      className="w-full text-left p-4 rounded-xl border-2 border-border bg-card transition-all active:scale-[0.98] hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base mb-1">{item.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-muted-foreground">
                              {isDiscreteUnitType(item.unit_type)
                                ? Math.round(item.current_stock).toString()
                                : item.current_stock.toFixed(2)} {item.unit_type}
                            </span>
                            {isLow && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                {selectedItem?.name || 'Adjust Stock'}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          {selectedItem && (
            <AdjustDetailsDrawerContent
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
              onClose={handleDrawerClose}
              onSubmit={handleSubmit}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
