'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Banknote, 
  Coins, 
  ChevronDown, 
  ChevronUp,
  Receipt,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
} from 'lucide-react';
import type { Shift } from '@/lib/db/types';
import { apiGet, apiPost } from '@/lib/utils/api-client';

const DENOMINATIONS = [
  { value: 1000, label: '1000', icon: Banknote, color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-300' },
  { value: 500, label: '500', icon: Banknote, color: 'bg-blue-100 dark:bg-blue-900 border-blue-300' },
  { value: 200, label: '200', icon: Banknote, color: 'bg-purple-100 dark:bg-purple-900 border-purple-300' },
  { value: 100, label: '100', icon: Banknote, color: 'bg-red-100 dark:bg-red-900 border-red-300' },
  { value: 50, label: '50', icon: Banknote, color: 'bg-orange-100 dark:bg-orange-900 border-orange-300' },
  { value: 20, label: '20', icon: Coins, color: 'bg-yellow-100 dark:bg-yellow-900 border-yellow-300' },
  { value: 10, label: '10', icon: Coins, color: 'bg-amber-100 dark:bg-amber-900 border-amber-300' },
  { value: 5, label: '5', icon: Coins, color: 'bg-gray-100 dark:bg-gray-800 border-gray-300' },
  { value: 1, label: '1', icon: Coins, color: 'bg-slate-100 dark:bg-slate-800 border-slate-300' },
];

interface DenominationCounts {
  [key: number]: number;
}

interface ShiftCloseFormProps {
  shift: Shift;
}

interface ShiftSummary {
  sales: { count: number; total: number };
  creditPayments: { count: number; total: number };
  cashExpenses: { count: number; total: number };
}

export function ShiftCloseForm({ shift }: ShiftCloseFormProps) {
  const router = useRouter();
  const [denominations, setDenominations] = useState<DenominationCounts>({
    1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0, 200: 0, 500: 0, 1000: 0
  });
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [salesSummary, setSalesSummary] = useState<ShiftSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSalesSummary() {
      try {
        const result = await apiGet<ShiftSummary>(`/api/shifts/${shift.id}/summary`);
        if (result.success) {
          setSalesSummary(result.data ?? null);
        }
      } catch (err) {
        console.error('Error fetching sales summary:', err);
      }
    }
    fetchSalesSummary();
  }, [shift.id]);

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

  const totalCash = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [denom, count]) => {
      return sum + (parseInt(denom) * count);
    }, 0);
  }, [denominations]);

  // Calculate expected cash considering expenses
  const cashExpenses = salesSummary?.cashExpenses?.total || 0;
  const expectedCashBeforeExpenses = shift.expected_closing_cash;
  const expectedCashAfterExpenses = expectedCashBeforeExpenses - cashExpenses;
  const cashDifference = totalCash - expectedCashAfterExpenses;

  const updateDenomination = (value: number, count: number) => {
    setDenominations(prev => ({
      ...prev,
      [value]: Math.max(0, count)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (totalCash < 0) {
      setError('Please enter valid denomination counts');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiPost(`/api/shifts/${shift.id}/close`, {
        actualClosingCash: totalCash,
        cashExpenses: cashExpenses,
        denominations: {
          denom_1: denominations[1],
          denom_5: denominations[5],
          denom_10: denominations[10],
          denom_20: denominations[20],
          denom_50: denominations[50],
          denom_100: denominations[100],
          denom_200: denominations[200],
          denom_500: denominations[500],
          denom_1000: denominations[1000],
        }
      });

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
    <div className="flex items-center justify-center min-h-full p-4 pb-24">
      <div className="w-full max-w-2xl space-y-4">
        {/* Shift Summary */}
        <Card className="border-2 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-5 h-5 text-[#259783]" />
              Shift Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Started:</span>
              <span className="font-medium">{formatDate(shift.started_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Opening Cash:</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatPrice(shift.opening_cash)}</span>
            </div>
            
            {salesSummary && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Cash Sales ({salesSummary.sales.count}):
                    </span>
                    <span className="font-bold text-green-600">+ {formatPrice(salesSummary.sales.total)}</span>
                  </div>
                  
                  {salesSummary.creditPayments.total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Credit Payments ({salesSummary.creditPayments.count}):
                      </span>
                      <span className="font-bold text-green-600">+ {formatPrice(salesSummary.creditPayments.total)}</span>
                    </div>
                  )}
                  
                  {cashExpenses > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        Cash Expenses ({salesSummary.cashExpenses?.count || 0}):
                      </span>
                      <span className="font-bold text-red-600">- {formatPrice(cashExpenses)}</span>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}
            
            {/* Expected Cash Calculation */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Opening Cash:</span>
                <span className="font-medium">{formatPrice(shift.opening_cash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">+ Cash In (Sales + Payments):</span>
                <span className="font-medium text-green-600">
                  {formatPrice(expectedCashBeforeExpenses - shift.opening_cash)}
                </span>
              </div>
              {cashExpenses > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">- Cash Out (Expenses):</span>
                  <span className="font-medium text-red-600">{formatPrice(cashExpenses)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white">Expected Cash in Drawer:</span>
                <span className="text-xl font-black text-[#259783]">
                  {formatPrice(expectedCashAfterExpenses)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Close Form */}
        <Card className="border-2 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="w-5 h-5 text-[#259783]" />
              Count Cash in Drawer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Total Display */}
              <div className="p-4 bg-[#259783]/10 rounded-xl border-2 border-[#259783]/20">
                <p className="text-sm text-muted-foreground mb-1">Actual Cash Count</p>
                <p className="text-3xl font-black text-[#259783]">{formatPrice(totalCash)}</p>
              </div>

              {/* Denomination Breakdown Toggle */}
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex items-center justify-between w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="font-medium flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Denomination Breakdown
                </span>
                {showBreakdown ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* Denomination Inputs */}
              {showBreakdown && (
                <div className="space-y-2">
                  {DENOMINATIONS.map((denom) => {
                    const Icon = denom.icon;
                    const subtotal = denominations[denom.value] * denom.value;
                    return (
                      <div
                        key={denom.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 ${denom.color}`}
                      >
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          <span className="font-bold text-slate-900 dark:text-white">
                            {denom.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-slate-500">×</span>
                          <Input
                            type="number"
                            min="0"
                            value={denominations[denom.value] || ''}
                            onChange={(e) => updateDenomination(denom.value, parseInt(e.target.value) || 0)}
                            className="w-20 h-10 text-center font-semibold"
                            placeholder="0"
                          />
                          <span className="text-slate-500">=</span>
                          <span className="font-bold text-slate-900 dark:text-white min-w-[80px] text-right">
                            {formatPrice(subtotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cash Comparison */}
              {totalCash > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expected:</span>
                    <span className="font-bold">{formatPrice(expectedCashAfterExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Actual:</span>
                    <span className="font-bold">{formatPrice(totalCash)}</span>
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
                      {cashDifference === 0 ? (
                        <Minus className="w-4 h-4 mr-1" />
                      ) : cashDifference > 0 ? (
                        <TrendingUp className="w-4 h-4 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 mr-1" />
                      )}
                      {cashDifference >= 0 ? '+' : ''}
                      {formatPrice(cashDifference)}
                    </Badge>
                  </div>
                  {cashDifference !== 0 && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>
                        {cashDifference > 0
                          ? 'More cash than expected (overage). This could indicate uncounted incoming cash.'
                          : 'Less cash than expected (shortage). Please recount or investigate the discrepancy.'}
                      </p>
                    </div>
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
                disabled={isSubmitting || totalCash === 0}
                className="w-full bg-[#259783] hover:bg-[#1a7a69] text-white font-bold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>Close Shift</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
