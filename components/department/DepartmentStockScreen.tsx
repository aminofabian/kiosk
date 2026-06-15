'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useDepartmentApp } from '@/components/department/DepartmentAppProvider';
import { PosDepartmentRail } from '@/components/pos/PosDepartmentRail';
import { apiDelete, apiPatch, apiPost } from '@/lib/utils/api-client';
import { itemMatchesShopType } from '@/lib/utils/shop-type';
import type { Item } from '@/lib/db/types';
import type { AdjustmentReason } from '@/lib/constants';
import { ADJUSTMENT_REASONS, isDiscreteUnitType, UNIT_TYPES } from '@/lib/constants';
import { toast } from 'sonner';

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Count error',
  damage: 'Damage',
  other: 'Other',
};

const REDUCTION_REASONS: AdjustmentReason[] = [
  'spoilage',
  'theft',
  'damage',
  'counting_error',
  'other',
];

function formatStockQty(stock: number, unitType: Item['unit_type']) {
  return isDiscreteUnitType(unitType)
    ? Math.round(stock).toString()
    : stock.toFixed(2);
}

function stockStatus(item: Item): 'out' | 'low' | 'ok' {
  if (item.current_stock <= 0) return 'out';
  if (item.min_stock_level != null) {
    if (item.current_stock <= item.min_stock_level) return 'low';
  } else if (item.current_stock < 10) {
    return 'low';
  }
  return 'ok';
}

function formatMinStock(item: Item) {
  if (item.min_stock_level == null) return '—';
  return formatStockQty(item.min_stock_level, item.unit_type);
}

function formatPrice(price: number) {
  return price.toFixed(0);
}

