'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Banknote,
  Clock,
  User,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { toast } from 'sonner';
import type { BalanceApprovalRequest } from '@/lib/db/types';

interface BalanceApprovalRequestWithDetails extends BalanceApprovalRequest {
  user_name: string;
  user_email: string;
  approver_name: string | null;
  shift_opening_cash?: number | null;
  shift_started_at?: number | null;
}

interface ShiftSummary {
  sales: { count: number; total: number };
  salesBreakdown?: {
    fullCashSales: { count: number; total: number };
    splitCashSales: { count: number; total: number };
  };
  creditPayments: { count: number; total: number };
  cashExpenses: { count: number; total: number };
  expensesList?: Array<{
    id: string;
    name: string;
    amount: number;
    category: string;
    created_at: number;
    created_by: string | null;
    notes: string | null;
  }>;
}

interface DrawerInfo {
  shiftId: string;
  userId: string;
  cashierName: string;
  openedAt: number;
  endedAt: number | null;
  status: 'open' | 'closed';
  openingCash: number;
  expectedCash: number;
  actualClosingCash: number | null;
}

const DENOMINATIONS = [
  { value: 1000, label: '1000' },
  { value: 500, label: '500' },
  { value: 200, label: '200' },
  { value: 100, label: '100' },
  { value: 50, label: '50' },
  { value: 20, label: '20' },
  { value: 10, label: '10' },
  { value: 5, label: '5' },
  { value: 1, label: '1' },
];

