'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Clock,
  Loader2,
  Timer,
  Pencil,
  X,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';
import type { Shift } from '@/lib/db/types';
import { ShiftEditForm } from './ShiftEditForm';

interface ShiftWithUser extends Shift {
  cash_expenses?: number;
  opening_denom_1?: number;
  opening_denom_5?: number;
  opening_denom_10?: number;
  opening_denom_20?: number;
  opening_denom_40?: number;
  opening_denom_50?: number;
  opening_denom_100?: number;
  opening_denom_200?: number;
  opening_denom_500?: number;
  opening_denom_1000?: number;
  closing_denom_1?: number;
  closing_denom_5?: number;
  closing_denom_10?: number;
  closing_denom_20?: number;
  closing_denom_40?: number;
  closing_denom_50?: number;
  closing_denom_100?: number;
  closing_denom_200?: number;
  closing_denom_500?: number;
  closing_denom_1000?: number;
  user_name?: string;
}

type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDateStr(timestamp: number): string {
  return toDateStr(new Date(timestamp * 1000));
}

export function ShiftList() {
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingShift, setEditingShift] = useState<ShiftWithUser | null>(null);

  const todayStr = toDateStr(new Date());
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toDateStr(d);
  })();

  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [customDate, setCustomDate] = useState(todayStr);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/shifts', { cache: 'no-store' });
      const result = await response.json();

      if (result.success) {
        setShifts(result.data);
      } else {
        setError(result.message || 'Failed to load shifts');
      }
    } catch (err) {
      setError('Failed to load shifts');
      console.error('Error fetching shifts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const formatPrice = (price: number) =>
    `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatTime = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const formatted = d.toLocaleDateString('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return isToday ? `Today · ${formatted}` : formatted;
  };

  const formatDuration = (start: number, end: number | null) => {
    const now = end || Math.floor(Date.now() / 1000);
    const duration = now - start;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const matchesDatePreset = useCallback(
    (shift: ShiftWithUser) => {
      const shiftDay = shiftDateStr(shift.started_at);
      const now = Math.floor(Date.now() / 1000);

      switch (datePreset) {
        case 'today':
          return shiftDay === todayStr;
        case 'yesterday':
          return shiftDay === yesterdayStr;
        case '7d':
          return shift.started_at >= now - 7 * 24 * 3600;
        case '30d':
          return shift.started_at >= now - 30 * 24 * 3600;
        case 'custom':
          return shiftDay === customDate;
        case 'all':
        default:
          return true;
      }
    },
    [datePreset, customDate, todayStr, yesterdayStr]
  );

  const filteredShifts = useMemo(() => {
    return shifts
      .filter((shift) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!shift.user_name?.toLowerCase().includes(query)) return false;
        }
        if (statusFilter !== 'all' && shift.status !== statusFilter) return false;
        if (!matchesDatePreset(shift)) return false;
        return true;
      })
      .sort((a, b) => b.started_at - a.started_at);
  }, [shifts, searchQuery, statusFilter, matchesDatePreset]);

  const summary = useMemo(() => {
    const open = filteredShifts.filter((s) => s.status === 'open').length;
    const closed = filteredShifts.filter((s) => s.status === 'closed').length;
    const withDiff = filteredShifts.filter(
      (s) => s.cash_difference !== null && s.cash_difference !== 0
    );
    const totalDiff = filteredShifts.reduce((sum, s) => sum + (s.cash_difference || 0), 0);
    return { open, closed, withDiff: withDiff.length, totalDiff, total: filteredShifts.length };
  }, [filteredShifts]);

  const goPrevCustomDay = () => {
    const d = new Date(customDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setCustomDate(toDateStr(d));
    setDatePreset('custom');
  };

  const goNextCustomDay = () => {
    const d = new Date(customDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = toDateStr(d);
    if (next > todayStr) return;
    setCustomDate(next);
    setDatePreset('custom');
  };

  const datePresets: { id: DatePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: 'all', label: 'All' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading shifts…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-red-500 mb-3" />
          <p className="text-red-700 dark:text-red-400 font-semibold">{error}</p>
          <Button onClick={fetchShifts} variant="outline" size="sm" className="mt-4">
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Showing</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Open</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{summary.open}</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Closed</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.closed}</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Net variance</p>
          <p
            className={`text-lg font-bold tabular-nums ${
              summary.totalDiff > 0
                ? 'text-blue-600'
                : summary.totalDiff < 0
                  ? 'text-red-600'
                  : 'text-slate-900 dark:text-white'
            }`}
          >
            {summary.totalDiff >= 0 ? '+' : ''}
            {formatPrice(summary.totalDiff)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search cashier…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white dark:bg-slate-900"
            />
          </div>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={goPrevCustomDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={customDate}
                max={todayStr}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="h-10 w-[150px] bg-white dark:bg-slate-900"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={goNextCustomDay}
                disabled={customDate >= todayStr}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {datePresets.map((p) => (
            <Button
              key={p.id}
              variant={datePreset === p.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDatePreset(p.id)}
              className={
                datePreset === p.id
                  ? 'h-8 bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'h-8 bg-white dark:bg-slate-900'
              }
            >
              {p.label}
            </Button>
          ))}
          <Button
            variant={datePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setDatePreset('custom');
              setCustomDate(todayStr);
            }}
            className={
              datePreset === 'custom'
                ? 'h-8 bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'h-8 bg-white dark:bg-slate-900'
            }
          >
            Pick day
          </Button>

          <span className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          {(['all', 'open', 'closed'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={
                statusFilter === status
                  ? status === 'open'
                    ? 'h-8 bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'h-8 bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600'
                  : 'h-8 bg-white dark:bg-slate-900'
              }
            >
              {status === 'all' ? 'All status' : status === 'open' ? 'Open' : 'Closed'}
            </Button>
          ))}

          {(searchQuery || statusFilter !== 'all' || datePreset !== '7d') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-slate-500 ml-auto"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDatePreset('7d');
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {datePreset === 'custom' && (
          <p className="text-xs text-slate-500">{formatDateLabel(customDate)}</p>
        )}
      </div>

      {/* Table */}
      <Card className="border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {filteredShifts.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-medium text-slate-900 dark:text-white">No shifts found</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {searchQuery || statusFilter !== 'all' || datePreset !== 'all'
                  ? 'Try adjusting filters or pick a wider date range.'
                  : 'Shifts appear here when cashiers open a register session.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
              <table className="w-full text-sm min-w-[880px]">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Cashier
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                      Duration
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Opening
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                      Expected
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Actual
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Diff
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                      {' '}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredShifts.map((shift) => {
                    const isOpen = shift.status === 'open';
                    const hasDifference =
                      shift.cash_difference !== null && shift.cash_difference !== 0;
                    const isPositive = shift.cash_difference !== null && shift.cash_difference > 0;
                    const isNegative = shift.cash_difference !== null && shift.cash_difference < 0;

                    return (
                      <tr
                        key={shift.id}
                        className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors cursor-pointer ${
                          isOpen ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                        }`}
                        onClick={() => setEditingShift(shift)}
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                                isOpen
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400 dark:bg-slate-600'
                              }`}
                            >
                              {shift.user_name ? getInitials(shift.user_name) : <User className="w-4 h-4" />}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white truncate">
                              {shift.user_name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <p className="text-slate-900 dark:text-white">
                            {shiftDateStr(shift.started_at)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatTime(shift.started_at)}
                            {shift.ended_at ? ` – ${formatTime(shift.ended_at)}` : ''}
                          </p>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Timer className="w-3.5 h-3.5 text-slate-400" />
                            {formatDuration(shift.started_at, shift.ended_at)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {formatPrice(shift.opening_cash)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300 hidden lg:table-cell">
                          {formatPrice(shift.expected_closing_cash)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium tabular-nums">
                          {shift.actual_closing_cash !== null ? (
                            formatPrice(shift.actual_closing_cash)
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums">
                          {shift.cash_difference !== null ? (
                            <span
                              className={`font-semibold ${
                                !hasDifference
                                  ? 'text-emerald-600'
                                  : isPositive
                                    ? 'text-blue-600'
                                    : isNegative
                                      ? 'text-red-600'
                                      : 'text-slate-600'
                              }`}
                            >
                              {shift.cash_difference >= 0 ? '+' : ''}
                              {formatPrice(shift.cash_difference)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isOpen ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-2">
                              <PlayCircle className="w-3 h-3 mr-1" />
                              Open
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] h-5 px-2">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Closed
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingShift(shift);
                            }}
                            aria-label="Edit shift"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer
        open={editingShift !== null}
        onOpenChange={(open) => !open && setEditingShift(null)}
        direction="right"
      >
        <DrawerContent className="!w-full sm:!w-[520px] md:!w-[560px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
          <DrawerHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Pencil className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <DrawerTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Edit shift
                </DrawerTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {editingShift?.user_name || 'Unknown'} ·{' '}
                  {editingShift ? shiftDateStr(editingShift.started_at) : ''}
                </p>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="p-5 overflow-y-auto flex-1">
            {editingShift && (
              <ShiftEditForm
                shift={editingShift}
                onSuccess={() => {
                  setEditingShift(null);
                  fetchShifts();
                }}
                onCancel={() => setEditingShift(null)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
