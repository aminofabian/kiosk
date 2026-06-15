'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Layers, Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/utils/api-client';
import { toast } from 'sonner';

interface ReconcileResult {
  itemId: string;
  batchSumBefore: number;
  itemStock: number;
  difference: number;
}

interface ReconcileBatchesButtonProps {
  className?: string;
  size?: 'sm' | 'default';
  variant?: 'ghost' | 'outline' | 'default';
  showLabel?: boolean;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReconcileBatchesButton({
  className,
  size = 'sm',
  variant = 'ghost',
  showLabel = true,
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
}: ReconcileBatchesButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReconcileResult[] | null>(null);

  const handleReconcile = async () => {
    setLoading(true);
    setResults(null);
    try {
      const res = await apiPost<{
        reconciled: number;
        items: ReconcileResult[];
      }>('/api/stock/reconcile-batches', {});

      if (!res.success) {
        toast.error(res.message || 'Failed to reconcile batches');
        return;
      }

      const items = res.data?.items ?? [];
      setResults(items);

      if (items.length === 0) {
        toast.success('All batch totals already match item stock');
        setOpen(false);
        return;
      }

      toast.success(`Reconciled ${items.length} item(s)`);
    } catch {
      toast.error('Failed to reconcile batches');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!loading) {
      setOpen(next);
      if (!next) setResults(null);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          size={size}
          variant={variant}
          className={className}
          onClick={() => setOpen(true)}
        >
          <Layers className="w-4 h-4" />
          {showLabel && <span className="ml-1.5 text-xs">Reconcile batches</span>}
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reconcile batch stock</DialogTitle>
            <DialogDescription>
              Aligns batch quantities with each item&apos;s on-hand total. Use this once if batch
              chips showed more stock than the item total (e.g. 121 in batches vs 81 on hand).
              Sales already use automatic FIFO going forward.
            </DialogDescription>
          </DialogHeader>

          {results && results.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {results.map((row) => (
                <div key={row.itemId} className="px-3 py-2 flex justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500 truncate">{row.itemId.slice(0, 8)}…</span>
                  <span className="text-slate-700 dark:text-slate-300 shrink-0">
                    {row.batchSumBefore.toFixed(0)} → {row.itemStock.toFixed(0)}
                    <span className="text-slate-400 ml-1">
                      ({row.difference > 0 ? '+' : ''}
                      {row.difference.toFixed(0)})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => handleOpenChange(false)}
            >
              {results ? 'Close' : 'Cancel'}
            </Button>
            {!results && (
              <Button
                type="button"
                className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                disabled={loading}
                onClick={handleReconcile}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Reconciling…
                  </>
                ) : (
                  'Run reconciliation'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
