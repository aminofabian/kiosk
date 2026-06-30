'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  CheckCircle2,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Item } from '@/lib/db/types';
import type { AdjustmentReason } from '@/lib/constants';
import { isDiscreteUnitType } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils/format-relative-time';
import { formatTopupDisplay } from '@/lib/utils/inventory-topup';

const INCREASE_REASONS: { key: AdjustmentReason; label: string }[] = [
  { key: 'restock', label: 'Restock' },
  { key: 'counting_error', label: 'Count fix' },
  { key: 'other', label: 'Other' },
];

const DECREASE_REASONS: { key: AdjustmentReason; label: string }[] = [
  { key: 'spoilage', label: 'Spoilage' },
  { key: 'damage', label: 'Damage' },
  { key: 'theft', label: 'Theft' },
  { key: 'counting_error', label: 'Count fix' },
  { key: 'other', label: 'Other' },
];

const LOSS_WRITE_OFF_REASONS = DECREASE_REASONS.filter(
  (r) => r.key !== 'counting_error',
);

function formatStockQty(stock: number, unitType: Item['unit_type']) {
  return isDiscreteUnitType(unitType)
    ? Math.round(stock).toString()
    : stock.toFixed(2);
}

interface DepartmentStockAdjustFormProps {
  selectedItem: Item;
  topup: number;
  lastUpdatedAt?: number;
  isSubmitting: boolean;
  onTopup: () => void;
  onAdjust: (params: {
    adjustmentType: 'increase' | 'decrease';
    quantity: number;
    reason: AdjustmentReason;
    notes: string | null;
  }) => Promise<boolean>;
  onClose: () => void;
  /** When true, only decrease for spoilage/damage/theft/other (count-first mode). */
  lossWriteOffOnly?: boolean;
}

export function DepartmentStockAdjustForm({
  selectedItem,
  topup,
  lastUpdatedAt,
  isSubmitting,
  onTopup,
  onAdjust,
  onClose,
  lossWriteOffOnly = false,
}: DepartmentStockAdjustFormProps) {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('decrease');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<AdjustmentReason>('spoilage');
  const [notes, setNotes] = useState('');

  const effectiveType = lossWriteOffOnly ? 'decrease' : adjustmentType;
  const reasonOptions =
    effectiveType === 'increase' ? INCREASE_REASONS : LOSS_WRITE_OFF_REASONS;

  useEffect(() => {
    if (lossWriteOffOnly) {
      setAdjustmentType('decrease');
      setReason('spoilage');
    } else {
      setReason(adjustmentType === 'increase' ? 'restock' : 'spoilage');
    }
    setQuantity('');
    setNotes('');
  }, [adjustmentType, lossWriteOffOnly, selectedItem.id]);

  const parsedQty = useMemo(() => {
    const trimmed = quantity.trim();
    if (!trimmed) return null;
    const isDiscrete = isDiscreteUnitType(selectedItem.unit_type);
    const parsed = isDiscrete ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (isNaN(parsed) || parsed <= 0) return null;
    return parsed;
  }, [quantity, selectedItem.unit_type]);

  const newStock = useMemo(() => {
    if (parsedQty == null) return null;
    return effectiveType === 'increase'
      ? selectedItem.current_stock + parsedQty
      : selectedItem.current_stock - parsedQty;
  }, [effectiveType, parsedQty, selectedItem.current_stock]);

  const willGoNegative = newStock != null && newStock < 0;
  const needsTopup = topup > 0;
  const target = selectedItem.expected_stock_level;
  const updatedLabel = lastUpdatedAt
    ? formatDateTime(lastUpdatedAt)
    : formatDateTime(selectedItem.created_at);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedQty == null) return;
    if (willGoNegative) return;
    await onAdjust({
      adjustmentType: effectiveType,
      quantity: parsedQty,
      reason,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700">
            Last updated {updatedLabel}
          </p>
        </div>

        {!lossWriteOffOnly && needsTopup && (
          <div className="space-y-2">
            <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
              Below minimum — quick add{' '}
              <strong className="tabular-nums">
                {formatStockQty(topup, selectedItem.unit_type)}
              </strong>
            </p>
            <Button
              type="button"
              onClick={onTopup}
              disabled={isSubmitting}
              className="w-full h-12 text-base font-bold bg-[#1c6a1e] hover:bg-[#165a19]"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="mr-2 h-4 w-4" />
              )}
              Top up +{formatTopupDisplay(topup, (v) => formatStockQty(v, selectedItem.unit_type))}
            </Button>
          </div>
        )}

        {(lossWriteOffOnly || !needsTopup) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {lossWriteOffOnly
              ? 'Record spoilage, damage, or theft below — qty increases need admin or daily count.'
              : 'Stock level OK — use adjust below for spoilage, damage, etc.'}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {lossWriteOffOnly ? 'Record loss' : 'Stock adjustment'}
          </p>

          {!lossWriteOffOnly && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('increase')}
                className={`flex items-center justify-center gap-1.5 h-10 rounded-lg border text-xs font-semibold ${
                  adjustmentType === 'increase'
                    ? 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Increase
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('decrease')}
                className={`flex items-center justify-center gap-1.5 h-10 rounded-lg border text-xs font-semibold ${
                  adjustmentType === 'decrease'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Decrease
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-slate-500">
              Quantity ({selectedItem.unit_type})
            </Label>
            <Input
              type="number"
              min="0"
              step={isDiscreteUnitType(selectedItem.unit_type) ? '1' : '0.01'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-10"
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-slate-500">Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {reasonOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setReason(option.key)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                    reason === option.key
                      ? effectiveType === 'decrease'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-slate-500">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              placeholder="Optional details..."
            />
          </div>

          {parsedQty != null && newStock != null && (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${
                willGoNegative
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : 'bg-slate-50 text-slate-600 dark:bg-slate-900/50 dark:text-slate-300'
              }`}
            >
              {willGoNegative ? (
                'Not enough stock for this decrease'
              ) : (
                <>
                  New stock:{' '}
                  <strong className="tabular-nums">
                    {formatStockQty(newStock, selectedItem.unit_type)} {selectedItem.unit_type}
                  </strong>
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || parsedQty == null || willGoNegative}
            className={`w-full h-11 font-semibold ${
              effectiveType === 'decrease'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#1c6a1e] hover:bg-[#165a19]'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : effectiveType === 'decrease' ? (
              'Record decrease'
            ) : (
              'Record increase'
            )}
          </Button>
        </form>
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-[#1c2e18] safe-area-bottom">
        <Button type="button" variant="outline" onClick={onClose} className="w-full h-11">
          Close
        </Button>
      </div>
    </div>
  );
}
