'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  AlertCircle,
  Search,
  Package,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowRight,
  Hash,
  FileText,
  User,
} from 'lucide-react';
import { ADJUSTMENT_REASONS, type AdjustmentReason } from '@/lib/constants';
import { toast } from 'sonner';

interface Adjustment {
  id: string;
  item_id: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  reason: AdjustmentReason;
  notes: string | null;
  adjusted_by: string;
  created_at: number;
  item_name: string;
  item_unit_type: string;
  adjusted_by_name: string;
  estimated_cost: number;
  is_loss: boolean;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const REASON_LABELS: Record<AdjustmentReason, string> = {
  restock: 'Restock',
  spoilage: 'Spoilage',
  theft: 'Theft',
  counting_error: 'Counting Error',
  damage: 'Damage',
  other: 'Other',
};

const REASON_COLORS: Record<AdjustmentReason, string> = {
  restock: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300',
  spoilage: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-300',
  theft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300',
  counting_error: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300',
  damage: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-300',
};

const formatPrice = (price: number) =>
  `KES ${Math.abs(price).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const toTimestamp = (dateStr: string, endOfDay = false) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return String(Math.floor(date.getTime() / 1000));
};

export function StockAdjustmentList() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [detail, setDetail] = useState<Adjustment | null>(null);
  const [reverseTarget, setReverseTarget] = useState<Adjustment | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (reason && reason !== 'all') params.set('reason', reason);
      if (search.trim()) params.set('search', search.trim());
      if (startDate) params.set('start', toTimestamp(startDate));
      if (endDate) params.set('end', toTimestamp(endDate, true));

      const response = await fetch(`/api/stock/adjustments?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setAdjustments(result.data || []);
        setPagination(result.pagination || { total: 0, page, limit, totalPages: 0 });
      } else {
        setError(result.message || 'Failed to load adjustments');
      }
    } catch (err) {
      console.error('Error fetching adjustments:', err);
      setError('Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [page, limit, reason, search, startDate, endDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchAdjustments();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, reason, startDate, endDate, limit]);

  useEffect(() => {
    fetchAdjustments();
  }, [page, fetchAdjustments]);

  const handleReverse = async () => {
    if (!reverseTarget) return;
    try {
      setReversingId(reverseTarget.id);
      const response = await fetch(`/api/stock/adjustments/${reverseTarget.id}/reverse`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        toast.success('Adjustment reversed');
        setReverseTarget(null);
        await fetchAdjustments();
      } else {
        toast.error(result.message || 'Failed to reverse adjustment');
      }
    } catch (err) {
      console.error('Error reversing adjustment:', err);
      toast.error('Failed to reverse adjustment');
    } finally {
      setReversingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatStock = (value: number) => `${value.toFixed(2)}`;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm border-slate-200 dark:border-slate-700"
              />
            </div>

            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-[180px] h-9 text-sm border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="All reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reasons</SelectItem>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-36 text-sm border-slate-200 dark:border-slate-700"
              />
              <span className="text-slate-400 text-sm">→</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-36 text-sm border-slate-200 dark:border-slate-700"
              />
            </div>

            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[100px] h-9 text-sm border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="25" />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading / Error / Empty */}
      {loading && adjustments.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
            <p className="text-slate-500">Loading adjustments...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
            <p className="text-red-600">{error}</p>
            <Button onClick={fetchAdjustments} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && adjustments.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-3">
            <Package className="h-12 w-12 mx-auto text-slate-300" />
            <p className="text-slate-600 font-semibold">No adjustments found</p>
            <p className="text-sm text-slate-400">Try changing filters or date range</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && adjustments.length > 0 && (
        <Card className="bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Date</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Item</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Reason</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">System → Actual</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Diff</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Est. Cost / Loss</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Adjusted By</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adj) => (
                    <tr
                      key={adj.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(adj.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/items/${adj.item_id}`}
                          className="font-bold text-xs text-[#1c6a1e] hover:underline"
                        >
                          {adj.item_name}
                        </Link>
                        <p className="text-[10px] text-slate-500">{adj.item_unit_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${REASON_COLORS[adj.reason]}`}>
                          {REASON_LABELS[adj.reason]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-400">
                        {formatStock(adj.system_stock)} → {formatStock(adj.actual_stock)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs font-bold ${
                            adj.difference > 0
                              ? 'text-green-600'
                              : adj.difference < 0
                              ? 'text-red-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {adj.difference > 0 ? '+' : ''}
                          {formatStock(adj.difference)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {adj.is_loss && adj.estimated_cost > 0 ? (
                          <span className="text-xs font-bold text-red-600">-{formatPrice(adj.estimated_cost)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {adj.adjusted_by_name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-[#1c6a1e]"
                            onClick={() => setDetail(adj)}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                            onClick={() => setReverseTarget(adj)}
                            title="Reverse adjustment"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} -
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Adjustment Details</DialogTitle>
            <DialogDescription className="text-xs">
              {detail && formatDate(detail.created_at)}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Item</span>
                <Link
                  href={`/admin/items/${detail.item_id}`}
                  className="font-bold text-[#1c6a1e] hover:underline"
                >
                  {detail.item_name}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reason</span>
                <Badge variant="outline" className={`text-[10px] ${REASON_COLORS[detail.reason]}`}>
                  {REASON_LABELS[detail.reason]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Stock change</span>
                <span className="font-semibold">
                  {formatStock(detail.system_stock)} → {formatStock(detail.actual_stock)} ({detail.difference > 0 ? '+' : ''}
                  {formatStock(detail.difference)})
                </span>
              </div>
              {detail.is_loss && detail.estimated_cost > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Est. loss</span>
                  <span className="font-bold text-red-600">-{formatPrice(detail.estimated_cost)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Adjusted by</span>
                <span className="text-slate-700 dark:text-slate-300">{detail.adjusted_by_name}</span>
              </div>
              {detail.notes && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{detail.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <Hash className="w-3 h-3" />
                {detail.id}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setReverseTarget(detail);
                  setDetail(null);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reverse
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Confirmation Dialog */}
      <Dialog open={!!reverseTarget} onOpenChange={(open) => !open && setReverseTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-red-500" />
              Reverse Adjustment
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will create a counter-adjustment to undo the stock change.
            </DialogDescription>
          </DialogHeader>
          {reverseTarget && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">What will happen:</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>
                    A new adjustment of{' '}
                    <strong>
                      {reverseTarget.difference > 0 ? '-' : '+'}
                      {formatStock(Math.abs(reverseTarget.difference))} {reverseTarget.item_unit_type}
                    </strong>{' '}
                    will be recorded.
                  </li>
                  <li>It will be logged with reason &quot;Other&quot; and a reversal note.</li>
                  <li>Existing batches will be updated by FIFO.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Item</span>
                <span className="font-bold">{reverseTarget.item_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Original change</span>
                <span>
                  {formatStock(reverseTarget.system_stock)} → {formatStock(reverseTarget.actual_stock)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReverseTarget(null)} disabled={!!reversingId}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleReverse} disabled={!!reversingId}>
              {reversingId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Confirm Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
