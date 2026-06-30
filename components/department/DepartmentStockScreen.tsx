'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpCircle,
  Check,
  FileDown,
  Loader2,
  Package,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
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
import { DepartmentFloorStockLockNotice } from '@/components/department/DepartmentFloorStockLockNotice';
import { PosDepartmentRail } from '@/components/pos/PosDepartmentRail';
import { apiDelete, apiPatch, apiPost } from '@/lib/utils/api-client';
import { itemMatchesShopType } from '@/lib/utils/shop-type';
import type { Item } from '@/lib/db/types';
import { DepartmentStockAdjustForm } from '@/components/department/DepartmentStockAdjustForm';
import { formatSellableItemName } from '@/lib/utils/group-items-by-parent';
import { computeTopup, formatTopupDisplay } from '@/lib/utils/inventory-topup';
import {
  formatDateTime,
  formatShortDateTime,
  isWithinLastWeek,
} from '@/lib/utils/format-relative-time';
import type { AdjustmentReason } from '@/lib/constants';
import { isDiscreteUnitType, UNIT_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import { downloadStockReorderListPdf } from '@/lib/pdf/stock-reorder-list';
import type { StockReorderListRow } from '@/lib/department/stock-reorder-list';

type StockListItem = Item & { parent_name?: string | null; last_updated_at?: number };

function sortByDisplayName(items: StockListItem[]): StockListItem[] {
  return [...items].sort((a, b) =>
    displayItemName(a).localeCompare(displayItemName(b), undefined, {
      sensitivity: 'base',
    }),
  );
}

function getLastUpdatedAt(item: StockListItem): number {
  return item.last_updated_at ?? item.created_at;
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

function displayItemName(item: StockListItem): string {
  return formatSellableItemName(item);
}

function bumpItemUpdated(
  items: StockListItem[],
  itemId: string,
  patch: Partial<StockListItem>,
): StockListItem[] {
  const now = Math.floor(Date.now() / 1000);
  return sortByDisplayName(
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

type StockFilterKey = 'all' | 'recent' | 'out' | 'low' | 'ok';

const STOCK_FILTER_TABS: { key: StockFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Out' },
  { key: 'low', label: 'Low' },
  { key: 'ok', label: 'OK' },
  { key: 'recent', label: 'Recent' },
];

function formatPrice(price: number) {
  return price.toFixed(0);
}

function StockStatusBadge({ status }: { status: 'out' | 'low' | 'ok' }) {
  if (status === 'out') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300">
        Out
      </span>
    );
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      OK
    </span>
  );
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

interface TopupButtonProps {
  topup: number;
  unitType: Item['unit_type'];
  isLoading?: boolean;
  readOnly?: boolean;
  onTopup: () => void;
}

function TopupButton({
  topup,
  unitType,
  isLoading,
  readOnly,
  onTopup,
}: TopupButtonProps) {
  if (topup <= 0) {
    return <span className="text-slate-400 tabular-nums text-xs">—</span>;
  }

  const label = formatTopupDisplay(topup, (v) => formatStockQty(v, unitType));

  if (readOnly) {
    return (
      <span className="text-amber-700/80 dark:text-amber-300/80 tabular-nums text-[10px] font-semibold">
        +{label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onTopup();
      }}
      disabled={isLoading}
      className="inline-flex items-center justify-end gap-0.5 w-full min-h-7 px-1 rounded-md text-amber-800 dark:text-amber-200 font-bold tabular-nums text-[10px] bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 border border-amber-300/60 disabled:opacity-60"
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
  readOnly?: boolean;
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
  readOnly = false,
}: InlineEditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isSaving) {
    return <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e] ml-auto" />;
  }

  if (readOnly) {
    return (
      <span
        className={`block w-full text-right text-xs font-semibold tabular-nums ${
          displayValue === '—'
            ? 'text-slate-400'
            : 'text-slate-900 dark:text-white'
        }`}
      >
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-[4rem]" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          step={valueKind === 'price' ? '1' : isDiscreteUnitType(unitType) ? '1' : '0.01'}
          min={valueKind === 'price' ? '1' : '0'}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (valueKind === 'price') {
              if (next === '' || /^\d*\.?\d*$/.test(next)) onChange(next);
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
          className="h-7 w-full text-right text-xs font-semibold tabular-nums px-1.5"
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
      className={`w-full text-right text-xs font-semibold tabular-nums hover:text-[#1c6a1e] hover:underline ${
        displayValue === '—'
          ? 'text-slate-400'
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
  readOnly?: boolean;
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
  readOnly = false,
}: InlineUnitCellProps) {
  if (isSaving) {
    return <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e]" />;
  }

  if (readOnly) {
    return (
      <span className="text-[10px] font-semibold uppercase text-slate-500">
        {unitType}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-[4.5rem]" onClick={(e) => e.stopPropagation()}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] text-[10px] font-semibold uppercase px-1"
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
      className="text-[10px] font-semibold uppercase text-slate-500 hover:text-[#1c6a1e] hover:underline"
    >
      {unitType}
    </button>
  );
}

export function DepartmentStockScreen() {
  const { assignedTypes, shopType, setShopType, canEditFloorStock, businessName } =
    useDepartmentApp();

  const [items, setItems] = useState<StockListItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilterKey>('all');
  const [selectedItem, setSelectedItem] = useState<StockListItem | null>(null);
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
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);
  const [toppingUpId, setToppingUpId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reorderPdfLoading, setReorderPdfLoading] = useState(false);

  const canEditStock = canEditFloorStock;

  const fetchItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingItems(true);
      else setRefreshing(true);
      const params = new URLSearchParams({
        all: 'true',
        sellableOnly: 'true',
      });
      if (assignedTypes.length > 0) {
        params.set('itemTypes', assignedTypes.join(','));
      }
      const res = await fetch(`/api/items?${params}`);
      const result = await res.json();
      if (result.success) {
        setItems(sortByDisplayName(result.data));
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
    (item: StockListItem, options?: { closeDrawer?: boolean }) => {
      const qty = computeTopup(
        item.current_stock,
        item.min_stock_level,
        item.expected_stock_level,
      );
      void applyTopup(item, qty, options);
    },
    [applyTopup],
  );

  const handleStockAdjust = useCallback(
    async (
      item: StockListItem,
      params: {
        adjustmentType: 'increase' | 'decrease';
        quantity: number;
        reason: AdjustmentReason;
        notes: string | null;
      },
    ) => {
      setIsAdjustSubmitting(true);
      try {
        const result = await apiPost('/api/stock/adjust', {
          itemId: item.id,
          ...params,
        });

        if (result.success) {
          const newStock =
            params.adjustmentType === 'increase'
              ? item.current_stock + params.quantity
              : item.current_stock - params.quantity;
          toast.success('Stock updated');
          setItems((prev) =>
            bumpItemUpdated(prev, item.id, { current_stock: newStock }),
          );
          setSelectedItem((prev) =>
            prev?.id === item.id ? { ...prev, current_stock: newStock } : prev,
          );
          void fetchItems(true);
          return true;
        }

        toast.error(result.message || 'Failed to update stock');
        return false;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'An error occurred');
        return false;
      } finally {
        setIsAdjustSubmitting(false);
      }
    },
    [fetchItems],
  );

  const scopedItems = useMemo(() => {
    const list = items.filter((item) => itemMatchesShopType(item, shopType));
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.variant_name?.toLowerCase().includes(q) ?? false) ||
            (item.parent_name?.toLowerCase().includes(q) ?? false) ||
            displayItemName(item).toLowerCase().includes(q) ||
            item.unit_type.toLowerCase().includes(q),
        )
      : list;
    return sortByDisplayName(filtered);
  }, [items, searchQuery, shopType]);

  const statusCounts = useMemo(
    () => ({
      all: scopedItems.length,
      recent: scopedItems.filter((i) => isWithinLastWeek(getLastUpdatedAt(i))).length,
      out: scopedItems.filter((i) => stockStatus(i) === 'out').length,
      low: scopedItems.filter((i) => stockStatus(i) === 'low').length,
      ok: scopedItems.filter((i) => stockStatus(i) === 'ok').length,
    }),
    [scopedItems],
  );

  const filteredItems = useMemo(() => {
    if (stockFilter === 'recent') {
      return scopedItems.filter((item) => isWithinLastWeek(getLastUpdatedAt(item)));
    }
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
    if (!selectedItem) return;

    const outOfScope =
      !itemMatchesShopType(selectedItem, shopType) ||
      (stockFilter === 'recent' &&
        !isWithinLastWeek(getLastUpdatedAt(selectedItem))) ||
      (stockFilter !== 'all' &&
        stockFilter !== 'recent' &&
        stockStatus(selectedItem) !== stockFilter);

    if (outOfScope) {
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

  const openDrawer = useCallback((item: StockListItem) => {
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
      `Delete "${displayItemName(item)}"? This removes it from the catalog.`,
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

  const handleDownloadReorderPdf = useCallback(async () => {
    setReorderPdfLoading(true);
    try {
      const params = new URLSearchParams({ shopType });
      if (assignedTypes.length > 0) {
        params.set('itemTypes', assignedTypes.join(','));
      }
      const res = await fetch(`/api/department/stock/reorder-list?${params}`);
      const result = await res.json();
      if (!result.success) {
        toast.error(result.message || 'Failed to build order list');
        return;
      }

      const data = result.data as {
        rows: StockReorderListRow[];
        periodLabel: string;
        businessName?: string;
      };

      if (data.rows.length === 0) {
        toast.info('No low/out products sold in the past week for this filter');
      }

      const datePart = new Date().toISOString().slice(0, 10);
      await downloadStockReorderListPdf({
        rows: data.rows,
        periodLabel: data.periodLabel,
        businessName: data.businessName ?? businessName,
        departmentLabel: shopType !== 'all' ? shopType : undefined,
        saveFileName: `stock-reorder-${datePart}.pdf`,
      });
      toast.success('Order list PDF downloaded');
    } catch {
      toast.error('Could not create order list PDF');
    } finally {
      setReorderPdfLoading(false);
    }
  }, [assignedTypes, shopType, businessName]);

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden bg-[#f6f8f6] dark:bg-[#0f1a0d] text-[#101b0d] dark:text-[#f0fdf4]">
      <header className="shrink-0 safe-area-top border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a2c17] shadow-sm">
        <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1c6a1e]/10 text-[#1c6a1e]">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Stock
              </h1>
              {!loadingItems && (
                <p className="text-xs text-slate-500 tabular-nums">
                  {filteredItems.length} product{filteredItems.length === 1 ? '' : 's'}
                  {statusCounts.out > 0 && (
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                      {' '}
                      · {statusCounts.out} out
                    </span>
                  )}
                  {statusCounts.low > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {' '}
                      · {statusCounts.low} low
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void handleDownloadReorderPdf()}
              disabled={reorderPdfLoading || loadingItems}
              className="flex h-9 items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold text-[#1c6a1e] bg-[#1c6a1e]/10 hover:bg-[#1c6a1e]/15 disabled:opacity-50"
              title="Download PDF order list for low/out items sold this week"
            >
              {reorderPdfLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Order PDF</span>
            </button>
            <button
              type="button"
              onClick={() => void fetchItems(true)}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              aria-label="Refresh stock"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2 space-y-2">
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              className="pl-9 pr-9 h-10 text-sm w-full min-w-0 bg-slate-50 dark:bg-[#132210] border-slate-200 dark:border-slate-700 rounded-xl"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <PosDepartmentRail
            layout="chips"
            allowedTypes={assignedTypes}
            onShopTypeChange={handleShopTypeChange}
          />

          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl overflow-x-auto no-scrollbar">
            {STOCK_FILTER_TABS.map((tab) => {
              const active = stockFilter === tab.key;
              const count = statusCounts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStockFilter(tab.key)}
                  className={`flex-1 min-w-[3.25rem] inline-flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors touch-manipulation ${
                    active
                      ? tab.key === 'out'
                        ? 'bg-red-600 text-white shadow-sm'
                        : tab.key === 'low'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : tab.key === 'ok'
                            ? 'bg-[#1c6a1e] text-white shadow-sm'
                            : tab.key === 'recent'
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'bg-white dark:bg-[#1c2e18] text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`tabular-nums text-[10px] px-1.5 py-px rounded-full ${
                      active
                        ? 'bg-white/20'
                        : 'bg-white/80 dark:bg-slate-800 text-slate-500'
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
        <div className="shrink-0 mx-3 mt-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          No product types assigned. Ask an admin to set your departments.
        </div>
      )}

      {!canEditStock && (
        <DepartmentFloorStockLockNotice
          variant="stock"
          className="shrink-0 mx-3 mt-2"
        />
      )}

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
        {loadingItems ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-[#1c6a1e]" />
            Loading inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3">
              <Package className="w-7 h-7 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {scopedItems.length === 0
                ? searchQuery.trim()
                  ? `No products match "${searchQuery.trim()}"`
                  : 'No items found'
                : stockFilter === 'recent'
                  ? 'No products updated in the last week'
                  : searchQuery.trim()
                    ? `No products match "${searchQuery.trim()}" with this filter`
                    : 'No items match this filter'}
            </p>
            {searchQuery.trim() && scopedItems.length === 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 text-sm font-semibold text-[#1c6a1e] hover:underline"
              >
                Clear search
              </button>
            )}
            {!searchQuery.trim() && stockFilter !== 'all' && scopedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className="mt-3 text-sm font-semibold text-[#1c6a1e] hover:underline"
              >
                Show all ({scopedItems.length})
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1a2c17] border-b border-slate-200 dark:border-slate-700 shadow-sm">
                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 w-8 text-center">#</th>
                  <th className="px-2 py-2 min-w-[140px]">Product</th>
                  <th className="px-2 py-2 w-14">Unit</th>
                  <th className="px-2 py-2 w-16 text-right">Price</th>
                  <th className="px-2 py-2 w-16 text-right">Stock</th>
                  <th className="px-2 py-2 w-14 text-right">Min</th>
                  <th className="px-2 py-2 w-16 text-right">Expected</th>
                  <th className="px-2 py-2 w-20 text-right">Top up</th>
                  <th className="px-2 py-2 w-12">Status</th>
                  <th className="px-2 py-2 w-16 text-right" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item, index) => {
                  const status = stockStatus(item);
                  const selected = selectedItem?.id === item.id;
                  const topup = getLiveTopup(item, topupEditCtx);
                  const needsTopup = topup > 0;
                  const lastUpdated = getLastUpdatedAt(item);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        needsTopup
                          ? 'bg-amber-50/80 dark:bg-amber-950/20'
                          : selected
                            ? 'bg-[#1c6a1e]/8 dark:bg-[#1c6a1e]/15'
                            : index % 2 === 0
                              ? 'bg-white dark:bg-[#132210]'
                              : 'bg-slate-50/60 dark:bg-[#161f14]'
                      }`}
                    >
                      <td className="px-2 py-2 text-center text-slate-400 tabular-nums align-top">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2 font-medium min-w-0 align-top">
                        <button
                          type="button"
                          onClick={() => openDrawer(item)}
                          className="text-left w-full hover:text-[#1c6a1e]"
                        >
                          <span className="block text-xs leading-snug">
                            {displayItemName(item)}
                          </span>
                          <span
                            className="block mt-0.5 text-[10px] font-normal text-slate-400 tabular-nums"
                            title={formatDateTime(lastUpdated)}
                          >
                            {formatShortDateTime(lastUpdated)}
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <InlineUnitCell
                          unitType={item.unit_type}
                          isEditing={editingUnitId === item.id}
                          value={editingUnitId === item.id ? editingUnitValue : item.unit_type}
                          isSaving={savingUnitId === item.id}
                          readOnly={!canEditStock}
                          onStartEdit={() => startInlineUnitEdit(item)}
                          onChange={setEditingUnitValue}
                          onSave={() => void saveInlineUnit(item)}
                          onCancel={cancelInlineUnitEdit}
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <InlineEditableCell
                          displayValue={formatPrice(item.current_sell_price)}
                          isEditing={editingPriceId === item.id}
                          value={editingPriceId === item.id ? editingPriceValue : ''}
                          isSaving={savingPriceId === item.id}
                          valueKind="price"
                          readOnly={!canEditStock}
                          onStartEdit={() => startInlinePriceEdit(item)}
                          onChange={setEditingPriceValue}
                          onSave={() => void saveInlinePrice(item)}
                          onCancel={cancelInlinePriceEdit}
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <InlineEditableCell
                          displayValue={formatStockQty(item.current_stock, item.unit_type)}
                          isEditing={editingStockId === item.id}
                          value={editingStockId === item.id ? editingStockValue : ''}
                          isSaving={savingStockId === item.id}
                          unitType={item.unit_type}
                          readOnly={!canEditStock}
                          onStartEdit={() => startInlineStockEdit(item)}
                          onChange={setEditingStockValue}
                          onSave={() => void saveInlineStock(item)}
                          onCancel={cancelInlineStockEdit}
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <InlineEditableCell
                          displayValue={formatMinStock(item)}
                          isEditing={editingMinStockId === item.id}
                          value={editingMinStockId === item.id ? editingMinStockValue : ''}
                          isSaving={savingMinStockId === item.id}
                          unitType={item.unit_type}
                          allowEmpty
                          readOnly={!canEditStock}
                          onStartEdit={() => startInlineMinStockEdit(item)}
                          onChange={setEditingMinStockValue}
                          onSave={() => void saveInlineMinStock(item)}
                          onCancel={cancelInlineMinStockEdit}
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
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
                          readOnly={!canEditStock}
                          onStartEdit={() => startInlineExpectedStockEdit(item)}
                          onChange={setEditingExpectedStockValue}
                          onSave={() => void saveInlineExpectedStock(item)}
                          onCancel={cancelInlineExpectedStockEdit}
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <TopupButton
                          topup={topup}
                          unitType={item.unit_type}
                          isLoading={toppingUpId === item.id}
                          readOnly={!canEditStock}
                          onTopup={() => handleQuickTopup(item)}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <StockStatusBadge status={status} />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(item);
                            }}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${
                              canEditStock
                                ? 'text-[#1c6a1e] hover:bg-[#1c6a1e]/10'
                                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                            }`}
                            title={canEditStock ? 'Adjust stock' : 'Record loss'}
                            aria-label={
                              canEditStock
                                ? `Adjust stock for ${displayItemName(item)}`
                                : `Record loss for ${displayItemName(item)}`
                            }
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                          {canEditStock && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(item);
                              }}
                              disabled={isDeleting}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                              title="Delete product"
                              aria-label={`Delete ${displayItemName(item)}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => !open && closeSelection()}
        direction="right"
      >
        <DrawerContent className="!w-full sm:!w-[420px] md:!w-[440px] !max-w-none h-full max-h-[100dvh] flex flex-col bg-white dark:bg-[#1c2e18] border-l border-slate-200 dark:border-slate-800 shadow-2xl [&>div:first-child]:hidden">
          <DrawerHeader className="shrink-0 border-b border-slate-100 dark:border-slate-800 text-left py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {canEditStock ? 'Stock adjust' : 'Record loss'}
                </p>
                <DrawerTitle className="text-base font-bold truncate pr-2">
                  {selectedItem ? displayItemName(selectedItem) : 'Stock'}
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
            <DepartmentStockAdjustForm
              selectedItem={selectedItem}
              topup={selectedTopup}
              lastUpdatedAt={getLastUpdatedAt(selectedItem)}
              isSubmitting={isTopupSubmitting || isAdjustSubmitting}
              lossWriteOffOnly={!canEditStock}
              onTopup={() => handleQuickTopup(selectedItem, { closeDrawer: true })}
              onAdjust={(params) => handleStockAdjust(selectedItem, params)}
              onClose={closeSelection}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
