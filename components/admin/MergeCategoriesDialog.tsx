'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Combine } from 'lucide-react';
import type { CategoryWithCount } from '@/components/admin/CategoryList';
import { apiPost } from '@/lib/utils/api-client';
import { toast } from 'sonner';

interface MergeCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryWithCount[];
  onSuccess: () => void;
}

export function MergeCategoriesDialog({
  open,
  onOpenChange,
  categories,
  onSuccess,
}: MergeCategoriesDialogProps) {
  const [fromIds, setFromIds] = useState<Set<string>>(new Set());
  const [intoId, setIntoId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const activeTargets = useMemo(() => sorted.filter((c) => c.active === 1), [sorted]);

  const intoCat = sorted.find((c) => c.id === intoId);

  const fromList = useMemo(() => sorted.filter((c) => fromIds.has(c.id)), [sorted, fromIds]);

  const totalProductsInSources = useMemo(
    () => fromList.reduce((sum, c) => sum + (c.item_count ?? 0), 0),
    [fromList]
  );

  const toggleFrom = useCallback((id: string) => {
    setFromIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllSources = useCallback(() => {
    setFromIds(new Set(sorted.map((c) => c.id)));
  }, [sorted]);

  const clearSources = useCallback(() => {
    setFromIds(new Set());
  }, []);

  useEffect(() => {
    if (!open) {
      setFromIds(new Set());
      setIntoId('');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (intoId && fromIds.has(intoId)) {
      setIntoId('');
    }
  }, [fromIds, intoId]);

  const intoOptions = useMemo(
    () => activeTargets.filter((c) => !fromIds.has(c.id)),
    [activeTargets, fromIds]
  );

  useEffect(() => {
    if (intoId && !intoOptions.some((c) => c.id === intoId)) {
      setIntoId('');
    }
  }, [intoId, intoOptions]);

  const handleMerge = async () => {
    const ids = [...fromIds];
    if (ids.length === 0) {
      toast.error('Select at least one category to merge away');
      return;
    }
    if (!intoId) {
      toast.error('Choose the category to keep (target)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiPost<{
        itemsMoved: number;
        categoriesClosed: number;
        mergedFromNames: string[];
        intoCategoryName: string;
      }>('/api/categories/merge', {
        fromCategoryIds: ids,
        intoCategoryId: intoId,
      });
      if (result.success) {
        toast.success(result.message || 'Categories merged');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.message || 'Merge failed');
      }
    } catch {
      toast.error('Merge failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fromCount = fromIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-none border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Combine className="h-5 w-5 text-[#1c6a1e]" />
            Merge categories
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            Tick every category you want to close. All products in those categories move into the target
            category you pick below. Each merged-away category is then deactivated (same as delete).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 overflow-y-auto min-h-0 flex-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Categories to merge away (sources)</Label>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-none"
                  onClick={selectAllSources}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs rounded-none"
                  onClick={clearSources}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-none max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e]"
                    checked={fromIds.has(c.id)}
                    onChange={() => toggleFrom(c.id)}
                  />
                  <span className="flex-1 min-w-0 text-sm">
                    <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">
                      {(c.item_count ?? 0)} product{(c.item_count ?? 0) === 1 ? '' : 's'}
                      {c.active === 0 ? ' · inactive' : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-into">Move all products into (target)</Label>
            <Select value={intoId} onValueChange={setIntoId}>
              <SelectTrigger id="merge-into" className="rounded-none">
                <SelectValue placeholder="Select active category…" />
              </SelectTrigger>
              <SelectContent>
                {intoOptions.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    No active category available. Uncheck sources or activate a category first.
                  </div>
                ) : (
                  intoOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {(c.item_count ?? 0) > 0 ? ` (${c.item_count} products)` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {fromCount > 0 && intoId && intoCat && (
            <p className="text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-none">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{fromCount}</span>{' '}
              categor{fromCount === 1 ? 'y' : 'ies'} with{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalProductsInSources}</span>{' '}
              product{totalProductsInSources === 1 ? '' : 's'} will move into{' '}
              <span className="font-medium">{intoCat.name}</span>. Those {fromCount} categories will be deactivated.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 shrink-0 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button type="button" variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-none bg-[#1c6a1e] hover:bg-[#166534] text-white"
            disabled={fromCount === 0 || !intoId || submitting}
            onClick={handleMerge}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging…
              </>
            ) : (
              `Merge${fromCount > 0 ? ` (${fromCount})` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
