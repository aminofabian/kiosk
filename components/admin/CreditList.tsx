'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowRight,
  Loader2,
  CheckCircle,
  DollarSign,
  X,
  ShoppingBag,
  Package,
  Search,
  ArrowUpDown,
  AlertCircle,
  Sparkles,
  User,
  ChevronDown,
  ArrowLeftRight,
  GitMerge,
  Smartphone,
  Plus,
  Trash2,
  Link2,
  Clock,
  Gift,
} from 'lucide-react';
import type { CreditAccount, CreditTransaction, SaleItem } from '@/lib/db/types';
import { PaymentForm } from './PaymentForm';
import { apiGet, apiPatch, apiPost } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils';
import { toProperCustomerName } from '@/lib/utils/customer-name';
import { formatPhonesForDisplay, parseCreditPhones } from '@/lib/utils/credit-phones';
import { creditStatusSlugFromPhone } from '@/lib/utils/credit-public-slug';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface SaleItemWithDetails extends SaleItem {
  item_name: string;
  item_unit_type: string;
}

interface CreditTransactionWithDetails extends CreditTransaction {
  user_name?: string;
  recorder_role?: string | null;
  sale_date?: number;
  items?: SaleItemWithDetails[];
}

function formatRecorderLabel(name?: string | null, role?: string | null): string | null {
  const n = name?.trim();
  if (!n) return null;
  const r = role?.trim();
  if (!r) return n;
  return `${n} (${r.charAt(0).toUpperCase() + r.slice(1)})`;
}

function accountPhonesList(acc: CreditAccount): string[] {
  if (acc.customer_phones && acc.customer_phones.length > 0) return acc.customer_phones;
  return parseCreditPhones(acc.customer_phone);
}

