'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { PaymentMethod } from '@/lib/constants';

interface Sale {
  id: string;
  sale_date: number;
  total_amount: number;
  payment_method: PaymentMethod;
  customer_name: string | null;
  user_name: string | null;
  items_count: number;
}

export function SalesReport() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('all');

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate, paymentMethod]);

  async function fetchSales() {
    try {
      setLoading(true);
      const startTimestamp = Math.floor(
        new Date(startDate).getTime() / 1000
      );
      const endTimestamp = Math.floor(
        new Date(endDate + 'T23:59:59').getTime() / 1000
      );

      const params = new URLSearchParams({
        start: startTimestamp.toString(),
        end: endTimestamp.toString(),
      });

      if (paymentMethod !== 'all') {
        params.append('paymentMethod', paymentMethod);
      }

      const response = await fetch(`/api/reports/sales?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSales(result.data);
      } else {
        setError(result.message || 'Failed to load sales');
      }
    } catch (err) {
      setError('Failed to load sales');
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  }

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

  const getPaymentBadgeVariant = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return 'default';
      case 'mpesa':
        return 'secondary';
      case 'credit':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading sales...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-destructive font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  const totalSales = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start Date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Date</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchSales} size="touch" className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-bold">{formatPrice(totalSales)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Number of Sales</p>
              <p className="text-2xl font-bold">{sales.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          {sales.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No sales found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-semibold">Date</th>
                    <th className="text-left p-4 font-semibold">Cashier</th>
                    <th className="text-left p-4 font-semibold">Items</th>
                    <th className="text-left p-4 font-semibold">Customer</th>
                    <th className="text-left p-4 font-semibold">Payment</th>
                    <th className="text-right p-4 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-t hover:bg-muted/50">
                      <td className="p-4 text-sm">{formatDate(sale.sale_date)}</td>
                      <td className="p-4 text-sm">
                        {sale.user_name || 'Unknown'}
                      </td>
                      <td className="p-4 text-sm">{sale.items_count} items</td>
                      <td className="p-4 text-sm">
                        {sale.customer_name || (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant={getPaymentBadgeVariant(sale.payment_method)}>
                          {sale.payment_method}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-semibold">
                        {formatPrice(sale.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

