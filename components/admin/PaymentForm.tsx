'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { CreditAccount } from '@/lib/db/types';
import type { CreditPaymentMethod } from '@/lib/constants';
import { apiPost } from '@/lib/utils/api-client';

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

  // Reset form when account changes
  useEffect(() => {
    setAmount(account.total_credit.toString());
    setPaymentMethod('cash');
    setNotes('');
    setError(null);
  }, [account.id]);

  const paymentAmount = parseFloat(amount) || 0;
  const isFullPayment = paymentAmount >= account.total_credit;
  const remainingAfter = account.total_credit - paymentAmount;

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

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

      if (result.success) {
        if (onSuccess) {
          onSuccess();
        }
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
    <div className="max-w-2xl space-y-6">
      {/* Account Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-medium">{account.customer_name}</span>
          </div>
          {account.customer_phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{account.customer_phone}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Outstanding Balance:</span>
            <span className="text-2xl font-bold text-destructive">
              {formatPrice(account.total_credit)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount (KES) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={account.total_credit.toString()}
                max={account.total_credit}
                required
                className="text-lg h-12 touch-target"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount((account.total_credit * 0.5).toString())}
                >
                  50%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(account.total_credit.toString())}
                >
                  Full Payment
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as CreditPaymentMethod)}
              >
                <SelectTrigger className="h-12 touch-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this payment"
              />
            </div>

            {paymentAmount > 0 && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Balance:</span>
                  <span className="font-medium">{formatPrice(account.total_credit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment Amount:</span>
                  <span className="font-medium">{formatPrice(paymentAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Remaining Balance:</span>
                  <span
                    className={
                      remainingAfter <= 0
                        ? 'text-emerald-600'
                        : 'text-destructive'
                    }
                  >
                    {formatPrice(Math.max(0, remainingAfter))}
                  </span>
                </div>
                {isFullPayment && (
                  <p className="text-sm text-emerald-600 mt-2">
                    ✓ This will clear the debt completely
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="touch"
              disabled={isSubmitting || paymentAmount <= 0}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

