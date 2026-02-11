'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/utils/api-client';

interface OutOfStockRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OutOfStockRequestModal({
  open,
  onOpenChange,
  onSuccess,
}: OutOfStockRequestModalProps) {
  const [itemName, setItemName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = itemName.trim();
    if (!trimmed) {
      setError('Please enter item name');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await apiPost<{ success: boolean; message?: string }>(
      '/api/out-of-stock-requests',
      { item_name: trimmed, notes: notes.trim() || undefined }
    );

    setSubmitting(false);

    if (result.success) {
      setItemName('');
      setNotes('');
      onOpenChange(false);
      onSuccess?.();
    } else {
      setError(result.message || 'Failed to save');
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !submitting) {
      setItemName('');
      setNotes('');
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md z-[60]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#259783]" />
            Requested but Not Sold
          </DialogTitle>
          <DialogDescription>
            Customer asked for something we don&apos;t have in stock? Log it here so you can restock later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Item name</Label>
            <Input
              id="item-name"
              placeholder="e.g. Red onions, Bread, Milk"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="text-base"
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="e.g. 2kg, 3 packets"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-base"
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#259783] hover:bg-[#208c7a] text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
