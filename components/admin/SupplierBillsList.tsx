'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Receipt,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
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

  useEffect(() => {
    fetchBills();
    // Auto-refresh every 30 seconds to update overdue status
    const interval = setInterval(fetchBills, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchBills = async () => {
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
  };


  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  const filteredBills = bills.filter((bill) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') {
      const daysUntilDue = getDaysUntilDue(bill.due_date);
      return bill.status === 'pending' && daysUntilDue >= 0;
    }
    if (statusFilter === 'overdue') {
      const daysUntilDue = getDaysUntilDue(bill.due_date);
      return bill.status === 'overdue' || (bill.status === 'pending' && daysUntilDue < 0);
    }
    return bill.status === statusFilter;
  });

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
                          <p className="text-slate-500 dark:text-slate-400 mb-1">Created By</p>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            {bill.creator_name}
                          </p>
                        </div>
                        {bill.payment_date && (
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1">Paid On</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">
                              {formatDate(bill.payment_date)}
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
                    </div>
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
