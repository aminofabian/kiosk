'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clearRecentSearches } from '@/lib/utils/recent-searches';

interface PosClearCacheButtonProps {
  disabled?: boolean;
  /** compact = icon only; labeled = icon + text (mobile header) */
  variant?: 'compact' | 'labeled';
  className?: string;
}

export function PosClearCacheButton({
  disabled = false,
  variant = 'compact',
  className = '',
}: PosClearCacheButtonProps) {
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleConfirm = () => {
    setClearing(true);
    clearRecentSearches();
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Clear cache and reload"
        disabled={disabled || clearing}
        onClick={() => setOpen(true)}
        className={
          variant === 'labeled'
            ? `pos-icon-btn disabled:opacity-40 flex items-center gap-1.5 px-2.5 ${className}`
            : `pos-icon-btn disabled:opacity-40 ${className}`
        }
        title="Clear cache and reload (use only if products look wrong)"
      >
        <Trash2
          className={`w-4 h-4 text-amber-600 dark:text-amber-500 ${clearing ? 'animate-pulse' : ''}`}
        />
        {variant === 'labeled' && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-500">
            Clear cache
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear cache and reload?</DialogTitle>
            <DialogDescription>
              This reloads the POS and clears local search history. Your cart may be lost. Only use
              if product data looks stale or broken.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm}>
              Clear &amp; reload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
