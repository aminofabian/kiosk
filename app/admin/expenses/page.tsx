'use client';

import { useEffect, useState, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Receipt,
  Plus,
  Loader2,
  TrendingDown,
  Building2,
  Zap,
  Pencil,
  Trash2,
  MoreVertical,
  X,
  AlertTriangle,
  Wallet,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowDownWideNarrow,
  Clock,
  Sparkles,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/utils/api-client';
import type { ExpenseCategory, ExpenseFrequency } from '@/lib/db/types';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { toast } from 'sonner';

interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: ExpenseFrequency;
  start_date: number;
  notes: string | null;
  active: number;
  daily_cost: number;
  include_in_drawer?: number;
  created_at: number;
}

interface ExpenseSummary {
  dailyOperatingCost: number;
  fixedDailyCost: number;
  variableDailyCost: number;
  weeklyOperatingCost: number;
  monthlyOperatingCost: number;
  activeCount: number;
  totalCount: number;
}

interface ExpenseData {
  expenses: Expense[];
  summary: ExpenseSummary;
}

type DrawerMode = 'create' | 'edit';
type TabFilter = 'all' | 'fixed' | 'variable';
type TimePeriod = 'today' | 'yesterday' | '3days' | 'week' | 'month' | 'all';

const TIME_PERIOD_CONFIG: { key: TimePeriod; label: string; shortLabel: string }[] = [
  { key: 'today', label: 'Today', shortLabel: 'Today' },
  { key: 'yesterday', label: 'Yesterday', shortLabel: 'Yest.' },
  { key: '3days', label: 'Past 3 Days', shortLabel: '3 Days' },
  { key: 'week', label: 'This Week', shortLabel: 'Week' },
  { key: 'month', label: 'This Month', shortLabel: 'Month' },
  { key: 'all', label: 'All Time', shortLabel: 'All' },
];

function getTimeBoundary(period: TimePeriod): number {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.floor(start.getTime() / 1000);
    }
    case 'yesterday': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return Math.floor(start.getTime() / 1000);
    }
    case '3days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
      return Math.floor(start.getTime() / 1000);
    }
    case 'week': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return Math.floor(start.getTime() / 1000);
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return Math.floor(start.getTime() / 1000);
    }
    case 'all':
      return 0;
  }
}

function formatRelativeTime(unixTs: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTs;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  const date = new Date(unixTs * 1000);
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  'one-time': 'One-Time',
};

const FREQUENCY_SHORTHAND: Record<ExpenseFrequency, string> = {
  daily: '/day',
  weekly: '/wk',
  monthly: '/mo',
  yearly: '/yr',
  'one-time': 'once',
};

