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
  /** When true, hides the balance card (e.g. when shown in drawer with balance in header) */
  compact?: boolean;
  /** Tighter layout for fixed drawer footer (amount + summary + submit stay visible) */
  drawerFooter?: boolean;
  /** Single-row–style footer: minimal chrome, more room for history above */
  paymentDrawerDense?: boolean;
}

export function PaymentForm({
  account,
  onSuccess,
  compact,
  drawerFooter,
  paymentDrawerDense,
}: PaymentFormProps) {
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
  const owed = Math.max(0, account.total_credit);
  const appliedToTab = Math.min(paymentAmount, owed);
  const toWallet = Math.max(0, paymentAmount - appliedToTab);
  const isFullPayment = owed > 0 && appliedToTab >= owed - 0.009;
  const remainingAfter = Math.max(0, owed - appliedToTab);

  const formatPrice = (price: number) =>
    `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentAmount <= 0) {
      setError('Payment amount must be greater than 0');
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

  const denseSummary =
    paymentAmount > 0 ? (
      <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="tabular-nums">Owing {formatPrice(owed)}</span>
        <span className="text-slate-400 dark:text-slate-500" aria-hidden>
          →
        </span>
        <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
          Pay {formatPrice(paymentAmount)}
        </span>
        {toWallet > 0.009 && (
          <>
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums font-semibold text-violet-600 dark:text-violet-400">
              Wallet +{formatPrice(toWallet)}
            </span>
          </>
        )}
        <span className="text-slate-400 dark:text-slate-500">·</span>
        <span
          className={cn(
            'tabular-nums font-semibold',
            remainingAfter <= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          )}
        >
          Tab left {formatPrice(remainingAfter)}
        </span>
        {isFullPayment && (
          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            Clears debt
          </span>
        )}
      </p>
    ) : null;

  if (drawerFooter && paymentDrawerDense) {
    return (
      <div className="space-y-0">
        {!compact && (
          <Card className="border-slate-200 dark:border-slate-800 overflow-hidden rounded-lg mb-2">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Outstanding</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatPrice(account.total_credit)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 py-2 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="grid grid-cols-1 min-[400px]:grid-cols-[1fr_7.25rem] gap-2 items-end">
              <div className="space-y-1 min-w-0">
                <Label
                  htmlFor="amount"
                  className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  Amount (KES)
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={account.total_credit.toString()}
                    required
                    className="h-9 min-w-0 flex-1 text-sm font-semibold tabular-nums border-slate-200 dark:border-slate-600"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount((account.total_credit * 0.5).toString())}
                    className="h-9 shrink-0 px-2 text-[10px] font-semibold border-slate-200 dark:border-slate-600"
                  >
                    ½
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(account.total_credit.toString())}
                    className="h-9 shrink-0 px-2 text-[10px] font-semibold border-slate-200 dark:border-slate-600"
                  >
                    Max
                  </Button>
                </div>
              </div>
              <div className="space-y-1 min-w-0">
                <Label
                  htmlFor="method"
                  className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  Method
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as CreditPaymentMethod)}
                >
                  <SelectTrigger
                    id="method"
                    className="h-9 text-xs border-slate-200 dark:border-slate-600"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {denseSummary}
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note (optional)"
              className="h-8 text-xs border-slate-200 dark:border-slate-600"
            />
            {error && (
              <div className="rounded-md py-1.5 px-2 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-[11px] text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || paymentAmount <= 0}
              className="w-full h-9 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording…
                </>
              ) : (
                'Record payment'
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={drawerFooter ? 'space-y-3' : 'space-y-6'}>
      {!compact && (
        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden rounded-lg">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Outstanding balance
              </span>
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {formatPrice(account.total_credit)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record payment form — solid colors for IE/old browser support */}
      <Card
        className={cn(
          'border-slate-200 dark:border-slate-700 overflow-hidden rounded-lg bg-white dark:bg-slate-900',
          drawerFooter && 'shadow-none border-slate-200/90 dark:border-slate-700/90'
        )}
      >
        <div
          className={cn(
            'flex items-center bg-emerald-50 dark:bg-emerald-900 border-b border-slate-200 dark:border-slate-700',
            drawerFooter ? 'px-4 py-3' : 'px-5 py-4'
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center rounded-lg bg-emerald-200 dark:bg-emerald-800',
              drawerFooter ? 'h-8 w-8' : 'h-9 w-9'
            )}
          >
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 ml-3">
            Record payment
          </h3>
        </div>
        <CardContent className={drawerFooter ? 'p-4 pt-3' : 'p-5'}>
          <form onSubmit={handleSubmit} className={drawerFooter ? 'space-y-3.5' : 'space-y-5'}>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Amount (KES) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={account.total_credit.toString()}
                required
                className={cn(
                  'text-base font-semibold border-slate-200 dark:border-slate-700',
                  drawerFooter ? 'h-11' : 'h-12'
                )}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can pay more than the balance; the extra is credited to this customer&apos;s store wallet.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((account.total_credit * 0.5).toString())}
                  className="text-xs rounded-lg border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-200"
                >
                  50%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(account.total_credit.toString())}
                  className="text-xs rounded-lg border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-200"
                >
                  Full payment
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Payment method
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as CreditPaymentMethod)}
              >
                <SelectTrigger
                  className={cn(
                    'rounded-lg border-slate-200 dark:border-slate-700',
                    drawerFooter ? 'h-10' : 'h-12'
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Notes (optional)
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. partial payment, cheque number"
                className="rounded-lg border-slate-200 dark:border-slate-700"
              />
            </div>

            {paymentAmount > 0 && (
              <div
                className={cn(
                  'rounded-lg border-2',
                  drawerFooter ? 'p-3 space-y-2' : 'p-4 space-y-2.5',
                  isFullPayment
                    ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                )}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Current tab balance</span>
                  <span className="font-medium">{formatPrice(owed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">This payment</span>
                  <span className="font-medium">{formatPrice(paymentAmount)}</span>
                </div>
                {appliedToTab > 0.009 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Applied to tab</span>
                    <span className="font-medium tabular-nums">{formatPrice(appliedToTab)}</span>
                  </div>
                )}
                {toWallet > 0.009 && (
                  <div className="flex justify-between text-sm text-violet-700 dark:text-violet-300">
                    <span>Credited to wallet</span>
                    <span className="font-semibold tabular-nums">+{formatPrice(toWallet)}</span>
                  </div>
                )}
                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tab remaining
                  </span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      remainingAfter <= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {formatPrice(remainingAfter)}
                  </span>
                </div>
                {owed < 0.01 && paymentAmount > 0 && (
                  <p className="text-sm text-violet-700 dark:text-violet-300 pt-1">
                    No tab balance — the full amount will be added to their store wallet.
                  </p>
                )}
                {isFullPayment && (
                  <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 pt-1">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    This will clear the debt completely
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-lg p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || paymentAmount <= 0}
              className={cn(
                'w-full rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white',
                drawerFooter ? 'h-11 shrink-0' : 'h-12'
              )}
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
