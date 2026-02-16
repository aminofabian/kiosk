'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, CheckCircle2 } from 'lucide-react';
import type { CreditAccount } from '@/lib/db/types';
import type { CreditPaymentMethod } from '@/lib/constants';
import { apiPost } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils';

interface PaymentFormProps {
  account: CreditAccount;
  onSuccess?: () => void;
}

export function PaymentForm({ account, onSuccess }: PaymentFormProps) {
  const [amount, setAmount] = useState<string>(account.total_credit.toString());
  const [paymentMethod, setPaymentMethod] = useState<CreditPaymentMethod>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(account.total_credit.toString());
    setPaymentMethod('cash');
    setNotes('');
    setError(null);
  }, [account.id]);

  const paymentAmount = parseFloat(amount) || 0;
  const isFullPayment = paymentAmount >= account.total_credit;
  const remainingAfter = account.total_credit - paymentAmount;

  const formatPrice = (price: number) =>
    `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentAmount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    if (paymentAmount > account.total_credit) {
      setError('Payment amount cannot exceed outstanding balance');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiPost(`/api/credits/${account.id}/payment`, {
        amount: paymentAmount,
        paymentMethod,
        notes: notes || null,
      });

      if (result.success && onSuccess) {
        onSuccess();
      } else {
        setError(result.message || 'Failed to record payment');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Balance summary */}
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Outstanding balance
            </span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatPrice(account.total_credit)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Record payment form */}
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <Wallet className="h-4 w-4 text-[#259783]" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Record payment</h3>
        </div>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-700 dark:text-slate-300">
                Amount (KES) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={0}
                max={account.total_credit}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={account.total_credit.toString()}
                required
                className="h-12 text-base font-medium border-slate-200 dark:border-slate-700 focus-visible:ring-[#259783]"
              />
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((account.total_credit * 0.5).toString())}
                  className="text-xs border-slate-200 dark:border-slate-700"
                >
                  50%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(account.total_credit.toString())}
                  className="text-xs border-slate-200 dark:border-slate-700"
                >
                  Full payment
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method" className="text-slate-700 dark:text-slate-300">
                Payment method
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as CreditPaymentMethod)}
              >
                <SelectTrigger className="h-12 border-slate-200 dark:border-slate-700 focus:ring-[#259783]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-700 dark:text-slate-300">
                Notes (optional)
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. partial payment, cheque number"
                className="border-slate-200 dark:border-slate-700 focus-visible:ring-[#259783]"
              />
            </div>

            {paymentAmount > 0 && (
              <div
                className={cn(
                  'rounded-xl p-4 space-y-2 border',
                  isFullPayment
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                )}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Current balance</span>
                  <span className="font-medium">{formatPrice(account.total_credit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">This payment</span>
                  <span className="font-medium">{formatPrice(paymentAmount)}</span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Remaining
                  </span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      remainingAfter <= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {formatPrice(Math.max(0, remainingAfter))}
                  </span>
                </div>
                {isFullPayment && (
                  <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 pt-1">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    This will clear the debt completely
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-lg p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || paymentAmount <= 0}
              className="w-full h-12 font-semibold bg-gradient-to-r from-[#259783] to-[#1e7a6a] hover:from-[#1e7a6a] hover:to-[#197566] text-white shadow-lg shadow-[#259783]/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Recording…
                </>
              ) : (
                'Record payment'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
