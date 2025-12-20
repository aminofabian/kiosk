'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { Shift } from '@/lib/db/types';

interface ShiftCloseFormProps {
  shift: Shift;
}

export function ShiftCloseForm({ shift }: ShiftCloseFormProps) {
  const router = useRouter();
  const [actualCash, setActualCash] = useState<string>('');
  const [salesSummary, setSalesSummary] = useState<{
    sales: { count: number; total: number };
    creditPayments: { count: number; total: number };
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSalesSummary() {
      try {
        const response = await fetch(`/api/shifts/${shift.id}/summary`);
        const result = await response.json();
        if (result.success) {
          setSalesSummary(result.data);
        }
      } catch (err) {
        console.error('Error fetching sales summary:', err);
      }
    }
    fetchSalesSummary();
  }, [shift.id]);

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const actualAmount = parseFloat(actualCash) || 0;
  const cashDifference = actualAmount - shift.expected_closing_cash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNaN(actualAmount) || actualAmount < 0) {
      setError('Please enter a valid cash amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/shifts/${shift.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actualClosingCash: actualAmount,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push('/pos');
      } else {
        setError(result.message || 'Failed to close shift');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Shift close error:', err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Shift Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Shift Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started:</span>
              <span className="font-medium">{formatDate(shift.started_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Opening Cash:</span>
              <span className="font-medium">{formatPrice(shift.opening_cash)}</span>
            </div>
            {salesSummary && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Number of Sales:</span>
                  <span className="font-medium">{salesSummary.sales.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash Sales:</span>
                  <span className="font-medium">{formatPrice(salesSummary.sales.total)}</span>
                </div>
                {salesSummary.creditPayments.total > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit Payments Collected:</span>
                      <span className="font-medium text-[#4bee2b]">
                        {formatPrice(salesSummary.creditPayments.total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Number of Payments:</span>
                      <span className="font-medium">{salesSummary.creditPayments.count}</span>
                    </div>
                  </>
                )}
              </>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expected Closing Cash:</span>
              <span className="text-lg font-bold text-primary">
                {formatPrice(shift.expected_closing_cash)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Close Form */}
        <Card>
          <CardHeader>
            <CardTitle>Close Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="actual">Actual Closing Cash (KES) *</Label>
                <Input
                  id="actual"
                  type="number"
                  step="0.01"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="Count the cash in register"
                  required
                  className="text-lg h-14 touch-target"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Physically count all cash in the register
                </p>
              </div>

              {actualCash && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Expected:</span>
                    <span className="font-medium">
                      {formatPrice(shift.expected_closing_cash)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Actual:</span>
                    <span className="font-medium">{formatPrice(actualAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Difference:</span>
                    <Badge
                      variant={
                        cashDifference === 0
                          ? 'default'
                          : cashDifference > 0
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="text-lg px-3 py-1"
                    >
                      {cashDifference >= 0 ? '+' : ''}
                      {formatPrice(cashDifference)}
                    </Badge>
                  </div>
                  {cashDifference !== 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {cashDifference > 0
                        ? 'More cash than expected (overage)'
                        : 'Less cash than expected (shortage)'}
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
                disabled={isSubmitting}
                className="w-full bg-[#4bee2b] hover:bg-[#45d827] text-[#101b0d]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Closing...
                  </>
                ) : (
                  'Close Shift'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

