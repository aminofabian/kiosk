'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/utils/api-client';
import { toast } from 'sonner';

interface PosExpenseFormProps {
  onSuccess?: () => void;
  /** Shorter labels for compact drawer layouts */
  compact?: boolean;
}

export function PosExpenseForm({ onSuccess, compact }: PosExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await apiPost('/api/expenses', {
        name: reason.trim() || 'Cash Withdrawal',
        category: 'variable',
        amount: numericAmount,
        frequency: 'one-time',
        startDate: today,
        notes: reason.trim() || 'Cash taken from drawer',
      });

      if (result.success) {
        setAmount('');
        setReason('');
        toast.success('Expense recorded');
        onSuccess?.();
      } else {
        setError(result.message || 'Failed to record expense');
      }
    } catch (err) {
      console.error('Error recording expense:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Amount (KES)
        </Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 500"
          className={compact ? 'h-12 text-lg' : 'h-11'}
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Reason {compact ? '' : '/ Notes'} (optional)
        </Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Petty cash, lunch supplies"
          className={compact ? 'h-11' : 'h-11'}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Recorded as a one-time expense and deducted from expected drawer cash.
        </p>
      </div>
      {error && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-[#1c6a1e] hover:bg-[#1a7a69] text-white font-semibold h-11"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Recording...
          </>
        ) : (
          'Record Expense'
        )}
      </Button>
    </form>
  );
}
