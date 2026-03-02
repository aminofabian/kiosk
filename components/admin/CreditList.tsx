'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  ArrowRight,
  User,
  Loader2,
  CheckCircle,
  DollarSign,
  X,
  ShoppingBag,
  Package,
  Search,
  ArrowUpDown,
  UserCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { CreditAccount, CreditTransaction, SaleItem } from '@/lib/db/types';
import { PaymentForm } from './PaymentForm';
import { apiGet } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils';

interface SaleItemWithDetails extends SaleItem {
  item_name: string;
  item_unit_type: string;
}

interface CreditTransactionWithDetails extends CreditTransaction {
  user_name?: string;
  sale_date?: number;
  items?: SaleItemWithDetails[];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  const hue = Math.abs(h % 360);
  return `hsl(${hue}, 55%, 42%)`;
}

/** FIFO: which debt transactions are fully paid vs pending (oldest debts paid first) */
function computeDebtPaidStatus(
  transactions: CreditTransactionWithDetails[]
): Map<string, boolean> {
  const debts = transactions
    .filter((t) => t.type === 'debt')
    .sort((a, b) => a.created_at - b.created_at);
  const payments = transactions
    .filter((t) => t.type === 'payment')
    .sort((a, b) => a.created_at - b.created_at);

  const paid = new Map<string, boolean>();
  let paymentIdx = 0;
  let paymentRemaining = 0;

  for (const debt of debts) {
    let toCover = debt.amount;
    while (toCover > 0 && paymentIdx < payments.length) {
      if (paymentRemaining <= 0) {
        paymentRemaining = payments[paymentIdx].amount;
        paymentIdx++;
      }
      const apply = Math.min(toCover, paymentRemaining);
      toCover -= apply;
      paymentRemaining -= apply;
    }
    paid.set(debt.id, toCover <= 0);
  }
  return paid;
}

