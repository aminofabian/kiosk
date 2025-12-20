'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProfitData {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  byItem: Array<{
    item_id: string;
    item_name: string;
    quantity_sold: number;
    total_sales: number;
    total_cost: number;
    total_profit: number;
    profit_margin: number;
  }>;
  byCategory: Array<{
    category_id: string;
    category_name: string;
    total_sales: number;
    total_cost: number;
    total_profit: number;
    profit_margin: number;
  }>;
}

export function ProfitReport() {
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [viewBy, setViewBy] = useState<'item' | 'category'>('item');

  useEffect(() => {
    fetchProfitData();
  }, [startDate, endDate, viewBy]);

  async function fetchProfitData() {
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
        viewBy,
      });

      const response = await fetch(`/api/reports/profit?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load profit data');
      }
    } catch (err) {
      setError('Failed to load profit data');
      console.error('Error fetching profit:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading profit data...</p>
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

  if (!data) {
    return null;
  }

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
              <Label htmlFor="view">View By</Label>
              <Select value={viewBy} onValueChange={(v) => setViewBy(v as 'item' | 'category')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="item">By Item</SelectItem>
                  <SelectItem value="category">By Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchProfitData} size="touch" className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Sales</div>
            <div className="text-2xl font-bold mt-1">{formatPrice(data.totalSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Cost</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {formatPrice(data.totalCost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Profit</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {formatPrice(data.totalProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Profit Margin</div>
            <div className="text-2xl font-bold mt-1">
              {formatPercent(data.profitMargin)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">
              Profit {viewBy === 'item' ? 'by Item' : 'by Category'}
            </h3>
          </div>
          {viewBy === 'item' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-semibold">Item</th>
                    <th className="text-right p-4 font-semibold">Qty Sold</th>
                    <th className="text-right p-4 font-semibold">Sales</th>
                    <th className="text-right p-4 font-semibold">Cost</th>
                    <th className="text-right p-4 font-semibold">Profit</th>
                    <th className="text-right p-4 font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byItem.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted-foreground">
                        No sales data for this period
                      </td>
                    </tr>
                  ) : (
                    data.byItem.map((item) => (
                      <tr key={item.item_id} className="border-t hover:bg-muted/50">
                        <td className="p-4 font-medium">{item.item_name}</td>
                        <td className="p-4 text-right">{item.quantity_sold.toFixed(2)}</td>
                        <td className="p-4 text-right">{formatPrice(item.total_sales)}</td>
                        <td className="p-4 text-right text-orange-600">
                          {formatPrice(item.total_cost)}
                        </td>
                        <td
                          className={`p-4 text-right font-semibold ${
                            item.total_profit >= 0 ? 'text-emerald-600' : 'text-destructive'
                          }`}
                        >
                          {formatPrice(item.total_profit)}
                        </td>
                        <td className="p-4 text-right">{formatPercent(item.profit_margin)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-semibold">Category</th>
                    <th className="text-right p-4 font-semibold">Sales</th>
                    <th className="text-right p-4 font-semibold">Cost</th>
                    <th className="text-right p-4 font-semibold">Profit</th>
                    <th className="text-right p-4 font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-muted-foreground">
                        No sales data for this period
                      </td>
                    </tr>
                  ) : (
                    data.byCategory.map((category) => (
                      <tr key={category.category_id} className="border-t hover:bg-muted/50">
                        <td className="p-4 font-medium">
                          {category.category_name || 'Uncategorized'}
                        </td>
                        <td className="p-4 text-right">{formatPrice(category.total_sales)}</td>
                        <td className="p-4 text-right text-orange-600">
                          {formatPrice(category.total_cost)}
                        </td>
                        <td
                          className={`p-4 text-right font-semibold ${
                            category.total_profit >= 0
                              ? 'text-emerald-600'
                              : 'text-destructive'
                          }`}
                        >
                          {formatPrice(category.total_profit)}
                        </td>
                        <td className="p-4 text-right">
                          {formatPercent(category.profit_margin)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

