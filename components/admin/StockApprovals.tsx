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
  Package,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import type { StockApprovalRequest } from '@/lib/db/types';

interface StockApprovalRequestWithDetails extends StockApprovalRequest {
  item_name: string;
  item_unit_type: string;
  item_current_stock: number;
  requester_name: string;
  requester_email: string;
}

const REASON_LABELS: Record<string, string> = {
  restock: 'Restock / New Delivery',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

export function StockApprovals() {
  const [requests, setRequests] = useState<StockApprovalRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectDialog, setShowRejectDialog] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stock/approvals?status=pending');
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
      const response = await fetch(`/api/stock/approvals/${requestId}/approve`, {
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
      const response = await fetch(`/api/stock/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejection_reason: rejectReason[requestId] || null,
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

  const formatStock = (stock: number, unitType: string) => {
    if (stock <= 0) return 'Out of stock';
    return `${stock.toFixed(2)} ${unitType}`;
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
          <p className="text-sm text-slate-400">All stock adjustment requests have been processed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Pending Stock Approvals
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

          return (
            <Card key={request.id} className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#259783]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {request.item_name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {request.adjustment_type === 'increase' ? 'Add' : 'Remove'} {request.quantity.toFixed(2)} {request.item_unit_type}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">Current Stock</p>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatStock(request.item_current_stock, request.item_unit_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">New Stock</p>
                        <p className={`font-semibold ${
                          request.adjustment_type === 'increase' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatStock(
                            request.adjustment_type === 'increase'
                              ? request.item_current_stock + request.quantity
                              : Math.max(0, request.item_current_stock - request.quantity),
                            request.item_unit_type
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {request.requester_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Reason</p>
                        <Badge variant="outline" className="text-xs">
                          {REASON_LABELS[request.reason] || request.reason}
                        </Badge>
                      </div>
                      {request.notes && (
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</p>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {request.notes}
                          </p>
                        </div>
                      )}
                    </div>

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