export function BalanceApprovals() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const [requests, setRequests] = useState<BalanceApprovalRequestWithDetails[]>([]);
  const [drawers, setDrawers] = useState<DrawerInfo[]>([]);
  const [closedDrawers, setClosedDrawers] = useState<DrawerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectDialog, setShowRejectDialog] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shiftSummaries, setShiftSummaries] = useState<Record<string, ShiftSummary>>({});

  useEffect(() => {
    // Cashiers should not see balance approval summaries
    if (!user || user.role === 'cashier') return;
    fetchRequests();
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const [approvalsRes, drawersRes] = await Promise.all([
        fetch('/api/balance/approvals?status=pending'),
        fetch('/api/shifts/drawers'),
      ]);
      const approvalsResult = await approvalsRes.json();
      const drawersResult = await drawersRes.json();

      if (approvalsResult.success) {
        const fetchedRequests = approvalsResult.data || [];
        setRequests(fetchedRequests);

        const summaries: Record<string, ShiftSummary> = {};
        for (const request of fetchedRequests) {
          if (request.balance_type === 'closing' && request.shift_id) {
            try {
              const summaryResponse = await fetch(`/api/shifts/${request.shift_id}/summary`);
              const summaryResult = await summaryResponse.json();
              if (summaryResult.success) {
                summaries[request.id] = summaryResult.data;
              }
            } catch (err) {
              console.error(`Error fetching shift summary for ${request.shift_id}:`, err);
            }
          }
        }
        setShiftSummaries(summaries);
      } else {
        setError(approvalsResult.message || 'Failed to load approval requests');
      }

      if (drawersResult.success && drawersResult.data) {
        setDrawers(drawersResult.data.drawers ?? []);
        setClosedDrawers(drawersResult.data.closed ?? []);
      } else {
        setDrawers([]);
        setClosedDrawers([]);
      }
    } catch (err) {
      setError('Failed to load approval requests');
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      const response = await fetch(`/api/balance/approvals/${requestId}/approve`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        await fetchRequests();
        toast.success('Request approved');
      } else {
        toast.error(result.message || 'Failed to approve request');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      toast.error('Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      const response = await fetch(`/api/balance/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason[requestId] || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowRejectDialog({ ...showRejectDialog, [requestId]: false });
        setRejectReason({ ...rejectReason, [requestId]: '' });
        await fetchRequests();
        toast.success('Request rejected');
      } else {
        toast.error(result.message || 'Failed to reject request');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      toast.error('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (amount: number) => {
    return `KES ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getDenominationBreakdown = (request: BalanceApprovalRequestWithDetails) => {
    const breakdown: { denom: number; count: number }[] = [];
    DENOMINATIONS.forEach(({ value }) => {
      const count = request[`denom_${value}` as keyof BalanceApprovalRequestWithDetails] as number;
      if (count > 0) {
        breakdown.push({ denom: value, count });
      }
    });
    return breakdown;
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#259783]" />
          <p className="text-slate-500">Loading approval requests...</p>
        </div>
      </div>
    );
  }

  if (user && user.role === 'cashier') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
          <p className="text-slate-700 dark:text-slate-200 font-semibold">
            Balance approvals and drawer summaries are only visible to admins and owners.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cash in drawers - open and recently closed shifts */}
      {(drawers.length > 0 || closedDrawers.length > 0) && (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-[#259783]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Cash in drawers
              </h3>
            </div>

            {drawers.length > 0 && (
              <>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Open drawers ({drawers.length})
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Expected cash in each open drawer (before expenses deducted at close).
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
                  {drawers.map((drawer) => (
                    <div
                      key={drawer.shiftId}
                      className="p-4 rounded-xl border-2 border-[#259783]/30 dark:border-[#259783]/50 bg-slate-50 dark:bg-slate-800/50 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {drawer.cashierName}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:border-green-700">
                          Open
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        Opened {formatDate(drawer.openedAt)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Opening</p>
                          <p className="font-bold text-slate-900 dark:text-white">{formatPrice(drawer.openingCash)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Expected</p>
                          <p className="font-bold text-[#259783]">{formatPrice(drawer.expectedCash)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {closedDrawers.length > 0 && (
              <>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Closed recently ({closedDrawers.length})
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Actual closing cash for shifts closed in the last 7 days.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {closedDrawers.map((drawer) => (
                    <div
                      key={drawer.shiftId}
                      className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {drawer.cashierName}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          Closed
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        {drawer.endedAt ? `Closed ${formatDate(drawer.endedAt)}` : `Opened ${formatDate(drawer.openedAt)}`}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Opening</p>
                          <p className="font-bold text-slate-900 dark:text-white">{formatPrice(drawer.openingCash)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actual closed</p>
                          <p className="font-bold text-[#259783]">
                            {drawer.actualClosingCash != null ? formatPrice(drawer.actualClosingCash) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Pending Balance Approvals
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {requests.length === 0
              ? 'No requests waiting for approval'
              : `${requests.length} request${requests.length !== 1 ? 's' : ''} waiting for approval`}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex items-center justify-center py-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
          <div className="text-center space-y-3">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold">No pending approvals</p>
            <p className="text-sm text-slate-400">All balance requests have been processed</p>
          </div>
        </div>
      ) : (
      <div className="grid gap-4">
        {requests.map((request) => {
          const isProcessing = processingId === request.id;
          const showReject = showRejectDialog[request.id];
          const isExpanded = expandedId === request.id;
          const isOpening = request.balance_type === 'opening';
          const denomBreakdown = getDenominationBreakdown(request);
          // For closing: use recalculated expected (includes split payments) when we have shift summary
          const summary = shiftSummaries[request.id];
          const recalculatedExpected = !isOpening && summary
            ? (request.shift_opening_cash || 0) + summary.sales.total + summary.creditPayments.total - summary.cashExpenses.total
            : null;
          const expectedForDiff = recalculatedExpected ?? request.expected_amount ?? 0;
          const hasExpected = (recalculatedExpected !== null || (request.expected_amount !== null && request.expected_amount !== undefined));
          const difference = hasExpected ? request.amount - expectedForDiff : null;

          return (
            <Card key={request.id} className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isOpening 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {isOpening ? (
                          <ArrowUpCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {isOpening ? 'Opening Balance' : 'Closing Balance'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {isOpening ? 'New shift request' : 'End of shift request'}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={isOpening ? 'bg-green-50 text-green-700 border-green-300' : 'bg-blue-50 text-blue-700 border-blue-300'}
                      >
                        {isOpening ? 'Opening' : 'Closing'}
                      </Badge>
                    </div>

                    {/* For closing requests, show detailed breakdown */}
                    {!isOpening && request.shift_id && (
                      <div className="bg-white dark:bg-[#1c2e18] border-2 border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-[#259783]" />
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Shift Summary</h4>
                        </div>

                        {request.shift_started_at && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Started:</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {formatDate(request.shift_started_at)}
                            </span>
                          </div>
                        )}

                        {request.shift_opening_cash !== null && request.shift_opening_cash !== undefined && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Opening Cash:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatPrice(request.shift_opening_cash)}
                            </span>
                          </div>
                        )}

                        {shiftSummaries[request.id] && (
                          <>
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                              {shiftSummaries[request.id].salesBreakdown ? (
                                <>
                                  {shiftSummaries[request.id].salesBreakdown!.fullCashSales.total > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                        Full Cash Sales ({shiftSummaries[request.id].salesBreakdown!.fullCashSales.count}):
                                      </span>
                                      <span className="font-bold text-green-600">
                                        + {formatPrice(shiftSummaries[request.id].salesBreakdown!.fullCashSales.total)}
                                      </span>
                                    </div>
                                  )}
                                  {shiftSummaries[request.id].salesBreakdown!.splitCashSales.total > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                        Cash from Split Payments ({shiftSummaries[request.id].salesBreakdown!.splitCashSales.count}):
                                      </span>
                                      <span className="font-bold text-green-600">
                                        + {formatPrice(shiftSummaries[request.id].salesBreakdown!.splitCashSales.total)}
                                      </span>
                                    </div>
                                  )}
                                  {(shiftSummaries[request.id].salesBreakdown!.fullCashSales.total > 0 || shiftSummaries[request.id].salesBreakdown!.splitCashSales.total > 0) && (
                                    <div className="flex justify-between text-sm font-semibold bg-green-50 dark:bg-green-900/20 -mx-2 px-2 py-1 rounded">
                                      <span className="text-slate-700 dark:text-slate-300">Total Cash from Sales:</span>
                                      <span className="font-bold text-green-600">
                                        + {formatPrice(shiftSummaries[request.id].sales.total)}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    Cash Sales ({shiftSummaries[request.id].sales.count}):
                                  </span>
                                  <span className="font-bold text-green-600">
                                    + {formatPrice(shiftSummaries[request.id].sales.total)}
                                  </span>
                                </div>
                              )}

                              {shiftSummaries[request.id].creditPayments.total > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    Credit Payments ({shiftSummaries[request.id].creditPayments.count}):
                                  </span>
                                  <span className="font-bold text-green-600">
                                    + {formatPrice(shiftSummaries[request.id].creditPayments.total)}
                                  </span>
                                </div>
                              )}

                              {shiftSummaries[request.id].cashExpenses.total > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                    Cash Expenses ({shiftSummaries[request.id].cashExpenses.count}):
                                  </span>
                                  <span className="font-bold text-red-600">
                                    - {formatPrice(shiftSummaries[request.id].cashExpenses.total)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Expected Cash Calculation */}
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                Expected Cash Calculation:
                              </p>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Opening Cash:</span>
                                <span className="font-medium text-slate-900 dark:text-white">
                                  {formatPrice(request.shift_opening_cash || 0)}
                                </span>
                              </div>
                              {shiftSummaries[request.id].salesBreakdown ? (
                                <>
                                  {shiftSummaries[request.id].salesBreakdown!.fullCashSales.total > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">+ Full Cash Sales:</span>
                                      <span className="font-medium text-green-600">
                                        + {formatPrice(shiftSummaries[request.id].salesBreakdown!.fullCashSales.total)}
                                      </span>
                                    </div>
                                  )}
                                  {shiftSummaries[request.id].salesBreakdown!.splitCashSales.total > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">+ Cash from Split Payments:</span>
                                      <span className="font-medium text-green-600">
                                        + {formatPrice(shiftSummaries[request.id].salesBreakdown!.splitCashSales.total)}
                                      </span>
                                    </div>
                                  )}
                                  {shiftSummaries[request.id].creditPayments.total > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">+ Credit Payments (cash):</span>
                                      <span className="font-medium text-green-600">
                                        + {formatPrice(shiftSummaries[request.id].creditPayments.total)}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">
                                    + Cash Received (Sales + Credit Payments):
                                  </span>
                                  <span className="font-medium text-green-600">
                                    + {formatPrice(
                                      shiftSummaries[request.id].sales.total +
                                      shiftSummaries[request.id].creditPayments.total
                                    )}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">
                                  - Cash Given Out (Expenses/Withdrawals):
                                </span>
                                <span className="font-medium text-red-600">
                                  - {formatPrice(shiftSummaries[request.id].cashExpenses.total)}
                                </span>
                              </div>
                              <div className="border-t border-slate-300 dark:border-slate-600 pt-2 mt-2">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    Expected Cash in Drawer:
                                  </span>
                                  <span className="text-2xl font-black text-[#259783]">
                                    {formatPrice(recalculatedExpected ?? request.expected_amount ?? 0)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                                  Formula: Opening + Full Cash + Split Cash + Credit Payments - Expenses = Expected
                                </p>
                              </div>
                            </div>

                            {/* Submitted Amount and Difference */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="p-3 bg-[#259783]/10 dark:bg-[#259783]/20 rounded-lg">
                                <p className="text-slate-500 dark:text-slate-400 mb-1">Actual Cash Count</p>
                                <p className="text-xl font-black text-[#259783]">
                                  {formatPrice(request.amount)}
                                </p>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-slate-500 dark:text-slate-400 mb-1">
                                  Difference (Actual - Expected)
                                </p>
                                <p className={`font-semibold flex items-center gap-1 text-lg ${
                                  difference === 0 
                                    ? 'text-slate-600' 
                                    : difference && difference > 0 
                                      ? 'text-green-600' 
                                      : 'text-red-600'
                                }`}>
                                  {difference !== null && difference !== 0 && (
                                    difference > 0 
                                      ? <TrendingUp className="w-4 h-4" />
                                      : <TrendingDown className="w-4 h-4" />
                                  )}
                                  {difference !== null ? (
                                    `${difference >= 0 ? '+' : ''}${formatPrice(difference)}`
                                  ) : 'N/A'}
                                </p>
                              </div>
                            </div>

                           {/* Expenses List */}
                           {(shiftSummaries[request.id]?.expensesList?.length ?? 0) > 0 && (
                              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                                <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
                                  <TrendingDown className="w-4 h-4" />
                                  Expenses Generated During This Shift ({shiftSummaries[request.id]?.expensesList?.length})
                                </p>
                                <div className="space-y-2">
                                  {shiftSummaries[request.id]?.expensesList?.map((expense) => (
                                    <div
                                      key={expense.id}
                                      className="flex justify-between items-start p-2 bg-white dark:bg-slate-800 rounded border border-red-200 dark:border-red-800"
                                    >
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                                          {expense.name}
                                        </p>
                                        {expense.notes && (
                                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {expense.notes}
                                          </p>
                                        )}
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                          {formatDate(expense.created_at)} • {expense.category}
                                        </p>
                                      </div>
                                      <p className="text-sm font-bold text-red-600 dark:text-red-400 ml-3">
                                        - {formatPrice(expense.amount)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                                      Total Expenses:
                                    </span>
                                    <span className="text-lg font-black text-red-600 dark:text-red-400">
                                      {formatPrice(shiftSummaries[request.id].cashExpenses.total)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* For opening requests, show simple amount */}
                    {isOpening && (
                      <div className="p-4 bg-[#259783]/10 dark:bg-[#259783]/20 rounded-xl">
                        <p className="text-sm text-muted-foreground mb-1">Submitted Amount</p>
                        <p className="text-2xl font-black text-[#259783]">{formatPrice(request.amount)}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {request.user_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="text-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</p>
                        <p className="text-slate-700 dark:text-slate-300">
                          {request.notes}
                        </p>
                      </div>
                    )}

                    {/* Denomination Breakdown */}
                    {denomBreakdown.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                          className="text-sm text-[#259783] hover:underline flex items-center gap-1"
                        >
                          <Banknote className="w-4 h-4" />
                          {isExpanded ? 'Hide' : 'Show'} denomination breakdown
                        </button>
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              {denomBreakdown.map(({ denom, count }) => (
                                <div key={denom} className="flex justify-between">
                                  <span className="text-slate-500">{denom}:</span>
                                  <span className="font-semibold">{count} × = {formatPrice(denom * count)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {showReject && (
                      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                        <Label htmlFor={`reject-${request.id}`} className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2 block">
                          Rejection Reason (Optional)
                        </Label>
                        <Input
                          id={`reject-${request.id}`}
                          value={rejectReason[request.id] || ''}
                          onChange={(e) => setRejectReason({ ...rejectReason, [request.id]: e.target.value })}
                          placeholder="Why is this request being rejected?"
                          className="mb-3"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowRejectDialog({ ...showRejectDialog, [request.id]: false });
                              setRejectReason({ ...rejectReason, [request.id]: '' });
                            }}
                            disabled={isProcessing}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Confirm Reject'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!showReject && (
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => setShowRejectDialog({ ...showRejectDialog, [request.id]: true })}
                        disabled={isProcessing}
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
}
