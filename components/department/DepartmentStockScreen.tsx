'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { computeTopup, formatTopupDisplay } from '@/lib/utils/inventory-topup';
import { isDiscreteUnitType, UNIT_TYPES } from '@/lib/constants';
import { toast } from 'sonner';

type StockListItem = Item & { last_updated_at?: number };

function sortByLastUpdated(items: StockListItem[]): StockListItem[] {
  return [...items].sort(
    (a, b) =>
      (b.last_updated_at ?? b.created_at) - (a.last_updated_at ?? a.created_at),
  );
}

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

function formatExpectedStock(item: Item) {
  if (item.expected_stock_level == null) return '—';
  return formatStockQty(item.expected_stock_level, item.unit_type);
}

function parseEditableStockValue(
  raw: string,
  unitType: Item['unit_type'],
): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const isDiscrete = isDiscreteUnitType(unitType);
  const parsed = isDiscrete ? parseInt(trimmed, 10) : parseFloat(trimmed);
  if (isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

function displayItemName(item: Item): string {
  if (item.parent_item_id) {
    return item.variant_name?.trim() || item.name;
  }
  return item.name;
}

function bumpItemUpdated(
  items: StockListItem[],
  itemId: string,
  patch: Partial<StockListItem>,
): StockListItem[] {
  const now = Math.floor(Date.now() / 1000);
  return sortByLastUpdated(
    items.map((i) =>
      i.id === itemId ? { ...i, ...patch, last_updated_at: now } : i,
    ),
  );
}

function getLiveTopup(
  item: StockListItem,
  ctx: {
    editingStockId: string | null;
    editingStockValue: string;
    editingMinStockId: string | null;
    editingMinStockValue: string;
    editingExpectedStockId: string | null;
    editingExpectedStockValue: string;
  },
): number {
  const currentStock =
    ctx.editingStockId === item.id
      ? (parseEditableStockValue(ctx.editingStockValue, item.unit_type) ??
        item.current_stock)
      : item.current_stock;

  const minStock =
    ctx.editingMinStockId === item.id
      ? parseEditableStockValue(ctx.editingMinStockValue, item.unit_type)
      : item.min_stock_level;

  const expectedStock =
    ctx.editingExpectedStockId === item.id
      ? parseEditableStockValue(ctx.editingExpectedStockValue, item.unit_type)
      : item.expected_stock_level;

  return computeTopup(currentStock, minStock, expectedStock);
}

function TopupButton({
  topup,
  unitType,
  isLoading,
  onTopup,
}: {
  topup: number;
  unitType: Item['unit_type'];
  isLoading?: boolean;
  onTopup: () => void;
}) {
  if (topup <= 0) {
    return (
      <span className="text-slate-400 dark:text-slate-500 tabular-nums text-xs">—</span>
    );
  }

  const label = formatTopupDisplay(topup, (v) => formatStockQty(v, unitType));

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTopup();
      }}
      disabled={isLoading}
      className="inline-flex items-center justify-end gap-0.5 w-full min-h-7 px-1 rounded-md text-amber-800 dark:text-amber-200 font-bold tabular-nums text-[10px] sm:text-xs bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 border border-amber-300/60 dark:border-amber-600/50 disabled:opacity-60"
      title={`Top up ${label}`}
    >
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      ) : (
        <ArrowUpCircle className="w-3 h-3 shrink-0" />
      )}
      +{label}
    </button>
  );
}

interface SimpleStockFormProps {
  selectedItem: Item;
  topup: number;
  isSubmitting: boolean;
  onTopup: () => void;
  onClose: () => void;
}

