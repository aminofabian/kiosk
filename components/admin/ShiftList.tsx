'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Pencil, 
  X,
  User,
  Calendar,
  Banknote,
  CheckCircle2,
  PlayCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';
import type { Shift } from '@/lib/db/types';
import { SearchFilterSection } from './SearchFilterSection';
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

export function ShiftList() {
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const [editingShift, setEditingShift] = useState<ShiftWithUser | null>(null);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shifts');
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

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: number, end: number | null) => {
    const now = end || Math.floor(Date.now() / 1000);
    const duration = now - start;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const formatDateForFilter = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  const filteredShifts = useMemo(() => {
    return shifts
      .filter((shift) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (
            !shift.user_name?.toLowerCase().includes(query) &&
            !formatDateForFilter(shift.started_at).toLowerCase().includes(query)
          ) {
            return false;
          }
        }
        if (statusFilter !== 'all' && shift.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'duration') {
          const aDuration = a.ended_at ? a.ended_at - a.started_at : 0;
          const bDuration = b.ended_at ? b.ended_at - b.started_at : 0;
          return bDuration - aDuration;
        }
        return b.started_at - a.started_at;
      });
  }, [shifts, searchQuery, statusFilter, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/30">
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg animate-bounce">
              <Clock className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Loading shifts...</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Please wait a moment</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 rounded-3xl flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{error}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please try refreshing the page</p>
          </div>
          <Button onClick={fetchShifts} variant="outline" className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg shadow-emerald-500/20">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <PlayCircle className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{shifts.filter(s => s.status === 'open').length}</p>
          <p className="text-emerald-100 text-sm">Active Shifts</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-500 to-zinc-600 p-4 text-white shadow-lg shadow-slate-500/20">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CheckCircle2 className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{shifts.filter(s => s.status === 'closed').length}</p>
          <p className="text-slate-200 text-sm">Closed Shifts</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-white shadow-lg shadow-blue-500/20">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Wallet className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">
            {formatPrice(shifts.reduce((sum, s) => sum + s.opening_cash, 0)).replace('KES ', '')}
          </p>
          <p className="text-blue-100 text-sm">Total Opening</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 p-4 text-white shadow-lg shadow-purple-500/20">
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Banknote className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">
            {formatPrice(shifts.reduce((sum, s) => sum + (s.actual_closing_cash || 0), 0)).replace('KES ', '')}
          </p>
          <p className="text-purple-100 text-sm">Total Closing</p>
        </div>
      </div>

      <SearchFilterSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by cashier name or date..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            options: [
              { value: 'all', label: 'All Status' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        sortOptions={[
          { value: 'date', label: 'Sort by Date (Newest)' },
          { value: 'duration', label: 'Sort by Duration' },
        ]}
        sortValue={sortBy}
        onSortChange={(v) => setSortBy(v as 'date' | 'duration')}
      />

      {filteredShifts.length === 0 ? (
        <div className="flex items-center justify-center h-80">
          <div className="text-center space-y-6 max-w-md">
            <div className="relative">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center">
                <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-700 dark:text-slate-200">No shifts found</p>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters to see more results'
                  : 'Shifts will appear here once cashiers start their work sessions'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShifts.map((shift) => {
            const isOpen = shift.status === 'open';
            const hasDifference = shift.cash_difference !== null && shift.cash_difference !== 0;
            const isPositive = shift.cash_difference !== null && shift.cash_difference > 0;
            const isNegative = shift.cash_difference !== null && shift.cash_difference < 0;
            const cashEarned = (shift.actual_closing_cash || shift.expected_closing_cash) - shift.opening_cash;

            return (
              <div
                key={shift.id}
                className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all duration-300 hover:shadow-xl ${
                  isOpen
                    ? 'border-emerald-400 dark:border-emerald-500 hover:shadow-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:shadow-slate-500/10'
                }`}
              >
                {/* Gradient accent for open shifts */}
                {isOpen && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
                )}

                <div className="p-5">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      {/* User Avatar */}
                      <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                        isOpen 
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/30' 
                          : 'bg-gradient-to-br from-slate-400 to-slate-600 shadow-slate-500/20'
                      }`}>
                        {shift.user_name ? getInitials(shift.user_name) : <User className="w-6 h-6" />}
                        {isOpen && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                            {shift.user_name || 'Unknown User'}
                          </h3>
                          <Badge
                            className={`font-medium ${
                              isOpen
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {isOpen ? (
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                Active
                              </span>
                            ) : (
                              'Closed'
                            )}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {formatShortDate(shift.started_at)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {formatTime(shift.started_at)}
                            {shift.ended_at && (
                              <span className="text-slate-400"> → {formatTime(shift.ended_at)}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Timer className="w-4 h-4" />
                            {formatDuration(shift.started_at, shift.ended_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity border-2 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 dark:hover:bg-indigo-900/20"
                      onClick={() => setEditingShift(shift)}
                      aria-label="Edit shift"
                    >
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Edit
                    </Button>
                  </div>

                  {/* Cash Summary Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Opening Cash */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 border border-blue-100 dark:border-blue-800/50">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                        </div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Opening</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatPrice(shift.opening_cash)}
                      </p>
                    </div>

                    {/* Expected Cash */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-4 border border-purple-100 dark:border-purple-800/50">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center">
                          <DollarSign className="w-3.5 h-3.5 text-white" />
                        </div>
                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Expected</p>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatPrice(shift.expected_closing_cash)}
                      </p>
                    </div>

                    {/* Actual Closing / Current */}
                    {shift.actual_closing_cash !== null ? (
                      <>
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 border border-emerald-100 dark:border-emerald-800/50">
                          <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                              <ArrowDownRight className="w-3.5 h-3.5 text-white" />
                            </div>
                            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Actual</p>
                          </div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {formatPrice(shift.actual_closing_cash)}
                          </p>
                        </div>

                        {/* Difference */}
                        <div className={`relative overflow-hidden rounded-xl p-4 border ${
                          !hasDifference
                            ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-100 dark:border-green-800/50'
                            : isPositive
                            ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-100 dark:border-blue-800/50'
                            : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-100 dark:border-red-800/50'
                        }`}>
                          <div className={`absolute top-0 right-0 w-12 h-12 rounded-full -translate-y-1/2 translate-x-1/2 ${
                            !hasDifference ? 'bg-green-500/10' : isPositive ? 'bg-blue-500/10' : 'bg-red-500/10'
                          }`} />
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              !hasDifference
                                ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                                : isPositive
                                ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                                : 'bg-gradient-to-br from-red-400 to-rose-500'
                            }`}>
                              {isPositive ? (
                                <TrendingUp className="w-3.5 h-3.5 text-white" />
                              ) : isNegative ? (
                                <TrendingDown className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              )}
                            </div>
                            <p className={`text-xs font-medium ${
                              !hasDifference
                                ? 'text-green-600 dark:text-green-400'
                                : isPositive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {!hasDifference ? 'Balanced' : 'Difference'}
                            </p>
                          </div>
                          <p className={`text-lg font-bold ${
                            !hasDifference
                              ? 'text-green-600 dark:text-green-400'
                              : isPositive
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {shift.cash_difference !== null && (shift.cash_difference >= 0 ? '+' : '')}
                            {shift.cash_difference !== null && formatPrice(shift.cash_difference)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 border border-amber-100 dark:border-amber-800/50">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Cash Earned So Far</p>
                        </div>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                          +{formatPrice(Math.max(0, cashEarned))}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Shift Drawer */}
      <Drawer
        open={editingShift !== null}
        onOpenChange={(open) => !open && setEditingShift(null)}
        direction="right"
      >
        <DrawerContent className="!w-full sm:!w-[520px] md:!w-[560px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800">
          <DrawerHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white">Edit Shift</DrawerTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingShift?.user_name || 'Unknown User'}
                </p>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="p-6 overflow-y-auto flex-1">
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
