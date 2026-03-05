'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Banknote, Coins, ChevronDown, ChevronUp, Clock, CheckCircle2, Send } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import type { Shift, BalanceApprovalRequest } from '@/lib/db/types';
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

interface CreateBalanceApprovalResponse {
  requestId: string;
}

export function ShiftOpenForm() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [denominations, setDenominations] = useState<DenominationCounts>({
    1: 0, 5: 0, 10: 0, 20: 0, 40: 0, 50: 0, 100: 0, 200: 0, 500: 0, 1000: 0
  });
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [pendingApproval, setPendingApproval] = useState<BalanceApprovalRequest | null>(null);
  const [pendingOpeningCount, setPendingOpeningCount] = useState(0);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [submittedForApproval, setSubmittedForApproval] = useState(false);

  // Cashiers MUST submit for approval, admin/owner can open directly or submit for approval
  const isCashier = user?.role === 'cashier';
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    async function run() {
      try {
        const [currentResult, pendingResult] = await Promise.all([
          apiGet<Shift>('/api/shifts/current'),
          apiGet<BalanceApprovalRequest[]>('/api/balance/approvals?status=pending'),
        ]);

        if (currentResult.success && currentResult.data) {
          setHasOpenShift(true);
        } else {
          setHasOpenShift(false);
          // No open shift: prefill opening form from last closed shift denominations
          const lastClosedResult = await apiGet<{
            closing_denom_1: number;
            closing_denom_5: number;
            closing_denom_10: number;
            closing_denom_20: number;
            closing_denom_40: number;
            closing_denom_50: number;
            closing_denom_100: number;
            closing_denom_200: number;
            closing_denom_500: number;
            closing_denom_1000: number;
          }>('/api/shifts/last-closed');
          if (lastClosedResult.success && lastClosedResult.data) {
            const d = lastClosedResult.data;
            setDenominations({
              1: d.closing_denom_1 ?? 0,
              5: d.closing_denom_5 ?? 0,
              10: d.closing_denom_10 ?? 0,
              20: d.closing_denom_20 ?? 0,
              40: d.closing_denom_40 ?? 0,
              50: d.closing_denom_50 ?? 0,
              100: d.closing_denom_100 ?? 0,
              200: d.closing_denom_200 ?? 0,
              500: d.closing_denom_500 ?? 0,
              1000: d.closing_denom_1000 ?? 0,
            });
          }
        }

        if (pendingResult.success && pendingResult.data) {
          const openingRequests = pendingResult.data.filter(r => r.balance_type === 'opening');
          setPendingOpeningCount(openingRequests.length);
          setPendingApproval(openingRequests[0] ?? null);
        }
      } catch (err) {
        console.error('Error checking shift:', err);
        setHasOpenShift(false);
      }
    }

    run();
  }, []);

  const totalCash = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [denom, count]) => {
      return sum + (parseInt(denom) * count);
    }, 0);
  }, [denominations]);

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
        // Submit for approval instead of opening directly
        const result = await apiPost<CreateBalanceApprovalResponse>('/api/balance/approvals', {
          balanceType: 'opening',
          amount: totalCash,
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
          setPendingApproval({
            id: result.data.requestId,
            balance_type: 'opening',
            amount: totalCash,
            status: 'pending',
          } as BalanceApprovalRequest);
          setPendingOpeningCount(prev => prev + 1);
          setSubmittedForApproval(true);
        } else {
          setError(result.message || 'Failed to submit for approval');
        }
      } else {
        // Open shift directly
        const result = await apiPost('/api/shifts', { 
          openingCash: totalCash,
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
          setError(result.message || 'Failed to open shift');
        }
      }
    } catch (err) {
      console.error('Shift open error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-US')}`;
  };

  if (hasOpenShift === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking shift status...</p>
        </div>
      </div>
    );
  }

  if (hasOpenShift) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-[#1c6a1e]/10 rounded-2xl flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold">Shift Already Open</h2>
          <p className="text-muted-foreground">
            You already have an open shift. Please close it before opening a new one.
          </p>
          <Button onClick={() => router.push('/pos')} size="touch">
            Go to POS
          </Button>
        </div>
      </div>
    );
  }

  if (submittedForApproval) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-[#1c6a1e]/10 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-[#1c6a1e]" />
          </div>
          <h2 className="text-2xl font-bold">Shift Submitted Successfully</h2>
          <p className="text-muted-foreground">
            Your opening balance has been submitted for admin approval. An admin will review and approve it before your shift can start.
          </p>
          {pendingApproval && (
            <div className="w-full p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Pending approval — {formatPrice(pendingApproval.amount)}
              </span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="outline"
              size="touch"
              className="flex-1"
              onClick={() => {
                setSubmittedForApproval(false);
              }}
            >
              Open a new one
            </Button>
            <Button onClick={() => router.push('/pos')} size="touch" className="flex-1 bg-[#1c6a1e] hover:bg-[#1a7a69]">
              Back to POS
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-full p-4 pb-24">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-[#1c6a1e]" />
            Open New Shift
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Count the cash in the register by denomination
          </p>
        </CardHeader>
        <CardContent>
          {pendingOpeningCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                You have {pendingOpeningCount} pending opening request{pendingOpeningCount !== 1 ? 's' : ''}
                {pendingApproval ? ` (latest: ${formatPrice(pendingApproval.amount)})` : ''}. You can submit another one below; each will wait for admin approval.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Total Display */}
            <div className="p-4 bg-[#1c6a1e]/10 rounded-xl border-2 border-[#1c6a1e]/20">
              <p className="text-sm text-muted-foreground mb-1">Total Opening Cash</p>
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

            <Separator />

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
                      As a cashier, your opening balance must be reviewed and approved by an admin before the shift can be opened.
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
                    ? 'This opening balance will be recorded as a request for review. Useful for audit trail.'
                    : 'Shift will open immediately with this balance.'}
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
              disabled={isSubmitting}
              className={`w-full font-bold ${
                requiresApproval 
                  ? 'bg-amber-600 hover:bg-amber-700' 
                  : 'bg-[#1c6a1e] hover:bg-[#1a7a69]'
              } text-white`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {requiresApproval || isCashier ? 'Submitting...' : 'Opening...'}
                </>
              ) : requiresApproval || isCashier ? (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  {isCashier ? 'Submit for Admin Approval' : 'Submit for Approval'} ({formatPrice(totalCash)})
                </>
              ) : (
                <>Open Shift with {formatPrice(totalCash)}</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