export function CreditList() {
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'date'>('amount');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionWithDetails[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    async function fetchCredits() {
      try {
        setLoading(true);
        setError(null);
        const result = await apiGet<CreditAccount[]>('/api/credits');
        if (result.success) {
          setAccounts(result.data ?? []);
        } else {
          setError(result.message || 'Failed to load credits');
        }
      } catch (err) {
        setError('Failed to load credits');
        console.error('Error fetching credits:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCredits();
  }, []);

  const formatPrice = (price: number) =>
    `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenPaymentDrawer = async (account: CreditAccount) => {
    setSelectedAccount(account);
    setDrawerOpen(true);
    setLoadingDetails(true);
    setTransactions([]);
    try {
      const result = await apiGet<{ account: CreditAccount; transactions: CreditTransactionWithDetails[] }>(
        `/api/credits/${account.id}`
      );
      if (result.success && result.data?.transactions) {
        setTransactions(result.data.transactions);
      }
    } catch (err) {
      console.error('Error fetching credit details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setDrawerOpen(false);
    setSelectedAccount(null);
    try {
      const result = await apiGet<CreditAccount[]>('/api/credits');
      if (result.success) setAccounts(result.data ?? []);
    } catch (err) {
      console.error('Error refreshing credits:', err);
    }
  };

  const outstandingAccounts = useMemo(() => {
    return accounts
      .filter((acc) => acc.total_credit > 0)
      .filter((acc) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          acc.customer_name.toLowerCase().includes(q) ||
          (acc.customer_phone?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.customer_name.localeCompare(b.customer_name);
        if (sortBy === 'date') return (b.last_transaction_at ?? 0) - (a.last_transaction_at ?? 0);
        return b.total_credit - a.total_credit;
      });
  }, [accounts, searchQuery, sortBy]);

  const totalOutstanding = outstandingAccounts.reduce((sum, acc) => sum + acc.total_credit, 0);

  // ——— Loading ———
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Loader2 className="h-7 w-7 text-[#1c6a1e] animate-spin" />
          </div>
          <div className="absolute -inset-1 rounded-3xl bg-[#1c6a1e]/10 animate-pulse" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading credit accounts…
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Fetching outstanding balances
        </p>
      </div>
    );
  }

  // ——— Error ———
  if (error) {
    return (
      <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Couldn&apos;t load credits</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{error}</p>
            <Button
              variant="outline"
              className="mt-6 border-slate-300 dark:border-slate-600"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ——— Empty ———
  if (accounts.length === 0 || outstandingAccounts.length === 0) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-[#0f1a0d] overflow-hidden">
        <CardContent className="p-10 md:p-14">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="h-20 w-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5 shadow-inner">
              <Sparkles className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              No outstanding credits
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {searchQuery
                ? 'No customers match your search. Try a different name or phone.'
                : 'All customers are up to date. New credit sales will appear here.'}
            </p>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 text-slate-600 dark:text-slate-400"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ——— Main content ———
  const sortOptions: { value: 'name' | 'amount' | 'date'; label: string }[] = [
    { value: 'amount', label: 'Highest balance' },
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Recent' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white shadow-xl shadow-slate-900/20">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total outstanding
              </p>
              <p className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">
                {formatPrice(totalOutstanding)}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Across {outstandingAccounts.length} customer{outstandingAccounts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <DollarSign className="h-7 w-7 text-white/90" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50',
              'pl-10 pr-4 py-3 text-sm placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]',
              'transition-colors'
            )}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="h-4 w-4 text-slate-400 hidden sm:block" />
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 gap-0.5">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortBy(opt.value)}
                className={cn(
                  'px-3 py-2 rounded-md text-xs font-medium transition-colors',
                  sortBy === opt.value
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Creditor list */}
      <div className="space-y-3">
        {outstandingAccounts.map((account) => (
          <Card
            key={account.id}
            className={cn(
              'group overflow-hidden border border-slate-200 dark:border-slate-800',
              'bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700',
              'hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50',
              'transition-all duration-200 cursor-pointer'
            )}
          >
            <CardContent className="p-0">
              <button
                type="button"
                onClick={() => handleOpenPaymentDrawer(account)}
                className="w-full text-left flex items-center gap-4 p-4 sm:p-5"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-inner"
                  style={{ backgroundColor: avatarColor(account.customer_name) }}
                >
                  {getInitials(account.customer_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {account.customer_name}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                      Outstanding
                    </span>
                  </div>
                  {account.customer_phone && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {account.customer_phone}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    Last activity: {formatDate(account.last_transaction_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {formatPrice(account.total_credit)}
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1c6a1e] px-3 py-1.5 text-xs font-medium text-white group-hover:bg-[#2a8a30] transition-colors">
                    Collect
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!max-w-[480px] md:!max-w-[520px] h-full max-h-screen border-l border-slate-200 dark:border-slate-800">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm px-6 py-5 pr-14">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-4 top-4 h-9 w-9 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1c6a1e] text-white">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                  Collect payment
                </DrawerTitle>
                <DrawerDescription className="text-slate-600 dark:text-slate-400">
                  {selectedAccount
                    ? `${selectedAccount.customer_name}${selectedAccount.customer_phone ? ` · ${selectedAccount.customer_phone}` : ''}`
                    : ''}
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-white dark:bg-[#0f1a0d] p-6">
            {selectedAccount && (
              <div className="space-y-6">
                {/* Items on credit */}
                <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                      <ShoppingBag className="h-4 w-4 text-[#1c6a1e]" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Items purchased on credit
                      </h3>
                    </div>
                    <div className="p-4">
                      {loadingDetails ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 className="h-6 w-6 text-[#1c6a1e] animate-spin" />
                        </div>
                      ) : (
                        (() => {
                          const debtTransactions = transactions.filter(
                            (t) => t.type === 'debt' && t.items && t.items.length > 0
                          );
                          const debtPaid = computeDebtPaidStatus(transactions);
                          if (debtTransactions.length === 0) {
                            return (
                              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                                No item details available
                              </p>
                            );
                          }
                          return (
                            <div className="space-y-4">
                              {debtTransactions.map((transaction) => {
                                const isPaid = debtPaid.get(transaction.id) ?? false;
                                return (
                                  <div
                                    key={transaction.id}
                                    className={cn(
                                      'rounded-lg border p-3 space-y-2 transition-colors',
                                      isPaid
                                        ? 'border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30'
                                        : 'border-slate-100 dark:border-slate-800'
                                    )}
                                  >
                                    <div className="flex items-center justify-between text-xs">
                                      <span
                                        className={cn(
                                          isPaid
                                            ? 'text-slate-400 dark:text-slate-500 line-through'
                                            : 'text-slate-500 dark:text-slate-400'
                                        )}
                                      >
                                        {transaction.sale_date
                                          ? new Date(transaction.sale_date * 1000).toLocaleDateString(
                                              'en-KE',
                                              {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                              }
                                            )
                                          : formatDate(transaction.created_at)}
                                      </span>
                                      <span
                                        className={cn(
                                          'font-medium',
                                          isPaid
                                            ? 'text-slate-400 dark:text-slate-500 line-through'
                                            : 'text-amber-600 dark:text-amber-400'
                                        )}
                                      >
                                        {formatPrice(transaction.amount)}
                                      </span>
                                    </div>
                                    {isPaid && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle className="h-3 w-3" />
                                        Paid
                                      </span>
                                    )}
                                    <div className="space-y-1.5">
                                      {transaction.items?.map((item) => (
                                        <div
                                          key={item.id}
                                          className={cn(
                                            'flex items-center justify-between text-sm',
                                            isPaid && 'opacity-75'
                                          )}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <Package
                                              className={cn(
                                                'h-3.5 w-3.5 shrink-0',
                                                isPaid
                                                  ? 'text-slate-400 dark:text-slate-500'
                                                  : 'text-slate-400'
                                              )}
                                            />
                                            <span
                                              className={cn(
                                                'truncate',
                                                isPaid
                                                  ? 'text-slate-500 dark:text-slate-500 line-through'
                                                  : 'text-slate-700 dark:text-slate-300'
                                              )}
                                            >
                                              {item.item_name}
                                            </span>
                                          </div>
                                          <div
                                            className={cn(
                                              'flex items-center gap-2 shrink-0 text-xs',
                                              isPaid
                                                ? 'text-slate-400 dark:text-slate-500 line-through'
                                                : 'text-slate-500 dark:text-slate-400'
                                            )}
                                          >
                                            <span>
                                              {item.quantity_sold}{' '}
                                              {item.item_unit_type === 'kg'
                                                ? 'kg'
                                                : item.quantity_sold === 1
                                                  ? 'pc'
                                                  : 'pcs'}
                                            </span>
                                            <span
                                              className={cn(
                                                'font-medium',
                                                isPaid
                                                  ? 'text-slate-500 dark:text-slate-500'
                                                  : 'text-slate-700 dark:text-slate-300'
                                              )}
                                            >
                                              {formatPrice(
                                                item.sell_price_per_unit * item.quantity_sold
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </CardContent>
                </Card>

                <PaymentForm account={selectedAccount} onSuccess={handlePaymentSuccess} />
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
