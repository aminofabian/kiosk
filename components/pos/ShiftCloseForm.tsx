'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Clock,
  Send,
} from 'lucide-react';
import type { Shift, BalanceApprovalRequest } from '@/lib/db/types';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

const DENOMINATIONS = [
  { value: 1000, label: '1000', icon: Banknote, color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-300' },
  { value: 500, label: '500', icon: Banknote, color: 'bg-blue-100 dark:bg-blue-900 border-blue-300' },
  { value: 200, label: '200', icon: Banknote, color: 'bg-purple-100 dark:bg-purple-900 border-purple-300' },
  { value: 100, label: '100', icon: Banknote, color: 'bg-red-100 dark:bg-red-900 border-red-300' },
  { value: 50, label: '50', icon: Banknote, color: 'bg-orange-100 dark:bg-orange-900 border-orange-300' },
  { value: 40, label: '40', icon: Banknote, color: 'bg-teal-100 dark:bg-teal-900 border-teal-300' },
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
  salesBreakdown?: {
    fullCashSales: { count: number; total: number };
    splitCashSales: { count: number; total: number };
  };
  creditPayments: { count: number; total: number };
  cashExpenses: { count: number; total: number };
}

interface CreateBalanceApprovalResponse {
  requestId: string;
}

export function ShiftCloseForm({ shift }: ShiftCloseFormProps) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [denominations, setDenominations] = useState<DenominationCounts>({
    1: 0, 5: 0, 10: 0, 20: 0, 40: 0, 50: 0, 100: 0, 200: 0, 500: 0, 1000: 0
  });
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [salesSummary, setSalesSummary] = useState<ShiftSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<BalanceApprovalRequest | null>(null);
  const [pendingClosingCount, setPendingClosingCount] = useState(0);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Cashiers MUST submit for approval, admin/owner can close directly or submit for approval
  const isCashier = user?.role === 'cashier';
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner';

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

    async function checkPendingApproval() {
      try {
        const result = await apiGet<BalanceApprovalRequest[]>('/api/balance/approvals?status=pending');
        if (result.success && result.data) {
          const closingRequests = result.data.filter(r => r.balance_type === 'closing' && r.shift_id === shift.id);
          setPendingClosingCount(closingRequests.length);
          setPendingApproval(closingRequests[0] ?? null);
        }
      } catch (err) {
        console.error('Error checking pending approval:', err);
      }
    }

    fetchSalesSummary();
    checkPendingApproval();
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

  // Calculate expected cash in drawer:
  // Formula: Opening Cash + Cash Received - Cash Given Out = Expected Cash
  // - Cash Received = Cash Sales + Cash Credit Payments
  // - Cash Given Out = Cash Expenses/Withdrawals during shift
  const cashSales = salesSummary?.sales?.total || 0;
  const creditPayments = salesSummary?.creditPayments?.total || 0;
  const cashIn = cashSales + creditPayments; // Total cash received during shift
  const cashExpenses = salesSummary?.cashExpenses?.total || 0; // Total cash given out (expenses/withdrawals)
  const expectedCashBeforeExpenses = shift.opening_cash + cashIn;
  const expectedCashAfterExpenses = expectedCashBeforeExpenses - cashExpenses; // Final expected amount
  const cashDifference = totalCash - expectedCashAfterExpenses; // Actual vs Expected difference

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

    // Cashiers must always submit for approval
    if (isCashier) {
      setRequiresApproval(true);
    }

    setIsSubmitting(true);

    try {
      if (requiresApproval || isCashier) {
        // Submit for approval instead of closing directly
        const result = await apiPost<CreateBalanceApprovalResponse>('/api/balance/approvals', {
          balanceType: 'closing',
          amount: totalCash,
          expectedAmount: expectedCashAfterExpenses,
          shiftId: shift.id,
          cashExpenses: cashExpenses,
          denominations: {
            denom_1: denominations[1],
            denom_5: denominations[5],
            denom_10: denominations[10],
            denom_20: denominations[20],
            denom_40: denominations[40],
            denom_50: denominations[50],
            denom_100: denominations[100],
            denom_200: denominations[200],
            denom_500: denominations[500],
            denom_1000: denominations[1000],
          }
        });

        if (result.success && result.data) {
          setSubmitted(true);
          setPendingApproval({
            id: result.data.requestId,
            balance_type: 'closing',
            amount: totalCash,
            status: 'pending',
            shift_id: shift.id,
          } as BalanceApprovalRequest);
          setPendingClosingCount(prev => prev + 1);
        } else {
          setError(result.message || 'Failed to submit for approval');
        }
      } else {
        // Close shift directly
        const result = await apiPost(`/api/shifts/${shift.id}/close`, {
          actualClosingCash: totalCash,
          cashExpenses: cashExpenses,
          denominations: {
            denom_1: denominations[1],
            denom_5: denominations[5],
            denom_10: denominations[10],
            denom_20: denominations[20],
            denom_40: denominations[40],
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
        }
      }
    } catch (err) {
      console.error('Shift close error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show success screen only when they just submitted (they can submit again from here)
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold">Closing Balance Submitted</h2>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-left space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Amount: {formatPrice(pendingApproval?.amount || totalCash)}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Your closing balance has been submitted for admin review. The shift will remain open until an admin approves or rejects your closing balance.
            </p>
            {expectedCashAfterExpenses && (
              <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Expected: {formatPrice(expectedCashAfterExpenses)} | 
                  Difference: {cashDifference >= 0 ? '+' : ''}{formatPrice(cashDifference)}
                </p>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            You will be notified once the admin reviews your submission.
          </p>
          <div className="pt-4 space-y-2">
            <Button 
              onClick={() => setSubmitted(false)} 
              variant="outline" 
              size="touch" 
              className="w-full"
            >
              Submit a different closing balance
            </Button>
            <Button 
              onClick={() => router.push('/pos')} 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-full p-4 pb-24">
      <div className="w-full max-w-2xl space-y-4">
        {pendingClosingCount > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You have {pendingClosingCount} pending closing request{pendingClosingCount !== 1 ? 's' : ''}
              {pendingApproval ? ` (latest: ${formatPrice(pendingApproval.amount)})` : ''}. You can submit another one below; each will wait for admin approval.
            </p>
          </div>
        )}
        {/* Shift Summary - Simplified for cashiers, detailed for admin/owner */}
        {isCashier ? (
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="w-5 h-5 text-[#1c6a1e]" />
                Shift Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Opening Cash:</span>
                <span className="font-bold text-slate-900 dark:text-white text-lg">
                  {formatPrice(shift.opening_cash)}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="w-5 h-5 text-[#1c6a1e]" />
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
                    {salesSummary.salesBreakdown ? (
                      <>
                        {salesSummary.salesBreakdown.fullCashSales.total > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                              Full Cash Sales ({salesSummary.salesBreakdown.fullCashSales.count}):
                            </span>
                            <span className="font-bold text-green-600">+ {formatPrice(salesSummary.salesBreakdown.fullCashSales.total)}</span>
                          </div>
                        )}
                        {salesSummary.salesBreakdown.splitCashSales.total > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                              Cash from Split Payments ({salesSummary.salesBreakdown.splitCashSales.count}):
                            </span>
                            <span className="font-bold text-green-600">+ {formatPrice(salesSummary.salesBreakdown.splitCashSales.total)}</span>
                          </div>
                        )}
                        {(salesSummary.salesBreakdown.fullCashSales.total > 0 || salesSummary.salesBreakdown.splitCashSales.total > 0) && (
                          <div className="flex justify-between text-sm font-semibold bg-green-50 dark:bg-green-900/20 -mx-1 px-2 py-1 rounded">
                            <span className="text-slate-700 dark:text-slate-300">Total Cash from Sales:</span>
                            <span className="font-bold text-green-600">+ {formatPrice(salesSummary.sales.total)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          Cash Sales ({salesSummary.sales.count}):
                        </span>
                        <span className="font-bold text-green-600">+ {formatPrice(salesSummary.sales.total)}</span>
                      </div>
                    )}
                    
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
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Expected Cash Calculation:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Opening Cash:</span>
                  <span className="font-medium">{formatPrice(shift.opening_cash)}</span>
                </div>
                {salesSummary?.salesBreakdown ? (
                  <>
                    {salesSummary.salesBreakdown.fullCashSales.total > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">+ Full Cash Sales:</span>
                        <span className="font-medium text-green-600">
                          + {formatPrice(salesSummary.salesBreakdown.fullCashSales.total)}
                        </span>
                      </div>
                    )}
                    {salesSummary.salesBreakdown.splitCashSales.total > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">+ Cash from Split Payments:</span>
                        <span className="font-medium text-green-600">
                          + {formatPrice(salesSummary.salesBreakdown.splitCashSales.total)}
                        </span>
                      </div>
                    )}
                    {salesSummary.creditPayments.total > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">+ Credit Payments (cash):</span>
                        <span className="font-medium text-green-600">
                          + {formatPrice(salesSummary.creditPayments.total)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">+ Cash Received (Sales + Credit Payments):</span>
                    <span className="font-medium text-green-600">
                      + {formatPrice(cashIn)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">- Cash Given Out (Expenses/Withdrawals):</span>
                  <span className="font-medium text-red-600">
                    - {formatPrice(cashExpenses)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-white">Expected Cash in Drawer:</span>
                  <span className="text-xl font-black text-[#1c6a1e]">
                    {formatPrice(expectedCashAfterExpenses)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                  Formula: Opening + Full Cash + Split Cash + Credit Payments - Expenses = Expected
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Close Form */}
        <Card className="border-2 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="w-5 h-5 text-[#1c6a1e]" />
              Count Cash in Drawer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Total Display */}
              <div className="p-4 bg-[#1c6a1e]/10 rounded-xl border-2 border-[#1c6a1e]/20">
                <p className="text-sm text-muted-foreground mb-1">Actual Cash Count</p>
                <p className="text-3xl font-black text-[#1c6a1e]">{formatPrice(totalCash)}</p>
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

              {/* Cash Comparison - Only show for admin/owner */}
              {!isCashier && totalCash > 0 && (
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

              {/* Approval Info */}
              {isCashier ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        Requires Admin Approval
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        As a cashier, your closing balance must be reviewed and approved by an admin before the shift can be closed.
                      </p>
                    </div>
                  </div>
                </div>
              ) : isAdminOrOwner ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(e) => setRequiresApproval(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                    />
                    Submit for approval (optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {requiresApproval 
                      ? 'This closing balance will be recorded as a request for review. Useful for audit trail.'
                      : 'Shift will close immediately with this balance.'}
                  </p>
                </div>
              ) : null}

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="touch"
                disabled={isSubmitting || totalCash === 0}
                className={`w-full font-bold ${
                  requiresApproval 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-[#1c6a1e] hover:bg-[#1a7a69]'
                } text-white`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {requiresApproval || isCashier ? 'Submitting...' : 'Closing...'}
                  </>
                ) : requiresApproval || isCashier ? (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    {isCashier ? 'Submit for Admin Approval' : 'Submit for Approval'}
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
