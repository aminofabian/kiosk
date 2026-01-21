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
} from 'lucide-react';
import type { BalanceApprovalRequest } from '@/lib/db/types';

interface BalanceApprovalRequestWithDetails extends BalanceApprovalRequest {
  user_name: string;
  user_email: string;
  approver_name: string | null;
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
  const [requests, setRequests] = useState<BalanceApprovalRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectDialog, setShowRejectDialog] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/balance/approvals?status=pending');
      const result = await response.json();

      if (result.success) {
        setRequests(result.data || []);
      } else {
        setError(result.message || 'Failed to load approval requests');
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
      } else {
        alert(result.message || 'Failed to approve request');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request');
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
      } else {
        alert(result.message || 'Failed to reject request');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#259783]" />
          <p className="text-slate-500">Loading approval requests...</p>
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

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
          <p className="text-slate-600 font-semibold">No pending approvals</p>
          <p className="text-sm text-slate-400">All balance requests have been processed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Pending Balance Approvals
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {requests.length} request{requests.length !== 1 ? 's' : ''} waiting for approval
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {requests.map((request) => {
          const isProcessing = processingId === request.id;
          const showReject = showRejectDialog[request.id];
          const isExpanded = expandedId === request.id;
          const isOpening = request.balance_type === 'opening';
          const denomBreakdown = getDenominationBreakdown(request);
          const difference = request.expected_amount 
            ? request.amount - request.expected_amount 
            : null;

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

                    <div className="p-4 bg-[#259783]/10 dark:bg-[#259783]/20 rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Submitted Amount</p>
                      <p className="text-2xl font-black text-[#259783]">{formatPrice(request.amount)}</p>
                    </div>

                    {!isOpening && request.expected_amount !== null && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <p className="text-slate-500 dark:text-slate-400 mb-1">Expected Amount</p>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {formatPrice(request.expected_amount)}
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <p className="text-slate-500 dark:text-slate-400 mb-1">Difference</p>
                          <p className={`font-semibold flex items-center gap-1 ${
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
                    )}

                    {request.cash_expenses > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg text-sm">
                        <p className="text-red-700 dark:text-red-300">
                          <span className="font-semibold">Cash Expenses:</span> {formatPrice(request.cash_expenses)}
                        </p>
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
    </div>
  );
}