function phonesSearchMatch(phones: string[], q: string): boolean {
  const ql = q.toLowerCase();
  return phones.some((p) => p.toLowerCase().includes(ql));
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
    .filter(
      (t) =>
        t.type === 'payment' &&
        t.public_claim_status !== 'pending' &&
        t.public_claim_status !== 'rejected'
    )
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

interface TransferStaffRow {
  id: string;
  name: string;
  role: string;
}

interface PendingPublicClaimRow {
  kind: 'tab' | 'wallet';
  transactionId: string;
  creditAccountId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'mpesa';
  createdAt: number;
  customerReference: string | null;
}

export function CreditList() {
  const { user } = useCurrentUser();
  /** Customer edit, merge, reassign — API is owner + admin only; cashiers never see these. */
  const canManageCreditProfiles = user?.role === 'owner' || user?.role === 'admin';

  const [customerEditModalOpen, setCustomerEditModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  /** 'all' | user id | '__none__' for accounts with no recorded creditor on last debt */
  const [creditorFilter, setCreditorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'date'>('amount');
  const [creditView, setCreditView] = useState<'outstanding' | 'paid'>('outstanding');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(null);
  const [transactions, setTransactions] = useState<CreditTransactionWithDetails[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [transferUsers, setTransferUsers] = useState<TransferStaffRow[]>([]);
  const [transferToUserId, setTransferToUserId] = useState('');
  const [transferIncludePayments, setTransferIncludePayments] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [claimReviewBusy, setClaimReviewBusy] = useState<{
    transactionId: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [pendingPublicClaims, setPendingPublicClaims] = useState<PendingPublicClaimRow[]>([]);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [mergeNameOverride, setMergeNameOverride] = useState('');
  const [mergePhonesText, setMergePhonesText] = useState('');
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhones, setEditCustomerPhones] = useState<string[]>(['']);
  const [editCustomerSaving, setEditCustomerSaving] = useState(false);

  useEffect(() => {
    if (!selectedAccount) return;
    if (!drawerOpen && !customerEditModalOpen) return;
    setEditCustomerName(toProperCustomerName(selectedAccount.customer_name));
    const phones = accountPhonesList(selectedAccount);
    setEditCustomerPhones(phones.length > 0 ? phones : ['']);
  }, [
    selectedAccount?.id,
    selectedAccount?.customer_name,
    selectedAccount?.customer_phone,
    selectedAccount?.customer_phones,
    drawerOpen,
    customerEditModalOpen,
  ]);

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

  const fetchPendingClaims = useCallback(async () => {
    if (!canManageCreditProfiles) {
      setPendingPublicClaims([]);
      return;
    }
    try {
      const result = await apiGet<{ claims: PendingPublicClaimRow[] }>('/api/credits/pending-claims');
      if (result.success && result.data?.claims) {
        setPendingPublicClaims(result.data.claims);
      } else {
        setPendingPublicClaims([]);
      }
    } catch {
      setPendingPublicClaims([]);
    }
  }, [canManageCreditProfiles]);

  useEffect(() => {
    void fetchPendingClaims();
  }, [fetchPendingClaims]);

  useEffect(() => {
    if (!transferModalOpen || !canManageCreditProfiles) return;
    let cancelled = false;
    (async () => {
      const result = await apiGet<TransferStaffRow[]>('/api/credits/transfer-users');
      if (!cancelled && result.success) {
        setTransferUsers(result.data ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transferModalOpen, canManageCreditProfiles]);

  const formatPrice = (price: number) =>
    `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const accountWalletBalance = (acc: CreditAccount) => Number(acc.wallet_balance ?? 0);

  /** Tab (credit) / store wallet — for list cells */
  const formatCreditWalletSlash = (acc: CreditAccount) =>
    `${formatPrice(acc.total_credit)} / ${formatPrice(accountWalletBalance(acc))}`;

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const lifetimeDebtTotal = (acc: CreditAccount) => Number(acc.lifetime_debt_total ?? 0);

  const lastCreditByLabel = (acc: CreditAccount) =>
    formatRecorderLabel(acc.last_credit_by_name, acc.last_credit_by_role);

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

  const openCreditAccountById = async (creditAccountId: string) => {
    setDrawerOpen(true);
    setLoadingDetails(true);
    setTransactions([]);
    setSelectedAccount(null);
    try {
      const result = await apiGet<{ account: CreditAccount; transactions: CreditTransactionWithDetails[] }>(
        `/api/credits/${creditAccountId}`
      );
      if (result.success && result.data) {
        if (result.data.account) setSelectedAccount(result.data.account);
        if (result.data.transactions) setTransactions(result.data.transactions);
      } else {
        toast.error(result.message || 'Could not load customer');
        setDrawerOpen(false);
      }
    } catch (err) {
      console.error('Error opening credit account:', err);
      toast.error('Could not load customer');
      setDrawerOpen(false);
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
    await fetchPendingClaims();
  };

  const refreshCreditsList = async () => {
    try {
      const result = await apiGet<CreditAccount[]>('/api/credits');
      if (result.success) setAccounts(result.data ?? []);
    } catch (err) {
      console.error('Error refreshing credits:', err);
    }
  };

  const handleSaveCustomerDetails = async () => {
    if (!selectedAccount) return;
    const name = editCustomerName.trim();
    if (!name) {
      toast.error('Customer name is required');
      return;
    }
    setEditCustomerSaving(true);
    try {
      const phonesPayload = editCustomerPhones.map((p) => p.trim()).filter(Boolean);
      const result = await apiPatch<{ account: CreditAccount }>(`/api/credits/${selectedAccount.id}`, {
        customerName: name,
        customerPhones: phonesPayload,
      });
      if (result.success && result.data?.account) {
        toast.success('Customer details saved');
        setSelectedAccount(result.data.account);
        setCustomerEditModalOpen(false);
        await refreshCreditsList();
      } else {
        toast.error(result.message || 'Could not save');
      }
    } catch (err) {
      console.error('Error saving customer details:', err);
      toast.error('Could not save');
    } finally {
      setEditCustomerSaving(false);
    }
  };

  const silentReloadDrawerDetail = async (accountId: string) => {
    try {
      const result = await apiGet<{
        account: CreditAccount;
        transactions: CreditTransactionWithDetails[];
      }>(`/api/credits/${accountId}`);
      if (result.success && result.data) {
        if (result.data.transactions) setTransactions(result.data.transactions);
        if (result.data.account) setSelectedAccount(result.data.account);
      }
    } catch (err) {
      console.error('Error reloading credit detail:', err);
    }
  };

  const reviewPublicPaymentClaim = async (
    claim: PendingPublicClaimRow,
    action: 'approve' | 'reject',
    creditAccountIdForReload?: string | null
  ) => {
    setClaimReviewBusy({ transactionId: claim.transactionId, action });
    try {
      const path =
        claim.kind === 'wallet'
          ? `/api/credits/wallet-claims/${claim.transactionId}`
          : `/api/credits/claims/${claim.transactionId}`;
      const result = await apiPost<{ newBalance?: number; newWalletBalance?: number }>(path, {
        action,
      });
      if (result.success) {
        toast.success(
          result.message ?? (action === 'approve' ? 'Payment accepted' : 'Claim rejected')
        );
        await fetchPendingClaims();
        await refreshCreditsList();
        const reloadId = creditAccountIdForReload ?? selectedAccount?.id ?? null;
        if (reloadId && drawerOpen && selectedAccount?.id === reloadId) {
          await silentReloadDrawerDetail(reloadId);
        }
      } else {
        toast.error(result.message || 'Could not update claim');
      }
    } catch (err) {
      console.error('claim review:', err);
      toast.error('Could not update claim');
    } finally {
      setClaimReviewBusy(null);
    }
  };

  const handleTransferRecorder = async () => {
    if (!selectedAccount || !transferToUserId) {
      toast.error('Choose a staff member to transfer to');
      return;
    }
    setTransferSubmitting(true);
    try {
      const result = await apiPost<{ updatedCount: number; scope: string }>(
        `/api/credits/${selectedAccount.id}/transfer-recorder`,
        {
          toUserId: transferToUserId,
          scope: transferIncludePayments ? 'all' : 'debts',
        }
      );
      if (result.success) {
        toast.success(result.message ?? 'Recorder updated');
        setTransferToUserId('');
        setTransferIncludePayments(false);
        setTransferModalOpen(false);
        await refreshCreditsList();
        await silentReloadDrawerDetail(selectedAccount.id);
      } else {
        toast.error(result.message || 'Transfer failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const mergeCandidates = useMemo(() => {
    if (!selectedAccount) return [];
    const q = mergeSearchQuery.trim().toLowerCase();
    return accounts
      .filter((a) => a.id !== selectedAccount.id)
      .filter((a) => {
        if (!q) return true;
        return (
          a.customer_name.toLowerCase().includes(q) || phonesSearchMatch(accountPhonesList(a), q)
        );
      })
      .sort((a, b) =>
        toProperCustomerName(a.customer_name).localeCompare(
          toProperCustomerName(b.customer_name)
        )
      );
  }, [accounts, selectedAccount, mergeSearchQuery]);

  const toggleMergeId = (id: string) => {
    setMergeSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMergeCustomers = async () => {
    if (!selectedAccount || mergeSelectedIds.length === 0) {
      toast.error('Select at least one other profile to merge');
      return;
    }
    setMergeSubmitting(true);
    try {
      const mergePhoneLines = mergePhonesText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const result = await apiPost<{ mergedCount: number; newBalance: number }>('/api/credits/merge', {
        keepAccountId: selectedAccount.id,
        mergeAccountIds: mergeSelectedIds,
        customerName: mergeNameOverride.trim() || undefined,
        ...(mergePhoneLines.length > 0 ? { customerPhones: mergePhoneLines } : {}),
      });
      if (result.success) {
        toast.success(result.message ?? 'Profiles merged');
        setMergeSelectedIds([]);
        setMergeSearchQuery('');
        setMergeNameOverride('');
        setMergePhonesText('');
        setMergeModalOpen(false);
        await refreshCreditsList();
        await fetchPendingClaims();
        await silentReloadDrawerDetail(selectedAccount.id);
      } else {
        toast.error(result.message || 'Merge failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Merge failed');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const publicCreditSlug = useMemo(() => {
    if (!selectedAccount) return null;
    for (const p of accountPhonesList(selectedAccount)) {
      const s = creditStatusSlugFromPhone(p);
      if (s) return s;
    }
    return null;
  }, [selectedAccount]);

  const handleCopyPublicCreditLink = () => {
    if (!publicCreditSlug || typeof window === 'undefined') return;
    const url = `${window.location.origin}/c/${encodeURIComponent(publicCreditSlug)}`;
    void navigator.clipboard.writeText(url).then(
      () =>
        toast.success(
          'Customer status link copied — they can open it to see balance and paid-up status'
        ),
      () => toast.error('Could not copy link')
    );
  };

  const outstandingCount = useMemo(
    () => accounts.filter((a) => a.total_credit > 0).length,
    [accounts]
  );
  const paidUpCount = useMemo(
    () => accounts.filter((a) => a.total_credit <= 0).length,
    [accounts]
  );

  const creditorOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const a of accounts) {
      const id = a.last_credit_by_user_id;
      if (!id) continue;
      if (byId.has(id)) continue;
      const label =
        formatRecorderLabel(a.last_credit_by_name, a.last_credit_by_role) ??
        a.last_credit_by_name ??
        'Unknown';
      byId.set(id, label);
    }
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((x, y) => x.label.localeCompare(y.label));
  }, [accounts]);

  const hasCreditorUnknown = useMemo(
    () => accounts.some((a) => !a.last_credit_by_user_id),
    [accounts]
  );

  const visibleAccounts = useMemo(() => {
    return accounts
      .filter((acc) => (creditView === 'outstanding' ? acc.total_credit > 0 : acc.total_credit <= 0))
      .filter((acc) => {
        if (creditorFilter === 'all') return true;
        if (creditorFilter === '__none__') return !acc.last_credit_by_user_id;
        return acc.last_credit_by_user_id === creditorFilter;
      })
      .filter((acc) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          acc.customer_name.toLowerCase().includes(q) || phonesSearchMatch(accountPhonesList(acc), q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return toProperCustomerName(a.customer_name).localeCompare(
            toProperCustomerName(b.customer_name)
          );
        }
        if (sortBy === 'date') return (b.last_transaction_at ?? 0) - (a.last_transaction_at ?? 0);
        if (sortBy === 'amount') {
          if (creditView === 'paid') {
            return (
              Number(b.lifetime_debt_total ?? 0) - Number(a.lifetime_debt_total ?? 0)
            );
          }
          return b.total_credit - a.total_credit;
        }
        return 0;
      });
  }, [accounts, creditorFilter, creditView, searchQuery, sortBy]);

  const totalOutstanding = useMemo(() => {
    if (creditView !== 'outstanding') return 0;
    return visibleAccounts.reduce((sum, acc) => sum + acc.total_credit, 0);
  }, [creditView, visibleAccounts]);

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

  // ——— Empty (no accounts at all) ———
  if (accounts.length === 0) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-[#0f1a0d] overflow-hidden">
        <CardContent className="p-10 md:p-14">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="h-20 w-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5 shadow-inner">
              <Sparkles className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No credit customers yet</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Credit sales will create customer accounts here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ——— Main content ———
  const sortOptions: { value: 'name' | 'amount' | 'date'; label: string }[] = [
    {
      value: 'amount',
      label: creditView === 'outstanding' ? 'Highest balance' : 'Highest amount',
    },
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Recent' },
  ];

  const listEmpty = visibleAccounts.length === 0;
  const creditorFilterActive = creditorFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white shadow-xl shadow-slate-900/20">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              {creditView === 'outstanding' ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total outstanding
                  </p>
                  <p className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">
                    {listEmpty ? formatPrice(0) : formatPrice(totalOutstanding)}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {listEmpty
                      ? searchQuery
                        ? 'No matches in this list'
                        : creditorFilterActive
                          ? 'No matches for this creditor filter'
                          : outstandingCount === 0
                            ? 'Everyone is paid up — switch to Paid up to see them'
                            : 'No balances due in this filtered list'
                      : `Across ${visibleAccounts.length} customer${visibleAccounts.length !== 1 ? 's' : ''}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Paid up
                  </p>
                  <p className="mt-1 text-3xl md:text-4xl font-bold tracking-tight">
                    {listEmpty ? '0' : visibleAccounts.length}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {listEmpty
                      ? searchQuery
                        ? 'No matches in this list'
                        : creditorFilterActive
                          ? 'No matches for this creditor filter'
                          : paidUpCount === 0
                            ? 'No zero-balance accounts yet'
                            : 'Try clearing search'
                      : `Customer${visibleAccounts.length !== 1 ? 's' : ''} with no balance due`}
                  </p>
                </>
              )}
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              {creditView === 'outstanding' ? (
                <DollarSign className="h-7 w-7 text-white/90" />
              ) : (
                <CheckCircle className="h-7 w-7 text-emerald-300" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {canManageCreditProfiles && pendingPublicClaims.length > 0 ? (
        <Card className="overflow-hidden border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-amber-50/90 to-orange-50/70 shadow-lg shadow-amber-900/10 dark:border-amber-600 dark:from-amber-950/50 dark:via-amber-950/40 dark:to-orange-950/25 dark:shadow-black/30">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-900/25 dark:bg-amber-600">
                  <AlertCircle className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Customer claims — pending approval
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-950 dark:text-amber-50">
                    {pendingPublicClaims.length === 1
                      ? '1 claim needs your decision'
                      : `${pendingPublicClaims.length} claims need your decision`}
                  </p>
                  <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/80">
                    Tab payments reduce credit balance; wallet top-ups add store wallet. Reject if the claim is wrong.
                  </p>
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-3 border-t border-amber-300/60 pt-4 dark:border-amber-700/50">
              {pendingPublicClaims.map((claim) => (
                <li
                  key={claim.transactionId}
                  className="flex flex-col gap-3 rounded-xl border border-amber-200/90 bg-white/95 p-4 dark:border-amber-800/40 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {claim.customerName}
                    </p>
                    <p className="mt-1">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          claim.kind === 'wallet'
                            ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {claim.kind === 'wallet' ? 'Wallet top-up' : 'Tab payment'}
                      </span>
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
                      {formatPrice(claim.amount)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {claim.paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'} · Submitted {formatDate(claim.createdAt)}
                    </p>
                    {claim.kind === 'wallet' && claim.customerReference ? (
                      <p className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                        Ref: {claim.customerReference}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="link"
                      className="mt-2 h-auto p-0 text-xs font-medium text-[#1c6a1e] dark:text-emerald-400"
                      onClick={() => void openCreditAccountById(claim.creditAccountId)}
                    >
                      Open customer drawer
                    </Button>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
                      disabled={
                        claimReviewBusy !== null &&
                        claimReviewBusy.transactionId === claim.transactionId
                      }
                      onClick={() => void reviewPublicPaymentClaim(claim, 'reject', claim.creditAccountId)}
                    >
                      {claimReviewBusy?.transactionId === claim.transactionId &&
                      claimReviewBusy.action === 'reject' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1.5" aria-hidden />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                      disabled={
                        claimReviewBusy !== null &&
                        claimReviewBusy.transactionId === claim.transactionId
                      }
                      onClick={() => void reviewPublicPaymentClaim(claim, 'approve', claim.creditAccountId)}
                    >
                      {claimReviewBusy?.transactionId === claim.transactionId &&
                      claimReviewBusy.action === 'approve' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1.5" aria-hidden />
                          Accept
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* View toggle + Search + Sort */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 gap-0.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCreditView('outstanding')}
              className={cn(
                'flex-1 sm:flex-none px-3 py-2 rounded-md text-xs font-medium transition-colors',
                creditView === 'outstanding'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              Outstanding
              <span className="ml-1.5 tabular-nums opacity-70">({outstandingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setCreditView('paid')}
              className={cn(
                'flex-1 sm:flex-none px-3 py-2 rounded-md text-xs font-medium transition-colors',
                creditView === 'paid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              Paid up
              <span className="ml-1.5 tabular-nums opacity-70">({paidUpCount})</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
          <div className="relative w-full sm:w-[min(100%,15rem)] shrink-0">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <select
              value={creditorFilter}
              onChange={(e) => setCreditorFilter(e.target.value)}
              aria-label="Filter by creditor"
              title="Accounts whose latest credit entry was recorded by this staff member"
              className={cn(
                'w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50',
                'pl-10 pr-10 py-3 text-sm text-slate-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]',
                'transition-colors cursor-pointer'
              )}
            >
              <option value="all">All creditors</option>
              {hasCreditorUnknown && (
                <option value="__none__">Unknown / not on file</option>
              )}
              {creditorOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
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
      </div>

      {listEmpty ? (
        <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-[#0f1a0d] overflow-hidden">
          <CardContent className="p-10 md:p-14">
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              <div className="h-20 w-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5 shadow-inner">
                <Sparkles className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {creditView === 'outstanding' ? 'No outstanding credits' : 'No paid-up customers'}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {searchQuery && creditorFilterActive
                  ? 'No customers match this search and creditor filter together. Try adjusting one or both.'
                  : searchQuery
                    ? 'No customers match your search. Try a different name or phone.'
                    : creditorFilterActive
                      ? 'No accounts match the selected creditor. Pick someone else or reset the creditor filter.'
                      : creditView === 'outstanding'
                        ? outstandingCount === 0
                          ? 'There are no outstanding balances. Open Paid up to see customers at zero balance.'
                          : 'No results for the current sort and filters.'
                        : paidUpCount === 0
                          ? 'Customers will appear here once their balance is cleared.'
                          : 'No results for the current sort and filters.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {creditorFilterActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 dark:text-slate-400"
                    onClick={() => setCreditorFilter('all')}
                  >
                    All creditors
                  </Button>
                )}
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 dark:text-slate-400"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear search
                  </Button>
                )}
                {creditView === 'paid' && outstandingCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300 dark:border-slate-600"
                    onClick={() => setCreditView('outstanding')}
                  >
                    Show outstanding
                  </Button>
                )}
                {creditView === 'outstanding' && paidUpCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300 dark:border-slate-600"
                    onClick={() => setCreditView('paid')}
                  >
                    Show paid up
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Creditor list — cards on small/medium, table on large */}
          <div className="space-y-3 lg:hidden">
            {visibleAccounts.map((account, index) => {
              const displayName = toProperCustomerName(account.customer_name);
              const cardPhones = accountPhonesList(account);
              const cardPhonesLine = formatPhonesForDisplay(cardPhones);
              return (
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
                    className="w-full text-left flex items-center gap-3 sm:gap-4 p-4 sm:p-5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      {index + 1}
                    </span>
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-inner"
                      style={{ backgroundColor: avatarColor(displayName) }}
                    >
                      {getInitials(displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {displayName}
                        </h3>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                            creditView === 'outstanding'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                          )}
                        >
                          {creditView === 'outstanding' ? 'Outstanding' : 'Paid up'}
                        </span>
                      </div>
                      {cardPhones.length > 0 && (
                        <p
                          className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2"
                          title={cardPhonesLine}
                        >
                          {cardPhonesLine}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        Last activity: {formatDate(account.last_transaction_at)}
                      </p>
                      {lastCreditByLabel(account) && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                          <User className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate" title={lastCreditByLabel(account) ?? undefined}>
                            Credit: {lastCreditByLabel(account)}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 max-w-[55%]">
                      {creditView === 'paid' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 -mb-1">
                          Lifetime total
                        </span>
                      )}
                      <p
                        className={cn(
                          'font-bold tabular-nums',
                          creditView === 'paid' ? 'text-lg text-emerald-600 dark:text-emerald-400' : 'hidden'
                        )}
                      >
                        {creditView === 'paid' ? formatPrice(lifetimeDebtTotal(account)) : null}
                      </p>
                      <div className={cn('text-right', creditView === 'paid' ? 'space-y-0.5' : '')}>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Credit / wallet
                        </p>
                        <p
                          className={cn(
                            'font-bold tabular-nums leading-snug',
                            creditView === 'outstanding'
                              ? 'text-base sm:text-lg text-amber-600 dark:text-amber-400'
                              : 'text-sm sm:text-base text-slate-700 dark:text-slate-200'
                          )}
                        >
                          {formatCreditWalletSlash(account)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors pointer-events-none',
                          creditView === 'outstanding'
                            ? 'bg-[#1c6a1e] text-white group-hover:bg-[#2a8a30]'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 group-hover:bg-slate-300 dark:group-hover:bg-slate-600'
                        )}
                      >
                        {creditView === 'outstanding' ? 'Collect' : 'View'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                </CardContent>
              </Card>
            );
            })}
          </div>

          <Card className="hidden lg:block overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/50">
                      <th className="text-center px-2 py-3 w-12 font-semibold text-slate-600 dark:text-slate-400">
                        #
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[1%] whitespace-nowrap">
                        Phone
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 min-w-[7rem] max-w-[12rem]">
                        Credit by
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[1%] whitespace-nowrap">
                        Last activity
                      </th>
                      {creditView === 'paid' && (
                        <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[1%] whitespace-nowrap">
                          Amount
                        </th>
                      )}
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[1%] whitespace-nowrap min-w-[9.5rem]">
                        <span className="block">Credit / wallet</span>
                        <span className="block text-[10px] font-normal text-slate-400 dark:text-slate-500 normal-case tracking-normal">
                          tab · store
                        </span>
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 w-[1%] whitespace-nowrap">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAccounts.map((account, index) => {
                      const displayName = toProperCustomerName(account.customer_name);
                      const rowPhones = accountPhonesList(account);
                      const phonesLine = formatPhonesForDisplay(rowPhones);
                      return (
                      <tr
                        key={account.id}
                        onClick={() => handleOpenPaymentDrawer(account)}
                        className={cn(
                          'border-b border-slate-100 dark:border-slate-800 last:border-b-0',
                          'cursor-pointer transition-colors',
                          'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        )}
                      >
                        <td className="px-2 py-3 align-middle text-center tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-inner"
                              style={{ backgroundColor: avatarColor(displayName) }}
                            >
                              {getInitials(displayName)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                  {displayName}
                                </span>
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0',
                                    creditView === 'outstanding'
                                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                                  )}
                                >
                                  {creditView === 'outstanding' ? 'Outstanding' : 'Paid up'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 align-middle text-slate-600 dark:text-slate-400 max-w-[11rem]"
                          title={phonesLine || undefined}
                        >
                          <span className="block truncate text-sm">
                            {rowPhones.length > 0 ? phonesLine : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-400 max-w-[12rem]">
                          <span
                            className="block truncate text-sm"
                            title={lastCreditByLabel(account) ?? undefined}
                          >
                            {lastCreditByLabel(account) ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(account.last_transaction_at)}
                        </td>
                        {creditView === 'paid' && (
                          <td className="px-4 py-3 align-middle text-right font-semibold tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                            {formatPrice(lifetimeDebtTotal(account))}
                          </td>
                        )}
                        <td
                          className={cn(
                            'px-4 py-3 align-middle text-right font-bold tabular-nums whitespace-nowrap',
                            creditView === 'outstanding'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                          )}
                          title={`Tab: ${formatPrice(account.total_credit)} · Wallet: ${formatPrice(accountWalletBalance(account))}`}
                        >
                          {formatCreditWalletSlash(account)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium pointer-events-none',
                              creditView === 'outstanding'
                                ? 'bg-[#1c6a1e] text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                            )}
                          >
                            {creditView === 'outstanding' ? 'Collect' : 'View'}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Payment Drawer */}
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setCustomerEditModalOpen(false);
            setMergeModalOpen(false);
            setTransferModalOpen(false);
            setTransferToUserId('');
            setTransferIncludePayments(false);
            setMergeSearchQuery('');
            setMergeSelectedIds([]);
            setMergeNameOverride('');
            setMergePhonesText('');
          }
        }}
        direction="right"
      >
        <DrawerContent className="!w-full !max-w-[min(100vw,520px)] sm:!max-w-[600px] md:!max-w-[680px] lg:!max-w-[760px] flex h-full max-h-[100dvh] min-h-0 flex-col border-0 border-l border-slate-200/80 dark:border-slate-800 p-0 shadow-2xl shadow-slate-900/15 dark:shadow-black/40">
          <DrawerHeader className="relative shrink-0 overflow-hidden border-0 px-5 pt-5 pb-4 pr-14 bg-gradient-to-br from-emerald-600 via-emerald-800 to-teal-900 dark:from-emerald-950 dark:via-emerald-900 dark:to-slate-950">
            <div
              className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-teal-300/25 dark:bg-teal-500/10 blur-2xl"
              aria-hidden
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 h-9 w-9 rounded-full text-white hover:bg-white/20 z-20 border border-white/10"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex gap-3 items-start">
                <div
                  className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl text-sm sm:text-lg font-bold text-white shadow-lg ring-2 ring-white/30"
                  style={{
                    backgroundColor: selectedAccount
                      ? avatarColor(toProperCustomerName(selectedAccount.customer_name))
                      : 'transparent',
                  }}
                >
                  {selectedAccount
                    ? getInitials(toProperCustomerName(selectedAccount.customer_name))
                    : '—'}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <DrawerTitle className="text-lg sm:text-xl font-bold text-white tracking-tight text-left truncate">
                    {selectedAccount ? toProperCustomerName(selectedAccount.customer_name) : '—'}
                  </DrawerTitle>
                  <DrawerDescription className="text-emerald-100/90 text-xs sm:text-sm mt-1 text-left whitespace-pre-line line-clamp-2 sm:line-clamp-3">
                    {selectedAccount && accountPhonesList(selectedAccount).length > 0
                      ? formatPhonesForDisplay(accountPhonesList(selectedAccount))
                      : 'No phone on file'}
                  </DrawerDescription>
                </div>
                <div className="shrink-0 text-right rounded-2xl bg-black/15 dark:bg-black/25 px-3 py-2 sm:px-3.5 sm:py-2.5 border border-white/15 backdrop-blur-md min-w-[7.75rem] sm:min-w-[9rem]">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-100/85">
                    Credit / wallet
                  </p>
                  {selectedAccount ? (
                    <div className="mt-1.5 space-y-1.5 text-left sm:text-right">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100/70">
                          {selectedAccount.total_credit <= 0 ? 'Tab balance' : 'On tab (due)'}
                        </p>
                        <p className="text-base sm:text-xl font-bold text-white tabular-nums leading-tight">
                          {formatPrice(selectedAccount.total_credit)}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-white/10">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-violet-200/85">
                          Store wallet
                        </p>
                        <p className="text-sm sm:text-lg font-bold text-violet-100 tabular-nums leading-tight">
                          {formatPrice(accountWalletBalance(selectedAccount))}
                        </p>
                      </div>
                      <div className="pt-1 border-t border-white/10">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-rose-200/90 flex items-center gap-1">
                          <Gift className="h-3 w-3 opacity-90 shrink-0" aria-hidden />
                          Loyalty
                        </p>
                        <p className="text-sm sm:text-lg font-bold text-rose-50 tabular-nums leading-tight">
                          {(selectedAccount.loyalty_points_balance ?? 0).toLocaleString('en-KE')} pts
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-white/60 mt-1">—</p>
                  )}
                </div>
              </div>

              {selectedAccount && publicCreditSlug && (
                <div className="rounded-xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/15 to-white/10 dark:from-cyan-950/40 dark:to-white/5 backdrop-blur-sm px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 border border-white/10">
                      <Link2 className="h-4 w-4 text-cyan-100" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
                        Their status page
                      </p>
                      <p
                        className="text-[11px] sm:text-xs font-mono text-white/90 truncate"
                        title={`/c/${publicCreditSlug}`}
                      >
                        /c/{publicCreditSlug}
                      </p>
                      <p className="text-[10px] text-white/55 mt-0.5 leading-snug">
                        Share so they can see what they owe — or that they&apos;re paid up.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 shrink-0 border-0 bg-white/25 text-white hover:bg-white/35 shadow-none text-xs font-semibold sm:self-center"
                    onClick={handleCopyPublicCreditLink}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1.5 opacity-90" aria-hidden />
                    Copy link
                  </Button>
                </div>
              )}

              {canManageCreditProfiles && (
                <div className="rounded-xl border border-white/10 bg-white/10 dark:bg-black/25 backdrop-blur-sm px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-200/90 shrink-0" aria-hidden />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                      Admin tools
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      title="Edit customer name and phone numbers"
                      className="h-8 gap-1.5 border-0 bg-white/20 text-white hover:bg-white/30 shadow-none text-xs font-medium"
                      onClick={() => setCustomerEditModalOpen(true)}
                    >
                      <Smartphone className="h-3.5 w-3.5 opacity-90" aria-hidden />
                      Edit profile
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      title="Merge duplicate credit profiles into this customer"
                      className="h-8 gap-1.5 border-0 bg-amber-500/25 text-white hover:bg-amber-500/40 shadow-none text-xs font-medium"
                      onClick={() => setMergeModalOpen(true)}
                    >
                      <GitMerge className="h-3.5 w-3.5 opacity-90" aria-hidden />
                      Merge
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      title="Reassign staff attribution on credit records"
                      className="h-8 gap-1.5 border-0 bg-white/20 text-white hover:bg-white/30 shadow-none text-xs font-medium"
                      onClick={() => setTransferModalOpen(true)}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
                      Reassign
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-slate-100/80 to-slate-50 dark:from-slate-950 dark:to-slate-900 px-4 py-4 sm:px-5">
            {selectedAccount && (
              <div className="space-y-5 pb-1">
                {/* Items on credit — receipt-style timeline */}
                <section className="space-y-3">
                  <div className="flex items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                      <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-2">
                      Items on credit
                    </h3>
                  </div>
                  <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-0">
                    {loadingDetails ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
                      </div>
                    ) : (
                      (() => {
                        const debtTransactions = transactions.filter((t) => t.type === 'debt');
                        const debtPaid = computeDebtPaidStatus(transactions);
                        if (debtTransactions.length === 0) {
                          return (
                            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-8 text-center">
                              <Package className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No credit history for this account
                              </p>
                            </div>
                          );
                        }
                        return debtTransactions.map((transaction, idx) => {
                          const isPaid = debtPaid.get(transaction.id) ?? false;
                          return (
                            <div
                              key={transaction.id}
                              className={cn(
                                'relative pl-5',
                                idx === debtTransactions.length - 1 ? 'pb-0' : 'pb-4'
                              )}
                            >
                              <div
                                className={cn(
                                  'absolute left-0 top-1.5 h-3 w-3 rounded-full border-2',
                                  isPaid
                                    ? 'bg-emerald-500 border-emerald-400 dark:border-emerald-600'
                                    : 'bg-amber-400 border-amber-300 dark:border-amber-600'
                                )}
                                style={{ marginLeft: '-6px' }}
                              />
                              <div
                                className={cn(
                                  'rounded-xl border p-3 shadow-sm',
                                  isPaid
                                    ? 'border-slate-200/80 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80'
                                    : 'border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/90'
                                )}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span
                                    className={cn(
                                      'text-xs font-medium',
                                      isPaid
                                        ? 'text-slate-500 line-through'
                                        : 'text-slate-600 dark:text-slate-400'
                                    )}
                                  >
                                    {transaction.sale_date
                                      ? new Date(transaction.sale_date * 1000).toLocaleDateString(
                                          'en-KE',
                                          { year: 'numeric', month: 'short', day: 'numeric' }
                                        )
                                      : formatDate(transaction.created_at)}
                                  </span>
                                  <div className="flex items-center">
                                    {isPaid && (
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 mr-2">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Paid
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        'font-semibold',
                                        isPaid
                                          ? 'text-slate-500 line-through text-sm'
                                          : 'text-amber-600 dark:text-amber-400'
                                      )}
                                    >
                                      {formatPrice(transaction.amount)}
                                    </span>
                                  </div>
                                </div>
                                {formatRecorderLabel(transaction.user_name, transaction.recorder_role) ? (
                                  <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-2">
                                    <User className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                                    <span>
                                      Credit by{' '}
                                      <span className="font-medium text-slate-800 dark:text-slate-200">
                                        {formatRecorderLabel(
                                          transaction.user_name,
                                          transaction.recorder_role
                                        )}
                                      </span>
                                    </span>
                                  </p>
                                ) : null}
                                {transaction.items && transaction.items.length > 0 ? (
                                  <div className="space-y-2">
                                    {transaction.items.map((item) => (
                                      <div
                                        key={item.id}
                                        className={cn(
                                          'flex items-center justify-between py-1.5 px-2 rounded-lg',
                                          isPaid ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800'
                                        )}
                                      >
                                        <div className="flex items-center min-w-0">
                                          <Package
                                            className={cn(
                                              'h-3.5 w-3.5 shrink-0 mr-2',
                                              isPaid ? 'text-slate-400' : 'text-slate-500'
                                            )}
                                          />
                                          <span
                                            className={cn(
                                              'text-sm truncate',
                                              isPaid
                                                ? 'text-slate-500 line-through'
                                                : 'text-slate-700 dark:text-slate-300 font-medium'
                                            )}
                                          >
                                            {item.item_name}
                                          </span>
                                        </div>
                                        <div
                                          className={cn(
                                            'flex items-center shrink-0 text-xs',
                                            isPaid && 'line-through text-slate-400'
                                          )}
                                        >
                                          <span className="text-slate-500 dark:text-slate-400 mr-2">
                                            {item.quantity_sold}{' '}
                                            {item.item_unit_type === 'kg'
                                              ? 'kg'
                                              : item.quantity_sold === 1
                                                ? 'pc'
                                                : 'pcs'}
                                          </span>
                                          <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-[4rem] text-right">
                                            {formatPrice(
                                              item.sell_price_per_unit * item.quantity_sold
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
                                    No line-item breakdown (credit not tied to a sale with items).
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </section>

                {(() => {
                  const pendingClaims = transactions.filter(
                    (t) => t.type === 'payment' && t.public_claim_status === 'pending'
                  );
                  const rejectedClaims = transactions.filter(
                    (t) => t.type === 'payment' && t.public_claim_status === 'rejected'
                  );
                  if (pendingClaims.length === 0 && rejectedClaims.length === 0) return null;
                  return (
                    <section className="space-y-3">
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/60">
                          <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                        </div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 ml-2">
                          Pending approval
                        </h3>
                      </div>
                      {pendingClaims.length > 0 ? (
                        <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                          <p className="text-xs text-amber-900 dark:text-amber-200/90">
                            Customer-reported from the public credit link — shown as{' '}
                            <span className="font-semibold">pending approval</span> until you approve or reject.
                          </p>
                          <ul className="space-y-2">
                            {pendingClaims.map((t) => (
                              <li
                                key={t.id}
                                className="flex flex-col gap-2 rounded-lg border border-amber-200/60 bg-white/90 px-3 py-2.5 dark:border-amber-800/50 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
                                      Pending approval
                                    </span>
                                  </div>
                                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                    {formatPrice(t.amount)} ·{' '}
                                    {t.payment_method === 'cash' ? 'Cash' : 'M-Pesa'}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {formatDate(t.created_at)}
                                    {formatRecorderLabel(t.user_name, t.recorder_role)
                                      ? ` · ${formatRecorderLabel(t.user_name, t.recorder_role)}`
                                      : null}
                                  </p>
                                </div>
                                {canManageCreditProfiles ? (
                                  <div className="flex shrink-0 gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 min-w-[4.5rem] text-xs"
                                      disabled={
                                        claimReviewBusy !== null && claimReviewBusy.transactionId === t.id
                                      }
                                      onClick={() =>
                                        selectedAccount &&
                                        void reviewPublicPaymentClaim(
                                          {
                                            kind: 'tab',
                                            transactionId: t.id,
                                            creditAccountId: selectedAccount.id,
                                            customerName: selectedAccount.customer_name,
                                            amount: t.amount,
                                            paymentMethod:
                                              t.payment_method === 'cash' ? 'cash' : 'mpesa',
                                            createdAt: t.created_at,
                                            customerReference: null,
                                          },
                                          'reject',
                                          selectedAccount.id
                                        )
                                      }
                                    >
                                      {claimReviewBusy?.transactionId === t.id &&
                                      claimReviewBusy.action === 'reject' ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        'Reject'
                                      )}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 min-w-[4.5rem] bg-emerald-600 text-xs hover:bg-emerald-700"
                                      disabled={
                                        claimReviewBusy !== null && claimReviewBusy.transactionId === t.id
                                      }
                                      onClick={() =>
                                        selectedAccount &&
                                        void reviewPublicPaymentClaim(
                                          {
                                            kind: 'tab',
                                            transactionId: t.id,
                                            creditAccountId: selectedAccount.id,
                                            customerName: selectedAccount.customer_name,
                                            amount: t.amount,
                                            paymentMethod:
                                              t.payment_method === 'cash' ? 'cash' : 'mpesa',
                                            createdAt: t.created_at,
                                            customerReference: null,
                                          },
                                          'approve',
                                          selectedAccount.id
                                        )
                                      }
                                    >
                                      {claimReviewBusy?.transactionId === t.id &&
                                      claimReviewBusy.action === 'approve' ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        'Accept'
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                                    Pending approval (owner/admin)
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {rejectedClaims.length > 0 ? (
                        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Rejected claims
                          </p>
                          <ul className="space-y-1">
                            {rejectedClaims.map((t) => (
                              <li
                                key={t.id}
                                className="text-xs text-slate-600 dark:text-slate-400 tabular-nums"
                              >
                                {formatPrice(t.amount)} · {formatDate(t.created_at)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </section>
                  );
                })()}
              </div>
            )}
          </div>
          {selectedAccount && (
            <div
              className={cn(
                'shrink-0 border-t border-slate-200/90 dark:border-slate-800',
                'bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-md',
                'px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
                'shadow-[0_-12px_32px_-8px_rgba(15,23,42,0.12)] dark:shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.45)]'
              )}
            >
              {selectedAccount.total_credit > 0 ? (
                <PaymentForm
                  account={selectedAccount}
                  onSuccess={handlePaymentSuccess}
                  compact
                  drawerFooter
                  paymentDrawerDense
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-4 py-4 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Nothing to collect</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    History above shows past credit and payments.
                  </p>
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Admin-only modals (stack above drawer) */}
      <Dialog
        open={Boolean(
          customerEditModalOpen && selectedAccount && canManageCreditProfiles
        )}
        onOpenChange={setCustomerEditModalOpen}
      >
        <DialogContent className="z-[100] max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit customer name &amp; phones</DialogTitle>
            <DialogDescription>
              Add as many numbers as needed. Remove all rows to clear saved phones. Lists and checkout
              match any of these numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Name</label>
              <Input
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                className="h-10 rounded-lg border-slate-200 dark:border-slate-600"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Phone numbers
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEditCustomerPhones((prev) => [...prev, ''])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" aria-hidden />
                  Add number
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {editCustomerPhones.map((phone, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={phone}
                      onChange={(e) =>
                        setEditCustomerPhones((prev) =>
                          prev.map((p, j) => (j === i ? e.target.value : p))
                        )
                      }
                      placeholder="e.g. 0712 345 678"
                      className="h-10 rounded-lg border-slate-200 dark:border-slate-600 flex-1"
                      type="tel"
                      autoComplete="tel"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-slate-500 hover:text-red-600"
                      aria-label={`Remove phone ${i + 1}`}
                      onClick={() =>
                        setEditCustomerPhones((prev) =>
                          prev.length <= 1 ? [''] : prev.filter((_, j) => j !== i)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCustomerEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={editCustomerSaving || !editCustomerName.trim()}
              onClick={() => void handleSaveCustomerDetails()}
            >
              {editCustomerSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(mergeModalOpen && selectedAccount && canManageCreditProfiles)}
        onOpenChange={(open) => {
          setMergeModalOpen(open);
          if (!open) {
            setMergeSelectedIds([]);
            setMergeSearchQuery('');
            setMergeNameOverride('');
            setMergePhonesText('');
          }
        }}
      >
        <DialogContent className="z-[100] max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Merge duplicate customers</DialogTitle>
            <DialogDescription>
              Combine other credit profiles into{' '}
              <span className="font-medium text-foreground">
                {selectedAccount ? toProperCustomerName(selectedAccount.customer_name) : ''}
              </span>
              . Balances and full history move into this profile; merged profiles are removed. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Find profiles to merge
              </label>
              <Input
                value={mergeSearchQuery}
                onChange={(e) => setMergeSearchQuery(e.target.value)}
                placeholder="Search by name or phone…"
                className="h-10 rounded-lg border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-800">
              {mergeCandidates.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 p-3 text-center">
                  No other credit profiles match. Try another search.
                </p>
              ) : (
                mergeCandidates.map((a) => {
                  const candPhones = accountPhonesList(a);
                  return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <input
                      type="checkbox"
                      checked={mergeSelectedIds.includes(a.id)}
                      onChange={() => toggleMergeId(a.id)}
                      className="rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{toProperCustomerName(a.customer_name)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {candPhones.length > 0 ? formatPhonesForDisplay(candPhones) : 'No phone'} ·{' '}
                        {formatCreditWalletSlash(a)} credit / wallet
                      </p>
                    </div>
                  </label>
                  );
                })
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Optional new name
              </label>
              <Input
                value={mergeNameOverride}
                onChange={(e) => setMergeNameOverride(e.target.value)}
                placeholder="Leave blank to keep merged result"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Optional phones after merge (one per line)
              </label>
              <Textarea
                value={mergePhonesText}
                onChange={(e) => setMergePhonesText(e.target.value)}
                placeholder="Leave blank to combine numbers from all merged profiles. If you fill this, it replaces all saved numbers."
                rows={3}
                className="text-sm resize-y min-h-[4.5rem] rounded-lg border-slate-200 dark:border-slate-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-800 dark:hover:bg-amber-700"
              disabled={mergeSelectedIds.length === 0 || mergeSubmitting}
              onClick={() => void handleMergeCustomers()}
            >
              {mergeSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging…
                </>
              ) : (
                `Merge ${mergeSelectedIds.length || '…'} profile(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(transferModalOpen && selectedAccount && canManageCreditProfiles)}
        onOpenChange={(open) => {
          setTransferModalOpen(open);
          if (!open) {
            setTransferToUserId('');
            setTransferIncludePayments(false);
          }
        }}
      >
        <DialogContent className="z-[100] max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign staff on records</DialogTitle>
            <DialogDescription>
              Change who is recorded as having given or collected credit for this customer. By default
              only credit sales are updated; use the option below to include payment records too.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Assign to</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <select
                  value={transferToUserId}
                  onChange={(e) => setTransferToUserId(e.target.value)}
                  aria-label="Transfer credit records to staff member"
                  className={cn(
                    'w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900',
                    'pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-[#1c6a1e]/30 focus:border-[#1c6a1e]'
                  )}
                >
                  <option value="">Select staff member…</option>
                  {transferUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatRecorderLabel(u.name, u.role) ?? u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={transferIncludePayments}
                onChange={(e) => setTransferIncludePayments(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e]"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Also reassign <span className="font-medium">payment</span> records (who is shown as
                having recorded each repayment)
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
              disabled={!transferToUserId || transferSubmitting}
              onClick={() => void handleTransferRecorder()}
            >
              {transferSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating…
                </>
              ) : (
                'Apply transfer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