export default function ExpensesPage() {
  const { user } = useCurrentUser();
  const isCashier = user?.role === 'cashier';
  const [data, setData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');

  const [formData, setFormData] = useState({
    name: '',
    category: 'fixed' as ExpenseCategory,
    amount: '',
    frequency: 'monthly' as ExpenseFrequency,
    startDate: new Date().toISOString().split('T')[0],
    notes: '',
    includeInDrawer: true,
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const result = await apiGet<ExpenseData>('/api/expenses');
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to load expenses');
      }
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatCompact = (price: number) => {
    if (price >= 1000) {
      return `KES ${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k`;
    }
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Filtered & sorted expenses
  const { activeExpenses, inactiveExpenses, drawerExpenses, recentlyAdded, recentCounts } = useMemo(() => {
    if (!data) return { activeExpenses: [], inactiveExpenses: [], drawerExpenses: [], recentlyAdded: [], recentCounts: {} as Record<TimePeriod, number> };

    const active = data.expenses
      .filter((e) => e.active === 1)
      .filter((e) => {
        if (tabFilter === 'fixed') return e.category === 'fixed';
        if (tabFilter === 'variable') return e.category === 'variable';
        return true;
      })
      .filter((e) => {
        if (!searchQuery) return true;
        return e.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => b.daily_cost - a.daily_cost);

    const inactive = data.expenses
      .filter((e) => e.active === 0)
      .filter((e) => {
        if (!searchQuery) return true;
        return e.name.toLowerCase().includes(searchQuery.toLowerCase());
      });

    const drawer = data.expenses.filter(
      (e) => e.frequency === 'daily' && e.active === 1 && (e.include_in_drawer ?? 1) === 1
    );

    const boundary = getTimeBoundary(timePeriod);
    const recent = data.expenses
      .filter((e) => e.created_at >= boundary)
      .sort((a, b) => b.created_at - a.created_at);

    const counts = {} as Record<TimePeriod, number>;
    for (const p of TIME_PERIOD_CONFIG) {
      const b = getTimeBoundary(p.key);
      counts[p.key] = data.expenses.filter((e) => e.created_at >= b).length;
    }

    return { activeExpenses: active, inactiveExpenses: inactive, drawerExpenses: drawer, recentlyAdded: recent, recentCounts: counts };
  }, [data, tabFilter, searchQuery, timePeriod]);

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setSelectedExpense(null);
    setFormData({
      name: '',
      category: 'fixed',
      amount: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      notes: '',
      includeInDrawer: true,
    });
    setFormError('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (expense: Expense) => {
    if (isCashier) return;
    setDrawerMode('edit');
    setSelectedExpense(expense);
    setFormData({
      name: expense.name,
      category: expense.category,
      amount: expense.amount.toString(),
      frequency: expense.frequency,
      startDate: new Date(expense.start_date * 1000).toISOString().split('T')[0],
      notes: expense.notes || '',
      includeInDrawer: (expense.include_in_drawer ?? 1) === 1,
    });
    setFormError('');
    setMenuOpenId(null);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid amount');
      setSubmitting(false);
      return;
    }

    try {
      if (drawerMode === 'create') {
        const result = await apiPost('/api/expenses', {
          name: formData.name,
          category: formData.category,
          amount,
          frequency: formData.frequency,
          startDate: formData.startDate,
          notes: formData.notes || null,
          includeInDrawer: formData.includeInDrawer,
        });
        if (result.success) {
          setDrawerOpen(false);
          fetchExpenses();
        } else {
          setFormError(result.message || 'Failed to create expense');
        }
      } else if (selectedExpense && !isCashier) {
        const result = await apiPut(`/api/expenses/${selectedExpense.id}`, {
          name: formData.name,
          category: formData.category,
          amount,
          frequency: formData.frequency,
          startDate: formData.startDate,
          notes: formData.notes || null,
          includeInDrawer: formData.includeInDrawer,
        });
        if (result.success) {
          setDrawerOpen(false);
          fetchExpenses();
        } else {
          setFormError(result.message || 'Failed to update expense');
        }
      }
    } catch {
      setFormError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (expense: Expense) => {
    setMenuOpenId(null);
    try {
      const result = await apiPut(`/api/expenses/${expense.id}`, {
        active: expense.active !== 1,
      });
      if (result.success) fetchExpenses();
    } catch {
      /* handled silently */
    }
  };

  const handleDelete = (expense: Expense) => {
    setMenuOpenId(null);
    toast(`Delete "${expense.name}"? This cannot be undone.`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            const result = await apiDelete(`/api/expenses/${expense.id}`);
            if (result.success) {
              fetchExpenses();
              toast.success('Expense deleted');
            } else {
              toast.error(result.message || 'Failed to delete expense');
            }
          } catch {
            toast.error('Failed to delete expense');
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const fixedPct = data && data.summary.dailyOperatingCost > 0
    ? Math.round((data.summary.fixedDailyCost / data.summary.dailyOperatingCost) * 100)
    : 0;
  const variablePct = 100 - fixedPct;

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b-2 border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1c6a1e] flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Expenses</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your cost of doing business
                  </p>
                </div>
              </div>
              {!isCashier && (
                <Button
                  onClick={openCreateDrawer}
                  className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white rounded-lg"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Loading expenses...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-3">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
                <Button onClick={fetchExpenses} variant="outline" className="rounded-lg">Try Again</Button>
              </div>
            </div>
          ) : data && (
            <div className="space-y-6">

              {/* ═══════════════════════════════════════════
                  SECTION 1 — The Survival Number
                  "How much does it cost me to keep the doors open?"
                  ═══════════════════════════════════════════ */}
              {!isCashier && (
                <div className="border-2 border-[#1c6a1e] bg-[#1c6a1e] p-5">
                  <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Daily Operating Cost
                  </p>
                  <div className="flex items-end gap-4 flex-wrap">
                    <p className="text-3xl md:text-4xl font-black text-white leading-none">
                      {formatPrice(data.summary.dailyOperatingCost)}
                    </p>
                    <p className="text-white/60 text-sm font-medium pb-0.5">per day</p>
                  </div>
                  <p className="text-white/50 text-xs mt-2 max-w-md">
                    You need at least this much in daily profit to break even.
                  </p>

                  {/* Weekly / Monthly on the same row */}
                  <div className="flex gap-6 mt-4 pt-4 border-t border-white/20">
                    <div>
                      <p className="text-white/50 text-[10px] font-bold uppercase tracking-wide">Weekly</p>
                      <p className="text-lg font-black text-white">{formatCompact(data.summary.weeklyOperatingCost)}</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-[10px] font-bold uppercase tracking-wide">Monthly</p>
                      <p className="text-lg font-black text-white">{formatCompact(data.summary.monthlyOperatingCost)}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-white/50 text-[10px] font-bold uppercase tracking-wide">Active</p>
                      <p className="text-lg font-black text-white">{data.summary.activeCount} <span className="text-sm font-medium text-white/50">expenses</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════
                  SECTION 2 — Fixed vs Variable Breakdown
                  Visual bar + numbers so you see where money goes
                  ═══════════════════════════════════════════ */}
              {!isCashier && data.summary.dailyOperatingCost > 0 && (
                <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                    Cost Breakdown
                  </p>

                  {/* Visual bar */}
                  <div className="flex h-3 rounded-full overflow-hidden mb-3">
                    {fixedPct > 0 && (
                      <div
                        className="bg-[#1c6a1e] transition-all duration-500"
                        style={{ width: `${fixedPct}%` }}
                      />
                    )}
                    {variablePct > 0 && (
                      <div
                        className="bg-emerald-300 dark:bg-emerald-500 transition-all duration-500"
                        style={{ width: `${variablePct}%` }}
                      />
                    )}
                  </div>

                  {/* Legend row */}
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-[#1c6a1e]" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">Fixed</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatCompact(data.summary.fixedDailyCost)}/day
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">({fixedPct}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-500" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">Variable</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatCompact(data.summary.variableDailyCost)}/day
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">({variablePct}%)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════
                  SECTION 3 — Cash Drawer Deductions
                  Quick glance: what gets pulled from the register
                  ═══════════════════════════════════════════ */}
              {!isCashier && drawerExpenses.length > 0 && (
                <div className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                          Cash Drawer Deductions
                        </p>
                        <p className="font-black text-amber-900 dark:text-amber-200">
                          {formatPrice(drawerExpenses.reduce((sum, e) => sum + e.amount, 0))}/day
                        </p>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Deducted from expected cash at shift close:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {drawerExpenses.map((e) => (
                          <Badge
                            key={e.id}
                            variant="outline"
                            className="border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs"
                          >
                            {e.name} &middot; {formatPrice(e.amount)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════
                  SECTION 4 — Recently Added Timeline
                  "What expenses were added today / this week?"
                  ═══════════════════════════════════════════ */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-[#1c6a1e]" />
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Recently Added
                  </h2>
                </div>

                {/* Time period pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {TIME_PERIOD_CONFIG.map((p) => {
                    const count = recentCounts[p.key] ?? 0;
                    const isActive = timePeriod === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setTimePeriod(p.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-[#1c6a1e] text-white shadow-sm'
                            : count > 0
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="hidden sm:inline">{p.label}</span>
                        <span className="sm:hidden">{p.shortLabel}</span>
                        {count > 0 && (
                          <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-[#1c6a1e]/10 text-[#1c6a1e]'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Recently added results */}
                {recentlyAdded.length > 0 ? (
                  <div className="space-y-2">
                    {/* Summary line */}
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{recentlyAdded.length}</span>
                        {' '}expense{recentlyAdded.length !== 1 ? 's' : ''} added{' '}
                        <span className="font-medium">{timePeriod === 'all' ? 'total' : TIME_PERIOD_CONFIG.find(p => p.key === timePeriod)?.label.toLowerCase()}</span>
                      </p>
                      {timePeriod !== 'all' && (() => {
                        const recentDailyCost = recentlyAdded
                          .filter((e) => e.active === 1 && e.frequency !== 'one-time')
                          .reduce((sum, e) => sum + e.daily_cost, 0);
                        if (recentDailyCost > 0) {
                          return (
                            <p className="text-xs font-bold text-[#1c6a1e]">
                              +{formatPrice(recentDailyCost)}/day impact
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Recent expense cards */}
                    {recentlyAdded.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center gap-3 p-3 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer"
                        onClick={() => !isCashier && openEditDrawer(expense)}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 rounded ${
                          expense.category === 'fixed'
                            ? 'bg-slate-100 dark:bg-slate-700'
                            : 'bg-emerald-50 dark:bg-emerald-900/30'
                        }`}>
                          {expense.category === 'fixed' ? (
                            <Building2 className="w-3.5 h-3.5 text-[#1c6a1e]" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {expense.name}
                            </p>
                            {expense.active === 0 && (
                              <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-400">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                            <span>{formatRelativeTime(expense.created_at)}</span>
                            <span>&middot;</span>
                            <span>{FREQUENCY_LABELS[expense.frequency]}</span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {expense.frequency === 'one-time' ? (
                            <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                              {formatPrice(expense.amount)}
                            </p>
                          ) : (
                            <>
                              <p className="text-sm font-black text-[#1c6a1e]">
                                {formatPrice(expense.daily_cost)}<span className="text-[9px] font-bold text-slate-400">/day</span>
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {formatPrice(expense.amount)} {FREQUENCY_SHORTHAND[expense.frequency]}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No expenses added {timePeriod === 'today' ? 'today' : timePeriod === 'yesterday' ? 'since yesterday' : TIME_PERIOD_CONFIG.find(p => p.key === timePeriod)?.label.toLowerCase()}
                    </p>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════
                  SECTION 5 — All Active Expenses (master list)
                  Sorted by daily cost (biggest first) so you
                  immediately see what matters most.
                  ═══════════════════════════════════════════ */}
              <div className="space-y-3">
                {/* Filter bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Category tabs */}
                  <div className="flex border-2 border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    {(['all', 'fixed', 'variable'] as TabFilter[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setTabFilter(tab)}
                        className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                          tabFilter === tab
                            ? 'bg-[#1c6a1e] text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {tab === 'all' ? 'All' : tab === 'fixed' ? 'Fixed' : 'Variable'}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 min-w-[180px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search expenses..."
                      className="pl-9 h-9 border-2 border-slate-200 dark:border-slate-700"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                    <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    <span>Highest cost first</span>
                  </div>
                </div>

                {/* Section label */}
                <div className="flex items-center justify-between pt-1">
                  <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Active Expenses
                    <span className="ml-2 text-slate-400 dark:text-slate-500">
                      ({activeExpenses.length})
                    </span>
                  </h2>
                </div>

                {/* Expense list */}
                {activeExpenses.length > 0 ? (
                  <div className="space-y-2">
                    {activeExpenses.map((expense, idx) => {
                      const costShare = data.summary.dailyOperatingCost > 0
                        ? (expense.daily_cost / data.summary.dailyOperatingCost) * 100
                        : 0;

                      return (
                        <ExpenseRow
                          key={expense.id}
                          expense={expense}
                          rank={idx + 1}
                          costShare={costShare}
                          menuOpenId={menuOpenId}
                          setMenuOpenId={setMenuOpenId}
                          onEdit={openEditDrawer}
                          onToggle={handleToggleActive}
                          onDelete={handleDelete}
                          formatPrice={formatPrice}
                          isCashier={isCashier}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    {searchQuery || tabFilter !== 'all' ? (
                      <>
                        <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">No expenses match your filter</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => { setSearchQuery(''); setTabFilter('all'); }}
                          className="mt-1 text-[#1c6a1e]"
                        >
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">No expenses yet</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                          Add expenses like rent, salaries, and utilities to understand your true daily cost of running the business.
                        </p>
                        {!isCashier && (
                          <Button onClick={openCreateDrawer} className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white rounded-lg">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Expense
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════
                  SECTION 6 — Inactive / Paused Expenses
                  Collapsed by default — out of the way
                  ═══════════════════════════════════════════ */}
              {inactiveExpenses.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowInactive(!showInactive)}
                    className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors w-full py-2"
                  >
                    {showInactive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-bold">Inactive Expenses</span>
                    <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-[10px]">
                      {inactiveExpenses.length}
                    </Badge>
                  </button>
                  {showInactive && (
                    <div className="space-y-2 mt-2 opacity-60">
                      {inactiveExpenses.map((expense) => (
                        <ExpenseRow
                          key={expense.id}
                          expense={expense}
                          costShare={0}
                          menuOpenId={menuOpenId}
                          setMenuOpenId={setMenuOpenId}
                          onEdit={openEditDrawer}
                          onToggle={handleToggleActive}
                          onDelete={handleDelete}
                          formatPrice={formatPrice}
                          isCashier={isCashier}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Add/Edit Expense Drawer ── */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative pr-12">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-4 top-4 h-10 w-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-2 border-slate-300 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-sm hover:shadow-md rounded-lg"
              >
                <X className="h-5 w-5" />
              </Button>
              <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
                <Receipt className="w-5 h-5 text-[#1c6a1e]" />
                {drawerMode === 'create' ? 'Add Expense' : 'Edit Expense'}
              </DrawerTitle>
              <DrawerDescription className="text-slate-600 dark:text-slate-400">
                {drawerMode === 'create'
                  ? 'Add a recurring operating expense'
                  : `Update ${selectedExpense?.name}`}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto p-6 flex-1 bg-white dark:bg-[#0f1a0d]">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-bold">Expense Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Rent, Electricity, Salary"
                    required
                    className="h-12 border-2 border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-bold">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value as ExpenseCategory })}
                    >
                      <SelectTrigger className="h-12 border-2 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#1c6a1e]" />
                            Fixed
                          </div>
                        </SelectItem>
                        <SelectItem value="variable">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-[#1c6a1e]" />
                            Variable
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      {formData.category === 'fixed'
                        ? 'Same cost regardless of sales'
                        : 'Changes based on usage'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300 font-bold">Frequency *</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData({ ...formData, frequency: value as ExpenseFrequency })}
                    >
                      <SelectTrigger className="h-12 border-2 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="one-time">One-Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-bold">Amount (KES) *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g., 30000"
                    required
                    min="0"
                    step="0.01"
                    className="h-12 text-lg border-2 border-slate-200 dark:border-slate-700"
                  />
                  {formData.amount && parseFloat(formData.amount) > 0 && formData.frequency !== 'one-time' && (
                    <div className="border-2 border-[#1c6a1e] bg-[#1c6a1e]/5 p-3">
                      <p className="text-sm font-bold text-[#1c6a1e]">
                        = {formatPrice(parseFloat(formData.amount) / (
                          formData.frequency === 'daily' ? 1 :
                          formData.frequency === 'weekly' ? 7 :
                          formData.frequency === 'monthly' ? 30 : 365
                        ))}/day
                      </p>
                    </div>
                  )}
                  {formData.amount && parseFloat(formData.amount) > 0 && formData.frequency === 'one-time' && (
                    <div className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-3">
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        One-time expense &mdash; {formatPrice(parseFloat(formData.amount))} total
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-bold">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-12 border-2 border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-bold">Notes (Optional)</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional details"
                    className="border-2 border-slate-200 dark:border-slate-700"
                  />
                </div>

                {formData.frequency === 'daily' && (
                  <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-[#1c6a1e]/30 bg-[#1c6a1e]/5">
                    <input
                      type="checkbox"
                      id="include_in_drawer"
                      checked={formData.includeInDrawer}
                      onChange={(e) => setFormData({ ...formData, includeInDrawer: e.target.checked })}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e]"
                    />
                    <div>
                      <Label htmlFor="include_in_drawer" className="text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                        Include in cash drawer
                      </Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Deducted from expected cash when closing a shift. Uncheck to exclude (e.g. if paid separately).
                      </p>
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="p-3 border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-lg"
                    onClick={() => setDrawerOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white rounded-lg"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {drawerMode === 'create' ? 'Adding...' : 'Saving...'}
                      </>
                    ) : (
                      drawerMode === 'create' ? 'Add Expense' : 'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DrawerContent>
        </Drawer>

        {menuOpenId && (
          <div className="fixed inset-0 z-0" onClick={() => setMenuOpenId(null)} />
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Expense Row ─────────────────────────────────────────
interface ExpenseRowProps {
  expense: Expense;
  rank?: number;
  costShare: number;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onEdit: (expense: Expense) => void;
  onToggle: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  formatPrice: (price: number) => string;
  isCashier?: boolean;
}

function ExpenseRow({
  expense,
  rank,
  costShare,
  menuOpenId,
  setMenuOpenId,
  onEdit,
  onToggle,
  onDelete,
  formatPrice,
  isCashier = false,
}: ExpenseRowProps) {
  const isOneTime = expense.frequency === 'one-time';
  const isInDrawer = expense.frequency === 'daily' && (expense.include_in_drawer ?? 1) === 1;

  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-3">
        {/* Rank */}
        {rank != null && (
          <div className={`w-7 h-7 flex items-center justify-center flex-shrink-0 text-xs font-black rounded ${
            rank <= 3
              ? 'bg-[#1c6a1e]/10 text-[#1c6a1e]'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
          }`}>
            {rank}
          </div>
        )}

        {/* Icon */}
        <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 border-2 ${
          expense.category === 'fixed'
            ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700'
            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30'
        }`}>
          {expense.category === 'fixed' ? (
            <Building2 className="w-4 h-4 text-[#1c6a1e]" />
          ) : (
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {expense.name}
            </h3>
            <Badge variant="outline" className="text-[9px] border-slate-300 dark:border-slate-600">
              {FREQUENCY_LABELS[expense.frequency]}
            </Badge>
            {isInDrawer && (
              <Badge
                variant="outline"
                className="text-[9px] border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              >
                <Wallet className="w-3 h-3 mr-0.5" /> Drawer
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatPrice(expense.amount)} {FREQUENCY_SHORTHAND[expense.frequency]}
            {expense.notes && <span className="ml-1.5 text-slate-400 dark:text-slate-500">&middot; {expense.notes}</span>}
          </p>
        </div>

        {/* Daily cost + share */}
        <div className="text-right flex-shrink-0 min-w-[90px]">
          {isOneTime ? (
            <>
              <p className="text-base font-black text-blue-600 dark:text-blue-400">
                {formatPrice(expense.amount)}
              </p>
              <p className="text-[9px] text-slate-400 uppercase font-bold">one-time</p>
            </>
          ) : (
            <>
              <p className="text-base font-black text-[#1c6a1e]">
                {formatPrice(expense.daily_cost)}
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <p className="text-[9px] text-slate-400 uppercase font-bold">/day</p>
                {costShare > 0 && (
                  <span className="text-[9px] text-slate-400 font-medium">
                    ({costShare.toFixed(costShare >= 10 ? 0 : 1)}%)
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!isCashier && (
          <div className="relative flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMenuOpenId(menuOpenId === expense.id ? null : expense.id)}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
            {menuOpenId === expense.id && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-xl z-10 py-1 rounded-lg">
                <button
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => onEdit(expense)}
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => onToggle(expense)}
                >
                  <TrendingDown className="w-4 h-4" />
                  {expense.active === 1 ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  onClick={() => onDelete(expense)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cost share bar — only for active non-one-time expenses */}
      {costShare > 0 && !isOneTime && (
        <div className="mt-2 ml-[calc(1.75rem+0.75rem+2.25rem+0.75rem)]">
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                expense.category === 'fixed' ? 'bg-[#1c6a1e]' : 'bg-emerald-400 dark:bg-emerald-500'
              }`}
              style={{ width: `${Math.min(costShare, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
