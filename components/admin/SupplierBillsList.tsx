'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Receipt,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import type { SupplierBill } from '@/lib/db/types';

interface SupplierBillWithDetails extends SupplierBill {
  creator_name: string;
  creator_email: string;
  payer_name: string | null;
}

export function SupplierBillsList() {
  const [bills, setBills] = useState<SupplierBillWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [markAsPaidDialog, setMarkAsPaidDialog] = useState<{
    open: boolean;
    bill: SupplierBillWithDetails | null;
  }>({ open: false, bill: null });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? '/api/supplier-bills?includeOverdue=true'
        : `/api/supplier-bills?status=${statusFilter}`;
      const result = await apiGet<SupplierBillWithDetails[]>(url);
      if (result.success) {
        setBills(result.data || []);
      } else {
        setError(result.message || 'Failed to load bills');
      }
    } catch (err) {
      setError('Failed to load bills');
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBills();
    // Auto-refresh every 30 seconds to update overdue status
    const interval = setInterval(fetchBills, 30000);
    return () => clearInterval(interval);
  }, [fetchBills]);

  const handleMarkAsPaid = (bill: SupplierBillWithDetails) => {
    setPaymentMethod('');
    setPaymentNotes('');
    setMarkAsPaidDialog({ open: true, bill });
  };

  const handleConfirmMarkAsPaid = async () => {
    if (!markAsPaidDialog.bill) return;

    setIsMarkingAsPaid(true);
    try {
      const result = await apiPost(
        `/api/supplier-bills/${markAsPaidDialog.bill.id}/pay`,
        {
          paymentMethod: paymentMethod.trim() || null,
          paymentNotes: paymentNotes.trim() || null,
        }
      );

      if (result.success) {
        setMarkAsPaidDialog({ open: false, bill: null });
        setPaymentMethod('');
        setPaymentNotes('');
        // Refresh the bills list
        await fetchBills();
      } else {
        setError(result.message || 'Failed to mark bill as paid');
      }
    } catch (err) {
      console.error('Error marking bill as paid:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsMarkingAsPaid(false);
    }
  };


  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isDateInRange = (timestamp: number, range: string): boolean => {
    const now = Math.floor(Date.now() / 1000);
    const billDate = timestamp;
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayEnd = todayStart + 86400; // 24 hours in seconds

    switch (range) {
      case 'today':
        return billDate >= todayStart && billDate < todayEnd;
      case 'yesterday': {
        const yesterdayStart = todayStart - 86400;
        const yesterdayEnd = todayStart;
        return billDate >= yesterdayStart && billDate < yesterdayEnd;
      }
      case 'this_week': {
        const weekStart = todayStart - (new Date().getDay() * 86400);
        return billDate >= weekStart;
      }
      case 'last_week': {
        const weekStart = todayStart - (new Date().getDay() * 86400);
        const lastWeekStart = weekStart - 604800; // 7 days
        return billDate >= lastWeekStart && billDate < weekStart;
      }
      case 'this_month': {
        const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
        return billDate >= monthStart;
      }
      case 'last_month': {
        const thisMonthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
        const lastMonthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime() / 1000);
        return billDate >= lastMonthStart && billDate < thisMonthStart;
      }
      case 'last_7_days':
        return billDate >= (now - 604800); // 7 days ago
      case 'last_30_days':
        return billDate >= (now - 2592000); // 30 days ago
      case 'all':
      default:
        return true;
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0).toLocaleString()}`;
  };

  const getDaysUntilDue = (dueDate: number) => {
    const now = Math.floor(Date.now() / 1000);
    const days = Math.floor((dueDate - now) / (24 * 60 * 60));
    return days;
  };

  const getStatusBadge = (bill: SupplierBillWithDetails) => {
    const daysUntilDue = getDaysUntilDue(bill.due_date);
    
    if (bill.status === 'paid') {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    }
    
    if (bill.status === 'overdue' || daysUntilDue < 0) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    
    if (daysUntilDue <= 3) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600">
          <Clock className="w-3 h-3 mr-1" />
          Due Soon ({daysUntilDue} days)
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600">
        <Calendar className="w-3 h-3 mr-1" />
        Pending ({daysUntilDue} days)
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#259783]" />
          <p className="text-slate-500">Loading supplier bills...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const filteredBills = bills
    .filter((bill) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          const daysUntilDue = getDaysUntilDue(bill.due_date);
          if (!(bill.status === 'pending' && daysUntilDue >= 0)) return false;
        } else if (statusFilter === 'overdue') {
          const daysUntilDue = getDaysUntilDue(bill.due_date);
          if (!(bill.status === 'overdue' || (bill.status === 'pending' && daysUntilDue < 0))) return false;
        } else {
          if (bill.status !== statusFilter) return false;
        }
      }

      // Date filter
      return isDateInRange(bill.created_at, dateFilter);
    })
    .sort((a, b) => b.created_at - a.created_at); // Sort by creation date, newest first

  const totalPending = filteredBills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Supplier Bills
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
            {totalPending > 0 && (
              <span className="ml-2 font-semibold text-orange-600">
                • {formatPrice(totalPending)} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bills</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredBills.length === 0 ? (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold">
              No bills found
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {statusFilter === 'all' 
                ? 'No supplier bills have been created yet'
                : `No ${statusFilter} bills found`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBills.map((bill) => {
            const daysUntilDue = getDaysUntilDue(bill.due_date);
            const isOverdue = bill.status === 'overdue' || daysUntilDue < 0;
            const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0;

            return (
              <Card
                key={bill.id}
                className={`bg-white dark:bg-[#1c2e18] border-2 ${
                  isOverdue
                    ? 'border-red-500 dark:border-red-800'
                    : isDueSoon
                    ? 'border-orange-500 dark:border-orange-800'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
                          <Receipt className="w-5 h-5 text-[#259783]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 dark:text-white">
                            {bill.supplier_name}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {bill.bill_description}
                          </p>
                          {bill.supplier_phone && (
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                              📞 {bill.supplier_phone}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(bill)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 mb-1">Amount</p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {formatPrice(bill.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 mb-1">Due Date</p>
                          <p className={`font-bold ${
                            isOverdue
                              ? 'text-red-600 dark:text-red-400'
                              : isDueSoon
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            {formatDate(bill.due_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 mb-1">Created</p>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDate(bill.created_at)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            by {bill.creator_name}
                          </p>
                        </div>
                        {bill.payment_date ? (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">Paid On</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              {formatDate(bill.payment_date)}
                            </p>
                            {bill.payer_name && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                by {bill.payer_name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">Status</p>
                            <p className="font-semibold text-slate-700 dark:text-slate-300">
                              {bill.status === 'paid' ? 'Paid' : bill.status === 'overdue' ? 'Overdue' : 'Pending'}
                            </p>
                          </div>
                        )}
                      </div>

                      {bill.notes && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {bill.notes}
                          </p>
                        </div>
                      )}

                      {bill.status !== 'paid' && (
                        <div className="pt-2">
                          <Button
                            onClick={() => handleMarkAsPaid(bill)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Mark as Paid
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mark as Paid Dialog */}
      <Dialog
        open={markAsPaidDialog.open}
        onOpenChange={(open) =>
          setMarkAsPaidDialog({ open, bill: open ? markAsPaidDialog.bill : null })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Bill as Paid</DialogTitle>
            <DialogDescription>
              {markAsPaidDialog.bill && (
                <>
                  Mark the bill from <strong>{markAsPaidDialog.bill.supplier_name}</strong> as
                  paid. You can optionally add payment details below.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {markAsPaidDialog.bill && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatPrice(markAsPaidDialog.bill.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Description:</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {markAsPaidDialog.bill.bill_description}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method (Optional)</Label>
              <Input
                id="paymentMethod"
                placeholder="e.g., Cash, M-Pesa, Bank Transfer"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Payment Notes (Optional)</Label>
              <Input
                id="paymentNotes"
                placeholder="Any additional notes about the payment"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMarkAsPaidDialog({ open: false, bill: null })}
              disabled={isMarkingAsPaid}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmMarkAsPaid}
              disabled={isMarkingAsPaid}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isMarkingAsPaid ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Marking as Paid...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