function DepartmentStockSimpleForm({
  selectedItem,
  topup,
  isSubmitting,
  onTopup,
  onClose,
}: SimpleStockFormProps) {
  const needsTopup = topup > 0;
  const target = selectedItem.expected_stock_level;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 p-4 space-y-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Now
            </span>
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatStockQty(selectedItem.current_stock, selectedItem.unit_type)}
              <span className="text-sm font-normal text-slate-500 ml-1">
                {selectedItem.unit_type}
              </span>
            </span>
          </div>
          {target != null && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target
              </span>
              <span className="text-lg font-semibold tabular-nums text-[#1c6a1e]">
                {formatStockQty(target, selectedItem.unit_type)}{' '}
                <span className="text-sm font-normal text-slate-500">
                  {selectedItem.unit_type}
                </span>
              </span>
            </div>
          )}
        </div>

        {needsTopup ? (
          <div className="space-y-2">
            <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
              Below minimum — add{' '}
              <strong className="tabular-nums">
                {formatStockQty(topup, selectedItem.unit_type)}
              </strong>{' '}
              to reach target
            </p>
            <Button
              type="button"
              onClick={onTopup}
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-bold bg-[#1c6a1e] hover:bg-[#165a19] shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Top up +{formatStockQty(topup, selectedItem.unit_type)}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-200">Stock OK</p>
            <p className="text-sm text-slate-500 mt-1">
              No top-up needed. Tap Stock in the table to change quantity.
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-[#1c2e18] safe-area-bottom">
        <Button type="button" variant="outline" onClick={onClose} className="w-full h-11">
          Close
        </Button>
      </div>
    </div>
  );
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

export function DepartmentStockScreen() {
  const { assignedTypes, shopType, setShopType } = useDepartmentApp();

  const [items, setItems] = useState<StockListItem[]>([]);
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
  const [editingExpectedStockId, setEditingExpectedStockId] = useState<string | null>(null);
  const [editingExpectedStockValue, setEditingExpectedStockValue] = useState('');
  const [savingExpectedStockId, setSavingExpectedStockId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitValue, setEditingUnitValue] = useState('');
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);
  const [isTopupSubmitting, setIsTopupSubmitting] = useState(false);
  const [toppingUpId, setToppingUpId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingItems(true);
      else setRefreshing(true);
      const params = new URLSearchParams({
        all: 'true',
        sellableOnly: 'true',
        sort: 'updated',
      });
      if (assignedTypes.length > 0) {
        params.set('itemTypes', assignedTypes.join(','));
      }
      const res = await fetch(`/api/items?${params}`);
      const result = await res.json();
      if (result.success) {
        setItems(sortByLastUpdated(result.data));
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

  const closeSelection = useCallback(() => {
    setDrawerOpen(false);
    setSelectedItem(null);
  }, []);

  const applyTopup = useCallback(
    async (item: Item, qty: number, options?: { closeDrawer?: boolean }) => {
      if (qty <= 0) {
        toast.error('Nothing to top up');
        return;
      }

      setToppingUpId(item.id);
      setIsTopupSubmitting(true);
      try {
        const result = await apiPost('/api/stock/adjust', {
          itemId: item.id,
          adjustmentType: 'increase',
          quantity: qty,
          reason: 'restock',
          notes: null,
        });

        if (result.success) {
          const newStock = item.current_stock + qty;
          toast.success(
            `Added ${formatStockQty(qty, item.unit_type)} — now ${formatStockQty(newStock, item.unit_type)}`,
          );
          setItems((prev) =>
            bumpItemUpdated(prev, item.id, { current_stock: newStock }),
          );
          setSelectedItem((prev) =>
            prev?.id === item.id ? { ...prev, current_stock: newStock } : prev,
          );
          if (options?.closeDrawer) {
            closeSelection();
          }
          void fetchItems(true);
        } else {
          toast.error(result.message || 'Failed to update stock');
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setToppingUpId(null);
        setIsTopupSubmitting(false);
      }
    },
    [closeSelection, fetchItems],
  );

  const handleQuickTopup = useCallback(
    (item: Item, options?: { closeDrawer?: boolean }) => {
      const qty = computeTopup(
        item.current_stock,
        item.min_stock_level,
        item.expected_stock_level,
      );
      void applyTopup(item, qty, options);
    },
    [applyTopup],
  );

  const scopedItems = useMemo(() => {
    const list = items.filter((item) => itemMatchesShopType(item, shopType));
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.variant_name?.toLowerCase().includes(q) ?? false) ||
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

  const topupEditCtx = useMemo(
    () => ({
      editingStockId,
      editingStockValue,
      editingMinStockId,
      editingMinStockValue,
      editingExpectedStockId,
      editingExpectedStockValue,
    }),
    [
      editingStockId,
      editingStockValue,
      editingMinStockId,
      editingMinStockValue,
      editingExpectedStockId,
      editingExpectedStockValue,
    ],
  );

  useEffect(() => {
    if (
      selectedItem &&
      (!itemMatchesShopType(selectedItem, shopType) ||
        (stockFilter !== 'all' && stockStatus(selectedItem) !== stockFilter))
    ) {
      setSelectedItem(null);
      setDrawerOpen(false);
    }
  }, [shopType, stockFilter, selectedItem]);

  const handleShopTypeChange = useCallback(
    (newShopType: string) => {
      setShopType(newShopType);
      setSelectedItem(null);
      setDrawerOpen(false);
    },
    [setShopType],
  );

  const clearInlineEdits = () => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingExpectedStockId(null);
    setEditingExpectedStockValue('');
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingUnitId(null);
    setEditingUnitValue('');
  };

  const openDrawer = useCallback((item: Item) => {
    clearInlineEdits();
    setSelectedItem(item);
    setDrawerOpen(true);
  }, []);

  const startInlineStockEdit = (item: Item) => {
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingExpectedStockId(null);
    setEditingExpectedStockValue('');
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
    setEditingExpectedStockId(null);
    setEditingExpectedStockValue('');
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

  const startInlineExpectedStockEdit = (item: Item) => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingPriceId(null);
    setEditingPriceValue('');
    setEditingUnitId(null);
    setEditingUnitValue('');
    setEditingExpectedStockId(item.id);
    setEditingExpectedStockValue(
      item.expected_stock_level != null
        ? formatStockQty(item.expected_stock_level, item.unit_type)
        : '',
    );
  };

  const cancelInlineExpectedStockEdit = () => {
    setEditingExpectedStockId(null);
    setEditingExpectedStockValue('');
  };

  const startInlinePriceEdit = (item: Item) => {
    setEditingStockId(null);
    setEditingStockValue('');
    setEditingMinStockId(null);
    setEditingMinStockValue('');
    setEditingExpectedStockId(null);
    setEditingExpectedStockValue('');
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
    setEditingExpectedStockId(null);
    setEditingExpectedStockValue('');
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
        setItems((prev) =>
          bumpItemUpdated(prev, item.id, { current_stock: target }),
        );
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
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, min_stock_level: parsed } : i,
          ),
        );
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

  const saveInlineExpectedStock = async (item: Item) => {
    const trimmed = editingExpectedStockValue.trim();
    const isDiscrete = isDiscreteUnitType(item.unit_type);
    const parsed =
      trimmed === ''
        ? null
        : isDiscrete
          ? parseInt(trimmed, 10)
          : parseFloat(trimmed);

    if (trimmed !== '' && (parsed == null || isNaN(parsed) || parsed < 0)) {
      toast.error('Enter a valid expected stock level');
      return;
    }

    if (trimmed === '' && item.expected_stock_level == null) {
      cancelInlineExpectedStockEdit();
      return;
    }

    if (parsed !== null && item.expected_stock_level === parsed) {
      cancelInlineExpectedStockEdit();
      return;
    }

    setSavingExpectedStockId(item.id);
    setEditingExpectedStockId(null);
    try {
      const result = await apiPatch(`/api/items/${item.id}/expected-stock`, {
        expectedStockLevel: parsed,
      });

      if (result.success) {
        toast.success('Expected stock updated');
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, expected_stock_level: parsed } : i,
          ),
        );
        void fetchItems(true);
      } else {
        toast.error(result.message || 'Failed to update expected stock');
        setEditingExpectedStockId(item.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setEditingExpectedStockId(item.id);
    } finally {
      setSavingExpectedStockId(null);
      if (!editingExpectedStockId) setEditingExpectedStockValue('');
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

  const handleDelete = async (item: Item) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This removes it from the catalog.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const result = await apiDelete(`/api/items/${item.id}`);
      if (result.success) {
        toast.success('Product deleted');
        if (selectedItem?.id === item.id) {
          closeSelection();
        }
        void fetchItems(true);
      } else {
        toast.error(result.message || 'Failed to delete product');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedTopup = selectedItem
    ? computeTopup(
        selectedItem.current_stock,
        selectedItem.min_stock_level,
        selectedItem.expected_stock_level,
      )
    : 0;

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
                    <th className="px-1 py-1.5 w-[4%] text-center">#</th>
                    <th className="px-1 py-1.5 w-[22%]">Product</th>
                    <th className="px-1 py-1.5 w-[7%]">Unit</th>
                    <th className="px-1 py-1.5 w-[8%] text-right">Price</th>
                    <th className="px-1 py-1.5 w-[8%] text-right">Stock</th>
                    <th className="px-1 py-1.5 w-[8%] text-right">Min</th>
                    <th className="px-1 py-1.5 w-[9%] text-right">Expected</th>
                    <th className="px-1 py-1.5 w-[8%] text-right">Topup</th>
                    <th className="px-1 py-1.5 w-[6%]">St</th>
                    <th className="px-1 py-1.5 w-[6%] text-right" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => {
                    const status = stockStatus(item);
                    const selected = selectedItem?.id === item.id;
                    const topup = getLiveTopup(item, topupEditCtx);
                    const needsTopup = topup > 0;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-slate-100 dark:border-slate-800/80 transition-colors ${
                          needsTopup
                            ? 'bg-amber-50/90 dark:bg-amber-950/25 ring-1 ring-inset ring-amber-300/50 dark:ring-amber-600/40'
                            : selected
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
                            {displayItemName(item)}
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
                            <td className="px-1 py-1.5 text-right min-w-0 align-top">
                              <InlineEditableCell
                                displayValue={formatExpectedStock(item)}
                                isEditing={editingExpectedStockId === item.id}
                                value={
                                  editingExpectedStockId === item.id
                                    ? editingExpectedStockValue
                                    : ''
                                }
                                isSaving={savingExpectedStockId === item.id}
                                unitType={item.unit_type}
                                allowEmpty
                                onStartEdit={() => startInlineExpectedStockEdit(item)}
                                onChange={setEditingExpectedStockValue}
                                onSave={() => void saveInlineExpectedStock(item)}
                                onCancel={cancelInlineExpectedStockEdit}
                              />
                            </td>
                            <td className="px-1 py-1.5 text-right min-w-0 align-top">
                              <TopupButton
                                topup={topup}
                                unitType={item.unit_type}
                                isLoading={toppingUpId === item.id}
                                onTopup={() => handleQuickTopup(item)}
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
                  Stock update
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
          {selectedItem && (
            <DepartmentStockSimpleForm
              selectedItem={selectedItem}
              topup={selectedTopup}
              isSubmitting={isTopupSubmitting}
              onTopup={() => handleQuickTopup(selectedItem, { closeDrawer: true })}
              onClose={closeSelection}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