function InlineEditActions({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-0.5 shrink-0">
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#1c6a1e] text-white hover:bg-[#165a19]"
        aria-label="Save"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

type StockFilterKey = 'all' | 'out' | 'low' | 'ok';

const STOCK_FILTER_TABS: { key: StockFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Out' },
  { key: 'low', label: 'Low' },
  { key: 'ok', label: 'OK' },
];

function StockStatusBadge({ status }: { status: 'out' | 'low' | 'ok' }) {
  if (status === 'out') {
    return (
      <span className="inline-flex items-center px-1 py-px rounded text-[8px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
        Out
      </span>
    );
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center px-1 py-px rounded text-[8px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1 py-px rounded text-[8px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      OK
    </span>
  );
}

interface InlineEditableCellProps {
  displayValue: string;
  isEditing: boolean;
  value: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  unitType?: Item['unit_type'];
  valueKind?: 'quantity' | 'price';
  allowEmpty?: boolean;
}

function InlineEditableCell({
  displayValue,
  isEditing,
  value,
  isSaving,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
  unitType = 'piece',
  valueKind = 'quantity',
  allowEmpty = false,
}: InlineEditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isSaving) {
    return (
      <span className="inline-flex justify-end w-full">
        <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e]" />
      </span>
    );
  }

  if (isEditing) {
    return (
      <div
        className="flex flex-col gap-1 min-w-0 w-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          type="number"
          step={valueKind === 'price' ? '1' : isDiscreteUnitType(unitType) ? '1' : '0.01'}
          min={valueKind === 'price' ? '1' : '0'}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (valueKind === 'price') {
              if (next === '' || /^\d*\.?\d*$/.test(next)) {
                onChange(next);
              }
              return;
            }
            if (allowEmpty && next === '') {
              onChange('');
              return;
            }
            if (isDiscreteUnitType(unitType)) {
              const intValue = parseInt(next, 10);
              if (next === '' || (!isNaN(intValue) && intValue >= 0)) {
                onChange(next === '' ? '' : intValue.toString());
              }
            } else {
              onChange(next);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          className="h-7 w-full min-w-0 text-right text-xs font-semibold tabular-nums px-1.5"
        />
        <InlineEditActions onSave={onSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      className={`w-full min-w-0 text-right text-xs font-semibold tabular-nums hover:text-[#1c6a1e] hover:underline underline-offset-2 ${
        displayValue === '—'
          ? 'text-slate-400 dark:text-slate-500'
          : 'text-slate-900 dark:text-white'
      }`}
    >
      {displayValue}
    </button>
  );
}

interface InlineUnitCellProps {
  unitType: Item['unit_type'];
  isEditing: boolean;
  value: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function InlineUnitCell({
  unitType,
  isEditing,
  value,
  isSaving,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
}: InlineUnitCellProps) {
  if (isSaving) {
    return (
      <span className="inline-flex">
        <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e]" />
      </span>
    );
  }

  if (isEditing) {
    return (
      <div
        className="flex flex-col gap-1 min-w-0 w-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] text-[10px] font-semibold uppercase px-1"
          autoFocus
        >
          {UNIT_TYPES.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <InlineEditActions onSave={onSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      className="w-full min-w-0 text-left text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400 hover:text-[#1c6a1e] hover:underline underline-offset-2"
    >
      {unitType}
    </button>
  );
}

interface AdjustFormProps {
  selectedItem: Item;
  adjustmentType: 'increase' | 'decrease';
  setAdjustmentType: (t: 'increase' | 'decrease') => void;
  quantity: string;
  setQuantity: (q: string) => void;
  reason: AdjustmentReason;
  setReason: (r: AdjustmentReason) => void;
  notes: string;
  setNotes: (n: string) => void;
  calculatedNewStock: number | null;
  willGoNegative: boolean;
  willBeLowStock: boolean;
  isLowStock: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  onClose: () => void;
}

function DepartmentStockAdjustForm({
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
  isDeleting,
  error,
  onSubmit,
  onDelete,
  onClose,
}: AdjustFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current stock
            </span>
            <span className="text-lg font-bold tabular-nums">
              {formatStockQty(selectedItem.current_stock, selectedItem.unit_type)}{' '}
              <span className="text-sm font-normal text-slate-500">{selectedItem.unit_type}</span>
            </span>
          </div>
          {isLowStock && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Low stock
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAdjustmentType('decrease')}
            className={`py-2.5 px-3 rounded-lg border-2 text-sm font-semibold flex items-center justify-center gap-1.5 ${
              adjustmentType === 'decrease'
                ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            Reduce
          </button>
          <button
            type="button"
            onClick={() => {
              setAdjustmentType('increase');
              setReason('restock');
            }}
            className={`py-2.5 px-3 rounded-lg border-2 text-sm font-semibold flex items-center justify-center gap-1.5 ${
              adjustmentType === 'increase'
                ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Add
          </button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reason
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {(adjustmentType === 'decrease' ? REDUCTION_REASONS : ADJUSTMENT_REASONS).map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    reason === r
                      ? 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {REASON_LABELS[r]}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="dept-stock-qty"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Quantity ({selectedItem.unit_type})
          </Label>
          <Input
            id="dept-stock-qty"
            type="number"
            step={isDiscreteUnitType(selectedItem.unit_type) ? '1' : '0.01'}
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
            placeholder="0"
            required
            className="h-10 text-base tabular-nums"
          />
        </div>

        {calculatedNewStock !== null && (
          <div className="p-3 rounded-lg border border-[#1c6a1e]/25 bg-[#1c6a1e]/5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">New stock</span>
              <span className="text-xl font-bold text-[#1c6a1e] tabular-nums">
                {formatStockQty(calculatedNewStock, selectedItem.unit_type)}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              {adjustmentType === 'increase' ? '+' : '-'}
              {quantity || '0'} {selectedItem.unit_type}
            </p>
            {willGoNegative && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Cannot go below zero
              </p>
            )}
            {willBeLowStock && !willGoNegative && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Will be low after change
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label
            htmlFor="dept-stock-notes"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Notes
          </Label>
          <Textarea
            id="dept-stock-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details..."
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2 bg-white dark:bg-[#1c2e18] safe-area-bottom">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || willGoNegative}
            className="flex-1 h-11 bg-[#1c6a1e] hover:bg-[#165a19]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          disabled={isDeleting || isSubmitting}
          className="w-full h-10 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Delete product
        </Button>
      </div>
    </form>
  );
}

export function DepartmentStockScreen() {
  const { assignedTypes, shopType, setShopType } = useDepartmentApp();

  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilterKey>('all');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState('');
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [editingMinStockId, setEditingMinStockId] = useState<string | null>(null);
  const [editingMinStockValue, setEditingMinStockValue] = useState('');
  const [savingMinStockId, setSavingMinStockId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitValue, setEditingUnitValue] = useState('');
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('decrease');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('spoilage');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingItems(true);
      else setRefreshing(true);
      const params = new URLSearchParams({ all: 'true', sellableOnly: 'true' });
      if (assignedTypes.length > 0) {
        params.set('itemTypes', assignedTypes.join(','));
      }
      const res = await fetch(`/api/items?${params}`);
      const result = await res.json();
      if (result.success) {
        setItems(result.data);
      }
    } catch {
      toast.error('Failed to load items');
    } finally {
      setLoadingItems(false);
      setRefreshing(false);
    }
  }, [assignedTypes]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const resetForm = useCallback(() => {
    setQuantity('');
    setNotes('');
    setError(null);
    setAdjustmentType('decrease');
    setReason('spoilage');
  }, []);

  const scopedItems = useMemo(() => {
    const list = items.filter((item) => itemMatchesShopType(item, shopType));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.unit_type.toLowerCase().includes(q),
    );
  }, [items, searchQuery, shopType]);

  const statusCounts = useMemo(
    () => ({
      all: scopedItems.length,
      out: scopedItems.filter((i) => stockStatus(i) === 'out').length,
      low: scopedItems.filter((i) => stockStatus(i) === 'low').length,
      ok: scopedItems.filter((i) => stockStatus(i) === 'ok').length,
    }),
    [scopedItems],
  );

  const filteredItems = useMemo(() => {
    if (stockFilter === 'all') return scopedItems;
    return scopedItems.filter((item) => stockStatus(item) === stockFilter);
  }, [scopedItems, stockFilter]);

  useEffect(() => {
    if (
      selectedItem &&
      (!itemMatchesShopType(selectedItem, shopType) ||
        (stockFilter !== 'all' && stockStatus(selectedItem) !== stockFilter))
    ) {
      setSelectedItem(null);
      setDrawerOpen(false);
      resetForm();
    }
  }, [shopType, stockFilter, selectedItem, resetForm]);

  const calculatedNewStock = useMemo(() => {
    if (!selectedItem || !quantity) return null;
    const isDiscrete = isDiscreteUnitType(selectedItem.unit_type);
    const qty = isDiscrete ? parseInt(quantity, 10) : parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return null;
    return adjustmentType === 'increase'
      ? selectedItem.current_stock + qty
      : Math.max(0, selectedItem.current_stock - qty);
  }, [selectedItem, quantity, adjustmentType]);

  const willGoNegative = calculatedNewStock !== null && calculatedNewStock < 0;
  const willBeLowStock =
    calculatedNewStock !== null &&
    selectedItem != null &&
    (selectedItem.min_stock_level != null
      ? calculatedNewStock <= selectedItem.min_stock_level
      : calculatedNewStock < 10);
  const isLowStock = selectedItem ? stockStatus(selectedItem) === 'low' : false;

  const handleShopTypeChange = useCallback(
    (newShopType: string) => {
      setShopType(newShopType);
      setSelectedItem(null);
      setDrawerOpen(false);
      resetForm();
    },
    [setShopType, resetForm],
  );

  const clearInlineEdits = () => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingUnitId(null);
    setEditingUnitValue('');
  };

  const openDrawer = useCallback((item: Item) => {
    clearInlineEdits();
    setSelectedItem(item);
    setQuantity('');
    setNotes('');
    setError(null);
    setAdjustmentType('decrease');
    setReason('spoilage');
    setDrawerOpen(true);
  }, []);

  const closeSelection = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
    resetForm();
  };

  const startInlineStockEdit = (item: Item) => {
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingUnitId(null);
    setEditingUnitValue('');
    setEditingStockId(item.id);
    setEditingStockValue(formatStockQty(item.current_stock, item.unit_type));
  };

  const cancelInlineStockEdit = () => {
    setEditingStockId(null);
    setEditingStockValue('');
  };

  const startInlineMinStockEdit = (item: Item) => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingUnitId(null);
    setEditingUnitValue('');
    setEditingMinStockId(item.id);
    setEditingMinStockValue(
      item.min_stock_level != null
        ? formatStockQty(item.min_stock_level, item.unit_type)
        : '',
    );
  };

  const cancelInlineMinStockEdit = () => {
    setEditingMinStockId(null);
    setEditingMinStockValue('');
  };

  const startInlinePriceEdit = (item: Item) => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingUnitId(null);
    setEditingUnitValue('');
    setEditingPriceId(item.id);
    setEditingPriceValue(String(Math.round(item.current_sell_price)));
  };

  const cancelInlinePriceEdit = () => {
    setEditingPriceId(null);
    setEditingPriceValue('');
  };

  const startInlineUnitEdit = (item: Item) => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingUnitId(item.id);
    setEditingUnitValue(item.unit_type);
  };

  const cancelInlineUnitEdit = () => {
    setEditingUnitId(null);
    setEditingUnitValue('');
  };

  const saveInlineStock = async (item: Item) => {
    const isDiscrete = isDiscreteUnitType(item.unit_type);
    const target = isDiscrete ? parseInt(editingStockValue, 10) : parseFloat(editingStockValue);

    if (!editingStockValue || isNaN(target) || target < 0) {
      toast.error('Enter a valid stock level');
      cancelInlineStockEdit();
      return;
    }

    const diff = target - item.current_stock;
    if (diff === 0) {
      cancelInlineStockEdit();
      return;
    }

    setSavingStockId(item.id);
    setEditingStockId(null);
    try {
      const result = await apiPost('/api/stock/adjust', {
        itemId: item.id,
        adjustmentType: diff > 0 ? 'increase' : 'decrease',
        quantity: Math.abs(diff),
        reason: 'counting_error',
        notes: null,
      });

      if (result.success) {
        toast.success('Stock updated');
        void fetchItems(true);
      } else {
        toast.error(result.message || 'Failed to update stock');
        setEditingStockId(item.id);
        setEditingStockValue(formatStockQty(target, item.unit_type));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setEditingStockId(item.id);
      setEditingStockValue(formatStockQty(target, item.unit_type));
    } finally {
      setSavingStockId(null);
      if (!editingStockId) setEditingStockValue('');
    }
  };

  const saveInlineMinStock = async (item: Item) => {
    const trimmed = editingMinStockValue.trim();
    const isDiscrete = isDiscreteUnitType(item.unit_type);
    const parsed =
      trimmed === ''
        ? null
        : isDiscrete
          ? parseInt(trimmed, 10)
          : parseFloat(trimmed);

    if (trimmed !== '' && (parsed == null || isNaN(parsed) || parsed < 0)) {
      toast.error('Enter a valid minimum stock level');
      return;
    }

    if (trimmed === '' && item.min_stock_level == null) {
      cancelInlineMinStockEdit();
      return;
    }

    if (parsed !== null && item.min_stock_level === parsed) {
      cancelInlineMinStockEdit();
      return;
    }

    setSavingMinStockId(item.id);
    setEditingMinStockId(null);
    try {
      const result = await apiPatch(`/api/items/${item.id}/min-stock`, {
        minStockLevel: parsed,
      });

      if (result.success) {
        toast.success('Minimum stock updated');
        void fetchItems(true);
      } else {
        toast.error(result.message || 'Failed to update minimum stock');
        setEditingMinStockId(item.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setEditingMinStockId(item.id);
    } finally {
      setSavingMinStockId(null);
      if (!editingMinStockId) setEditingMinStockValue('');
    }
  };

  const saveInlinePrice = async (item: Item) => {
    const parsed = parseFloat(editingPriceValue);

    if (!editingPriceValue || isNaN(parsed) || parsed <= 0) {
      toast.error('Enter a valid price');
      return;
    }

    if (Math.abs(parsed - item.current_sell_price) < 0.01) {
      cancelInlinePriceEdit();
      return;
    }

    setSavingPriceId(item.id);
    setEditingPriceId(null);
    try {
      const result = await apiPatch(`/api/items/${item.id}/prices`, {
        sellPrice: parsed,
      });

      if (result.success) {
        toast.success('Price updated');
        void fetchItems(true);
      } else {
        toast.error(result.message || 'Failed to update price');
        setEditingPriceId(item.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setEditingPriceId(item.id);
    } finally {
      setSavingPriceId(null);
      if (!editingPriceId) setEditingPriceValue('');
    }
  };

  const saveInlineUnit = async (item: Item) => {
    if (!editingUnitValue || !UNIT_TYPES.includes(editingUnitValue as Item['unit_type'])) {
      toast.error('Select a valid unit');
      return;
    }

    if (editingUnitValue === item.unit_type) {
      cancelInlineUnitEdit();
      return;
    }

    setSavingUnitId(item.id);
    setEditingUnitId(null);
    try {
      const result = await apiPatch(`/api/items/${item.id}/unit`, {
        unitType: editingUnitValue,
      });

      if (result.success) {
        toast.success('Unit updated');
        void fetchItems(true);
      } else {
        toast.error(result.message || 'Failed to update unit');
        setEditingUnitId(item.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setEditingUnitId(item.id);
    } finally {
      setSavingUnitId(null);
      if (!editingUnitId) setEditingUnitValue('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItem) return;

    const isDiscrete = isDiscreteUnitType(selectedItem.unit_type);
    const qty = isDiscrete ? parseInt(quantity, 10) : parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError('Enter a valid quantity');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiPost('/api/stock/adjust', {
        itemId: selectedItem.id,
        adjustmentType,
        quantity: qty,
        reason,
        notes: notes.trim() || null,
      });

      if (result.success) {
        toast.success('Stock updated');
        closeSelection();
        void fetchItems(true);
      } else {
        setError(result.message || 'Failed to update stock');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item?: Item) => {
    const target = item ?? selectedItem;
    if (!target) return;

    const confirmed = window.confirm(
      `Delete "${target.name}"? This removes it from the catalog.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    try {
      const result = await apiDelete(`/api/items/${target.id}`);
      if (result.success) {
        toast.success('Product deleted');
        if (selectedItem?.id === target.id) {
          closeSelection();
        }
        void fetchItems(true);
      } else {
        const message = result.message || 'Failed to delete product';
        if (selectedItem?.id === target.id) {
          setError(message);
        } else {
          toast.error(message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      if (selectedItem?.id === target.id) {
        setError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const adjustFormProps = selectedItem
    ? {
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
        isDeleting,
        error,
        onSubmit: handleSubmit,
        onDelete: () => void handleDelete(),
        onClose: closeSelection,
      }
    : null;

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden bg-white dark:bg-[#132210] text-[#101b0d] dark:text-[#f0fdf4]">
      <header className="shrink-0 safe-area-top border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2c17]">
        <div className="flex items-center justify-between gap-2 px-2 sm:px-3 h-10 border-b border-slate-200/80 dark:border-slate-800/80 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Package className="w-4 h-4 text-[#1c6a1e] shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white truncate">
              Stock
            </h1>
            {!loadingItems && (
              <span className="text-xs text-slate-500 tabular-nums">
                ({filteredItems.length})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void fetchItems(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="px-2 sm:px-3 py-1.5 space-y-1.5 min-w-0">
          <div className="relative w-full min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="pl-7 h-8 text-xs w-full min-w-0 bg-white dark:bg-[#1c2e18] border-slate-200 dark:border-slate-700 rounded-md"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STOCK_FILTER_TABS.map((tab) => {
              const active = stockFilter === tab.key;
              const count = statusCounts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStockFilter(tab.key)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold border transition-colors ${
                    active
                      ? tab.key === 'out'
                        ? 'bg-red-600 text-white border-red-600'
                        : tab.key === 'low'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : tab.key === 'ok'
                            ? 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                            : 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                      : 'bg-white dark:bg-[#1c2e18] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`tabular-nums text-[10px] px-1 py-px rounded ${
                      active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {assignedTypes.length === 0 && (
        <div className="shrink-0 mx-3 mt-2 rounded border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          No product types assigned. Ask an admin to set your departments.
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <PosDepartmentRail
          allowedTypes={assignedTypes}
          onShopTypeChange={handleShopTypeChange}
        />

        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          {loadingItems ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-[#1c6a1e]" />
              Loading inventory...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
              <Package className="w-10 h-10 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {scopedItems.length === 0 ? 'No items found' : 'No items match this filter'}
              </p>
              {stockFilter !== 'all' && scopedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStockFilter('all')}
                  className="mt-2 text-xs font-semibold text-[#1c6a1e] hover:underline"
                >
                  Show all ({scopedItems.length})
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1a2c17] border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-left text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-1 py-1.5 w-[5%] text-center">#</th>
                    <th className="px-1 py-1.5 w-[28%]">Product</th>
                    <th className="px-1 py-1.5 w-[9%]">Unit</th>
                    <th className="px-1 py-1.5 w-[11%] text-right">Price</th>
                    <th className="px-1 py-1.5 w-[11%] text-right">Stock</th>
                    <th className="px-1 py-1.5 w-[11%] text-right">Min</th>
                    <th className="px-1 py-1.5 w-[8%]">St</th>
                    <th className="px-1 py-1.5 w-[7%] text-right" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const status = stockStatus(item);
                    const selected = selectedItem?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors ${
                          selected
                            ? 'bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20'
                            : index % 2 === 0
                              ? 'bg-white dark:bg-[#132210]'
                              : 'bg-slate-50/80 dark:bg-[#161f14]'
                        }`}
                      >
                        <td className="px-1 py-1.5 text-center text-[10px] text-slate-400 tabular-nums align-top">
                          {index + 1}
                        </td>
                        <td className="px-1 py-1.5 font-medium text-slate-900 dark:text-white min-w-0 align-top">
                          <button
                            type="button"
                            onClick={() => openDrawer(item)}
                            className="text-left whitespace-normal break-words text-xs leading-snug hover:text-[#1c6a1e] hover:underline underline-offset-2 w-full"
                          >
                            {item.name}
                          </button>
                        </td>
                        <td className="px-1 py-1.5 min-w-0 align-top">
                          <InlineUnitCell
                            unitType={item.unit_type}
                            isEditing={editingUnitId === item.id}
                            value={editingUnitId === item.id ? editingUnitValue : item.unit_type}
                            isSaving={savingUnitId === item.id}
                            onStartEdit={() => startInlineUnitEdit(item)}
                            onChange={setEditingUnitValue}
                            onSave={() => void saveInlineUnit(item)}
                            onCancel={cancelInlineUnitEdit}
                          />
                        </td>
                        <td className="px-1 py-1.5 text-right min-w-0 align-top">
                          <InlineEditableCell
                            displayValue={formatPrice(item.current_sell_price)}
                            isEditing={editingPriceId === item.id}
                            value={editingPriceId === item.id ? editingPriceValue : ''}
                            isSaving={savingPriceId === item.id}
                            valueKind="price"
                            onStartEdit={() => startInlinePriceEdit(item)}
                            onChange={setEditingPriceValue}
                            onSave={() => void saveInlinePrice(item)}
                            onCancel={cancelInlinePriceEdit}
                          />
                        </td>
                        <td className="px-1 py-1.5 text-right min-w-0 align-top">
                          <InlineEditableCell
                            displayValue={formatStockQty(item.current_stock, item.unit_type)}
                            isEditing={editingStockId === item.id}
                            value={editingStockId === item.id ? editingStockValue : ''}
                            isSaving={savingStockId === item.id}
                            unitType={item.unit_type}
                            onStartEdit={() => startInlineStockEdit(item)}
                            onChange={setEditingStockValue}
                            onSave={() => void saveInlineStock(item)}
                            onCancel={cancelInlineStockEdit}
                          />
                        </td>
                        <td className="px-1 py-1.5 text-right min-w-0 align-top">
                          <InlineEditableCell
                            displayValue={formatMinStock(item)}
                            isEditing={editingMinStockId === item.id}
                            value={editingMinStockId === item.id ? editingMinStockValue : ''}
                            isSaving={savingMinStockId === item.id}
                            unitType={item.unit_type}
                            allowEmpty
                            onStartEdit={() => startInlineMinStockEdit(item)}
                            onChange={setEditingMinStockValue}
                            onSave={() => void saveInlineMinStock(item)}
                            onCancel={cancelInlineMinStockEdit}
                          />
                        </td>
                        <td className="px-1 py-1.5 align-top">
                          <StockStatusBadge status={status} />
                        </td>
                        <td className="px-1 py-1.5 text-right align-top">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(item);
                            }}
                            disabled={isDeleting}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                            title="Delete product"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loadingItems && filteredItems.length > 0 && (
            <div className="shrink-0 px-2 py-1 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2c17] text-[9px] font-medium uppercase tracking-wide text-slate-500">
              <span>{filteredItems.length} rows</span>
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => !open && closeSelection()}
        direction="right"
      >
        <DrawerContent className="h-[100dvh] w-full max-w-none rounded-none inset-0 data-[vaul-drawer-direction=right]:w-full [&>div:first-child]:hidden flex flex-col">
          <DrawerHeader className="shrink-0 border-b border-slate-100 dark:border-slate-800 text-left py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Adjust stock
                </p>
                <DrawerTitle className="text-base font-bold truncate pr-2">
                  {selectedItem?.name || 'Stock'}
                </DrawerTitle>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                  <X className="h-5 w-5" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          {selectedItem && adjustFormProps && (
            <DepartmentStockAdjustForm {...adjustFormProps} />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
