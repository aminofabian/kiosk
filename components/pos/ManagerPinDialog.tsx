'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/utils/api-client';

interface ManagerPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onVerified: (pin: string) => void;
}

export function ManagerPinDialog({
  open,
  onOpenChange,
  title = 'Manager approval required',
  description = 'Enter an owner or admin PIN to continue.',
  onVerified,
}: ManagerPinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = (next: boolean) => {
    if (!next) {
      setPin('');
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter a 4-digit PIN');
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost<{ name: string }>('/api/auth/verify-pin', { pin });
      if (result.success) {
        onVerified(pin);
        setPin('');
        onOpenChange(false);
      } else {
        setError(result.message || 'Invalid PIN');
      }
    } catch {
      setError('Could not verify PIN. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="manager-pin">Manager PIN</Label>
            <Input
              id="manager-pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="text-center text-lg tracking-[0.3em] font-mono"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || pin.length !== 4}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
