'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, Timer, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import type { Shift } from '@/lib/db/types';
import { SearchFilterSection } from './SearchFilterSection';

interface ShiftWithUser extends Shift {
  user_name?: string;
}

export function ShiftList() {
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');

  useEffect(() => {
    async function fetchShifts() {
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
    }

    fetchShifts();
  }, []);

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: number, end: number | null) => {
    if (!end) return 'Ongoing';
    const duration = end - start;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading shifts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No shifts found</p>
            <p className="text-sm text-slate-400">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Shifts will appear here after they are opened'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShifts.map((shift) => {
            const isOpen = shift.status === 'open';
            const hasDifference = shift.cash_difference !== null && shift.cash_difference !== 0;
            const isPositive = shift.cash_difference !== null && shift.cash_difference > 0;
            const isNegative = shift.cash_difference !== null && shift.cash_difference < 0;

            return (
              <Card
                key={shift.id}
                className={`bg-white dark:bg-[#1c2e18] border transition-all hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 ${
                  isOpen
                    ? 'border-[#4bee2b] dark:border-[#4bee2b]'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isOpen
                          ? 'bg-[#4bee2b]/10'
                          : 'bg-indigo-50 dark:bg-indigo-900/20'
                      }`}>
                        <Clock className={`w-5 h-5 ${
                          isOpen ? 'text-[#4bee2b]' : 'text-indigo-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-slate-900 dark:text-white">
                            {formatDate(shift.started_at)}
                          </h3>
                          <Badge
                            className={isOpen
                              ? 'bg-[#4bee2b] hover:bg-[#45d827] text-[#101b0d]'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }
                          >
                            {shift.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Timer className="w-4 h-4" />
                            {formatDuration(shift.started_at, shift.ended_at)}
                          </span>
                          {shift.user_name && (
                            <span>• {shift.user_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Opening</p>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatPrice(shift.opening_cash)}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Expected</p>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatPrice(shift.expected_closing_cash)}
                      </p>
                    </div>
                    {shift.actual_closing_cash !== null && (
                      <>
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3 h-3 text-slate-400" />
                            <p className="text-xs text-slate-500 dark:text-slate-400">Actual</p>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {formatPrice(shift.actual_closing_cash)}
                          </p>
                        </div>
                        <div className={`rounded-xl p-3 ${
                          !hasDifference
                            ? 'bg-green-50 dark:bg-green-900/10'
                            : isPositive
                            ? 'bg-blue-50 dark:bg-blue-900/10'
                            : 'bg-red-50 dark:bg-red-900/10'
                        }`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3 text-blue-500" />
                            ) : isNegative ? (
                              <TrendingDown className="w-3 h-3 text-red-500" />
                            ) : (
                              <DollarSign className="w-3 h-3 text-green-500" />
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400">Difference</p>
                          </div>
                          <p className={`font-bold ${
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
                    )}
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
