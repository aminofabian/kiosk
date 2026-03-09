'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/utils/api-client';
import {
  ScrollText,
  Loader2,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const ENTITY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'stock', label: 'Stock' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'item', label: 'Item' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'supplier_bill', label: 'Supplier Bill' },
  { value: 'category', label: 'Category' },
  { value: 'expense', label: 'Expense' },
  { value: 'shift', label: 'Shift' },
  { value: 'sale', label: 'Sale' },
] as const;

type DatePreset = 'today' | 'yesterday' | 'past3' | 'week' | 'month' | 'all';

function getDateRangeForPreset(preset: DatePreset): { from: number; to: number } | null {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  if (preset === 'all') return null;

  if (preset === 'today') {
    return {
      from: Math.floor(todayStart.getTime() / 1000),
      to: Math.floor(todayEnd.getTime() / 1000),
    };
  }

  if (preset === 'yesterday') {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);
    return {
      from: Math.floor(yesterdayStart.getTime() / 1000),
      to: Math.floor(yesterdayEnd.getTime() / 1000),
    };
  }

  if (preset === 'past3') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 2);
    return {
      from: Math.floor(start.getTime() / 1000),
      to: Math.floor(todayEnd.getTime() / 1000),
    };
  }

  if (preset === 'week') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return {
      from: Math.floor(start.getTime() / 1000),
      to: Math.floor(todayEnd.getTime() / 1000),
    };
  }

  if (preset === 'month') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 29);
    return {
      from: Math.floor(start.getTime() / 1000),
      to: Math.floor(todayEnd.getTime() / 1000),
    };
  }

  return null;
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'past3', label: 'Past 3 days' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past 30 days' },
  { value: 'all', label: 'All time' },
];

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityNameSnapshot: string | null;
  details: Record<string, unknown> | null;
  performedBy: string;
  performerName: string | null;
  createdAt: number;
}

interface ActivityLogData {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString('en-KE', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  });
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDetailsSummary(details: Record<string, unknown> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  if (typeof details.quantity === 'number') parts.push(`qty: ${details.quantity}`);
  if (typeof details.amount === 'number') parts.push(`KES ${details.amount.toLocaleString()}`);
  if (typeof details.reason === 'string') parts.push(details.reason);
  if (typeof details.difference === 'number') parts.push(`Δ ${details.difference}`);
  if (typeof details.itemCount === 'number') parts.push(`${details.itemCount} items`);
  return parts.join(' · ');
}

export default function LogsPage() {
  const [entityType, setEntityType] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [data, setData] = useState<ActivityLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      const dateRange = getDateRangeForPreset(datePreset);
      if (dateRange) {
        params.set('from', String(dateRange.from));
        params.set('to', String(dateRange.to));
      }
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const result = await apiGet<ActivityLogData>(`/api/activity-log?${params.toString()}`);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load activity log');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [entityType, datePreset, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const hasMore = offset + items.length < total;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a1208]">
        {/* Mobile Header */}
        <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-[#0f1a0d] safe-area-top">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <ScrollText className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Activity Log
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Stock, suppliers, items & more
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <ScrollText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Activity Log
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Audit trail for stock updates, supplier changes, and more
                  </p>
                </div>
              </div>
              <Button
                onClick={() => fetchData()}
                size="sm"
                variant="outline"
                className="h-9"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-1.5">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 md:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1a0d]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Filters
              </span>
            </div>
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value as DatePreset);
                setOffset(0);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              {DATE_PRESETS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setOffset(0);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              {ENTITY_TYPES.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button
              onClick={() => fetchData()}
              size="sm"
              variant="ghost"
              className="h-9 md:hidden"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-4 pb-24 md:pb-6 max-w-5xl mx-auto">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No activity yet</p>
              <p className="text-sm mt-1">
                Activity will appear here when stock, suppliers, items, and other data are updated.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                        {item.action}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.entityType}
                      </span>
                      {item.entityNameSnapshot && (
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {item.entityNameSnapshot}
                        </span>
                      )}
                    </div>
                    {item.details && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {formatDetailsSummary(item.details)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span>{item.performerName || 'Unknown'}</span>
                    <span title={formatDateTime(item.createdAt)}>
                      {formatDate(item.createdAt)} {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0 || loading}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasMore || loading}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
