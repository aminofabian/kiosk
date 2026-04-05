'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  Copy,
  Gift,
  Loader2,
  PartyPopper,
  Plus,
  Store,
  Wallet,
  TrendingDown,
  Banknote,
  ShoppingBag,
  Smartphone,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PublicCreditStatusPayload } from '@/lib/types/public-credit-status';
import {
  PUBLIC_WALLET_TOPUP_MAX_KES,
  PUBLIC_WALLET_TOPUP_MIN_KES,
} from '@/lib/constants/public-wallet-topup';
import { loyaltyPointsEarned } from '@/lib/utils/loyalty-points';

function formatKes(n: number) {
  return `KES ${Math.round(n).toLocaleString('en-KE')}`;
}

function formatCreditWhen(ts: number) {
  return new Date(ts * 1000).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatQty(q: number) {
  return Number.isInteger(q) ? String(q) : q.toLocaleString('en-KE', { maximumFractionDigits: 3 });
}

const SECTION_LABEL =
  'mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400';

const DIALOG_SHELL =
  'gap-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-0 shadow-2xl ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-950 dark:ring-white/[0.06] sm:max-w-md';

const WALLET_TOPUP_PRESETS_KES = [100, 200, 500, 1000, 2000, 5000] as const;

export function CustomerCreditPublicView({ phoneSlug }: { phoneSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicCreditStatusPayload | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [stkOpen, setStkOpen] = useState(false);
  const [stkStep, setStkStep] = useState<'form' | 'waiting' | 'failed'>('form');
  const [stkSubmitting, setStkSubmitting] = useState(false);
  const [stkOrderId, setStkOrderId] = useState<string | null>(null);
  const [stkFailMessage, setStkFailMessage] = useState<string | null>(null);
  const [stkPurpose, setStkPurpose] = useState<'tab' | 'wallet'>('tab');
  const [walletTopupKes, setWalletTopupKes] = useState<number | null>(null);
  const [walletPickOpen, setWalletPickOpen] = useState(false);
  const [walletPickInput, setWalletPickInput] = useState('');
  const [walletPickError, setWalletPickError] = useState<string | null>(null);
  const [walletClaimOpen, setWalletClaimOpen] = useState(false);
  const [walletClaimAmount, setWalletClaimAmount] = useState('');
  const [walletClaimMethod, setWalletClaimMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [walletClaimMpesa, setWalletClaimMpesa] = useState('');
  const [walletClaimNotes, setWalletClaimNotes] = useState('');
  const [walletClaimSubmitting, setWalletClaimSubmitting] = useState(false);
  const stkPurposeRef = useRef(stkPurpose);
  stkPurposeRef.current = stkPurpose;
  const walletTopupKesRef = useRef(walletTopupKes);
  walletTopupKesRef.current = walletTopupKes;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const enc = encodeURIComponent(phoneSlug);
      const res = await fetch(`/api/public/credit-by-phone/${enc}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Could not load this page');
        setData(null);
      } else {
        setData(json.data as PublicCreditStatusPayload);
      }
    } catch {
      setError('Network error. Try again later.');
    } finally {
      setLoading(false);
    }
  }, [phoneSlug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const copyPageLink = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    void navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied — send it to bookmark this status'),
      () => toast.error('Could not copy')
    );
  }, []);

  const submitFullPayment = async () => {
    const enc = encodeURIComponent(phoneSlug);
    setPaySubmitting(true);
    try {
      const res = await fetch(`/api/public/credit-by-phone/${enc}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: payMethod }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Could not record payment');
        return;
      }
      toast.success(json.message || 'Payment recorded');
      setPayOpen(false);
      await loadData();
    } catch {
      toast.error('Network error');
    } finally {
      setPaySubmitting(false);
    }
  };

  const submitWalletClaim = async () => {
    const raw = walletClaimAmount.replace(/,/g, '').trim();
    const amount = Math.round(Number(raw));
    if (
      !Number.isFinite(amount) ||
      amount < PUBLIC_WALLET_TOPUP_MIN_KES ||
      amount > PUBLIC_WALLET_TOPUP_MAX_KES
    ) {
      toast.error(
        `Enter an amount between KES ${PUBLIC_WALLET_TOPUP_MIN_KES.toLocaleString('en-KE')} and KES ${PUBLIC_WALLET_TOPUP_MAX_KES.toLocaleString('en-KE')}`
      );
      return;
    }
    if (walletClaimMethod === 'mpesa') {
      const code = walletClaimMpesa.replace(/\s/g, '').trim();
      if (code.length < 4) {
        toast.error('Enter your M-Pesa confirmation code (transaction ID)');
        return;
      }
    }
    const enc = encodeURIComponent(phoneSlug);
    setWalletClaimSubmitting(true);
    try {
      const res = await fetch(`/api/public/credit-by-phone/${enc}/wallet-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethod: walletClaimMethod,
          mpesaTransactionCode: walletClaimMethod === 'mpesa' ? walletClaimMpesa.trim() : undefined,
          customerReference: walletClaimMethod === 'cash' ? walletClaimMpesa.trim() || undefined : undefined,
          notes: walletClaimNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Could not submit');
        return;
      }
      toast.success(json.message || 'Submitted for review');
      setWalletClaimOpen(false);
      setWalletClaimAmount('');
      setWalletClaimMpesa('');
      setWalletClaimNotes('');
      setWalletClaimMethod('mpesa');
      await loadData();
    } catch {
      toast.error('Network error');
    } finally {
      setWalletClaimSubmitting(false);
    }
  };

  const resetStk = useCallback(() => {
    setStkStep('form');
    setStkOrderId(null);
    setStkFailMessage(null);
    setStkSubmitting(false);
  }, []);

  const openTabStkDialog = useCallback(() => {
    setStkPurpose('tab');
    setWalletTopupKes(null);
    resetStk();
    setStkOpen(true);
  }, [resetStk]);

  const confirmWalletTopupPick = useCallback(() => {
    const raw = walletPickInput.replace(/,/g, '').trim();
    const n = Math.round(Number(raw));
    if (
      !Number.isFinite(n) ||
      n < PUBLIC_WALLET_TOPUP_MIN_KES ||
      n > PUBLIC_WALLET_TOPUP_MAX_KES
    ) {
      setWalletPickError(
        `Enter KES ${PUBLIC_WALLET_TOPUP_MIN_KES.toLocaleString('en-KE')} – ${PUBLIC_WALLET_TOPUP_MAX_KES.toLocaleString('en-KE')}`
      );
      return;
    }
    setWalletPickError(null);
    setWalletTopupKes(n);
    setStkPurpose('wallet');
    setWalletPickOpen(false);
    resetStk();
    setStkOpen(true);
  }, [walletPickInput, resetStk]);

  const startStkPayment = useCallback(async () => {
    if (!data || !data.pesapalPromptAvailable) return;
    const purpose = stkPurposeRef.current;
    const topupKes = walletTopupKesRef.current;
    if (purpose === 'wallet' && (topupKes == null || topupKes < PUBLIC_WALLET_TOPUP_MIN_KES)) {
      toast.error('Choose a valid top-up amount');
      return;
    }
    setStkSubmitting(true);
    setStkFailMessage(null);
    try {
      const enc = encodeURIComponent(phoneSlug);
      const isWallet = purpose === 'wallet';
      const res = await fetch(
        isWallet
          ? `/api/public/credit-by-phone/${enc}/wallet-topup/stk-push`
          : `/api/public/credit-by-phone/${enc}/stk-push`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isWallet ? { amount: topupKes } : {}),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Could not start payment');
        return;
      }
      const { redirectUrl, orderTrackingId } = json.data as {
        redirectUrl: string;
        orderTrackingId: string;
      };
      setStkOrderId(orderTrackingId);
      const w = window.open(
        redirectUrl,
        isWallet ? 'PesapalWallet' : 'PesapalCredit',
        'width=520,height=680,left=80,top=40,scrollbars=yes,resizable=yes'
      );
      if (!w) {
        window.location.href = redirectUrl;
      }
      setStkStep('waiting');
    } catch {
      toast.error('Network error');
    } finally {
      setStkSubmitting(false);
    }
  }, [data, phoneSlug]);

  useEffect(() => {
    if (!stkOpen || stkStep !== 'waiting' || !stkOrderId) return;

    const poll = async () => {
      try {
        const enc = encodeURIComponent(phoneSlug);
        const oid = encodeURIComponent(stkOrderId);
        const res = await fetch(`/api/public/credit-by-phone/${enc}/stk-status/${oid}`);
        const json = await res.json();
        if (!json.success || !json.data) return;
        const { state, message } = json.data as { state: string; message: string };
        if (state === 'completed') {
          toast.success(message || 'Payment received');
          setStkOpen(false);
          resetStk();
          await loadData();
        } else if (state === 'failed') {
          setStkFailMessage(message || 'Payment did not complete');
          setStkStep('failed');
        }
      } catch {
        /* retry on next interval */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(id);
  }, [stkOpen, stkStep, stkOrderId, phoneSlug, loadData, resetStk]);

  if (loading) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-b from-slate-100 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/25">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-emerald-900/10 ring-1 ring-emerald-200/60 dark:bg-slate-900 dark:shadow-black/30 dark:ring-emerald-800/40">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading your credit status…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-b from-slate-100 via-white to-rose-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-rose-950/15">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(244,63,94,0.08),transparent)] dark:bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(244,63,94,0.1),transparent)]"
          aria-hidden
        />
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 px-6 py-10 text-center shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/[0.03] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/40 dark:ring-white/[0.04]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/50">
              <Store className="h-6 w-6 text-rose-600 dark:text-rose-400" aria-hidden />
            </div>
            <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              We couldn&apos;t load this page
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const paidPortion =
    data.lifetimeDebtTotal > 0
      ? Math.min(1, (data.lifetimeDebtTotal - data.totalCredit) / data.lifetimeDebtTotal)
      : data.settled
        ? 1
        : 0;
  const progressDeg = paidPortion * 360;

  const loyaltyPts = data.loyaltyPointsBalance ?? 0;
  const loyaltyRate = data.loyaltyPointsPerKes ?? 0;
  const loyaltyExample100 = loyaltyPointsEarned(100, loyaltyRate);

  const recordPaymentButtonClass = cn(
    'w-full gap-2.5 rounded-2xl border-2 border-emerald-400/90 border-b-emerald-700/30 dark:border-emerald-400/50',
    'bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:from-emerald-700 active:to-emerald-800',
    'text-white font-bold shadow-lg shadow-emerald-600/35 dark:shadow-emerald-900/40',
    'active:scale-[0.99] transition-all duration-150'
  );

  const mpesaPromptButtonClass = cn(
    'w-full gap-2 rounded-2xl border-2 border-emerald-600/90 bg-white font-semibold text-emerald-800',
    'shadow-md shadow-emerald-900/[0.06] hover:border-emerald-600 hover:bg-emerald-50/90 hover:shadow-lg',
    'dark:border-emerald-500/70 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70',
    'active:scale-[0.99] transition-all duration-150'
  );

  const PayModal = (
    <Dialog open={payOpen} onOpenChange={setPayOpen}>
      <DialogContent className={DIALOG_SHELL}>
        <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 px-6 pt-8 pb-5 dark:border-slate-800 dark:from-emerald-950/40 dark:to-slate-900">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Record full payment
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            You&apos;re telling the store you paid{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatKes(data.totalCredit)}
            </span>{' '}
            (cash or M-Pesa). Your balance stays the same until an admin approves the claim.
          </DialogDescription>
        </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            How did you pay?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPayMethod('mpesa')}
              className={cn(
                'rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-all',
                payMethod === 'mpesa'
                  ? 'border-emerald-600 bg-emerald-50 shadow-sm shadow-emerald-900/10 dark:bg-emerald-950/60 dark:text-emerald-50'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              M-Pesa
            </button>
            <button
              type="button"
              onClick={() => setPayMethod('cash')}
              className={cn(
                'rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-all',
                payMethod === 'cash'
                  ? 'border-emerald-600 bg-emerald-50 shadow-sm shadow-emerald-900/10 dark:bg-emerald-950/60 dark:text-emerald-50'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              Cash
            </button>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            The store will review your claim. False entries can be rejected. When in doubt, pay at the counter and ask
            staff to record it.
          </p>
        </div>
        <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setPayOpen(false)}
            disabled={paySubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            disabled={paySubmitting}
            onClick={() => void submitFullPayment()}
          >
            {paySubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Confirm payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const WalletClaimModal = (
    <Dialog open={walletClaimOpen} onOpenChange={setWalletClaimOpen}>
      <DialogContent className={DIALOG_SHELL}>
        <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/95 to-fuchsia-50/40 px-6 pt-8 pb-5 dark:border-slate-800 dark:from-violet-950/40 dark:to-slate-900">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Record wallet top-up
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              If you already sent money to the store (M-Pesa or cash), enter the details below. The store will verify
              before your wallet balance updates.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="wallet-claim-amount">Amount (KES)</Label>
            <Input
              id="wallet-claim-amount"
              inputMode="numeric"
              placeholder={`${PUBLIC_WALLET_TOPUP_MIN_KES} – ${PUBLIC_WALLET_TOPUP_MAX_KES}`}
              value={walletClaimAmount}
              onChange={(e) => setWalletClaimAmount(e.target.value)}
              className="h-12 rounded-xl text-base tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              How did you pay?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWalletClaimMethod('mpesa')}
                className={cn(
                  'rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-all',
                  walletClaimMethod === 'mpesa'
                    ? 'border-violet-600 bg-violet-50 shadow-sm dark:bg-violet-950/60 dark:text-violet-50'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                )}
              >
                M-Pesa
              </button>
              <button
                type="button"
                onClick={() => setWalletClaimMethod('cash')}
                className={cn(
                  'rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-all',
                  walletClaimMethod === 'cash'
                    ? 'border-violet-600 bg-violet-50 shadow-sm dark:bg-violet-950/60 dark:text-violet-50'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                )}
              >
                Cash
              </button>
            </div>
          </div>
          {walletClaimMethod === 'mpesa' ? (
            <div className="space-y-2">
              <Label htmlFor="wallet-claim-mpesa">M-Pesa confirmation code</Label>
              <Input
                id="wallet-claim-mpesa"
                placeholder="e.g. QAB1CDE2FG"
                value={walletClaimMpesa}
                onChange={(e) => setWalletClaimMpesa(e.target.value)}
                className="h-12 rounded-xl font-mono text-base uppercase"
                autoCapitalize="characters"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="wallet-claim-cash-ref">Receipt / reference (optional)</Label>
              <Input
                id="wallet-claim-cash-ref"
                placeholder="If you have a receipt number"
                value={walletClaimMpesa}
                onChange={(e) => setWalletClaimMpesa(e.target.value)}
                className="h-12 rounded-xl font-mono text-sm"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="wallet-claim-notes">Note to the store (optional)</Label>
            <Textarea
              id="wallet-claim-notes"
              placeholder="Anything else that helps verify your payment"
              value={walletClaimNotes}
              onChange={(e) => setWalletClaimNotes(e.target.value)}
              rows={3}
              className="min-h-[4.5rem] rounded-xl resize-none text-sm"
            />
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            False claims can be rejected. When in doubt, pay at the counter and ask staff to credit your wallet.
          </p>
        </div>
        <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setWalletClaimOpen(false)}
            disabled={walletClaimSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-violet-600 hover:bg-violet-700"
            disabled={walletClaimSubmitting}
            onClick={() => void submitWalletClaim()}
          >
            {walletClaimSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit for approval'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const cardSurface = cn(
    'rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(15,118,110,0.14)]',
    'dark:border-slate-700/70 dark:bg-slate-900/95 dark:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.55)]'
  );

  const balanceDial = data.settled ? (
    <div className="relative mx-auto flex h-40 w-40 shrink-0 items-center justify-center sm:mx-0 sm:h-44 sm:w-44">
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-400/15 blur-[2px] dark:from-emerald-500/20 dark:to-teal-600/10"
        aria-hidden
      />
      <div className="relative flex h-[7.25rem] w-[7.25rem] flex-col items-center justify-center rounded-full border border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/40 shadow-lg shadow-emerald-900/10 ring-4 ring-emerald-500/10 dark:border-emerald-700/50 dark:from-slate-900 dark:to-emerald-950/30 dark:shadow-black/30 dark:ring-emerald-500/15 sm:h-36 sm:w-36">
        <PartyPopper className="h-9 w-9 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
          Paid up
        </span>
      </div>
    </div>
  ) : (
    <div className="relative mx-auto flex h-40 w-40 shrink-0 items-center justify-center sm:mx-0 sm:h-44 sm:w-44">
      <div
        className="absolute inset-2 rounded-full shadow-inner shadow-slate-900/5 dark:shadow-black/20"
        style={{
          background: `conic-gradient(from -90deg, rgb(16 185 129) ${progressDeg}deg, rgb(241 245 249) ${progressDeg}deg)`,
        }}
        aria-hidden
      />
      <div className="dark:shadow-black/40 absolute inset-[1.35rem] flex flex-col items-center justify-center rounded-full border border-white/80 bg-gradient-to-b from-white to-slate-50/90 shadow-md ring-1 ring-slate-900/[0.04] dark:border-slate-600 dark:from-slate-900 dark:to-slate-950 dark:ring-white/[0.06] sm:inset-6">
        <TrendingDown className="mb-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400 sm:h-6 sm:w-6" aria-hidden />
        <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white sm:text-lg">
          {formatKes(data.totalCredit)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Outstanding
        </span>
      </div>
    </div>
  );

  const pendingWalletApprovals = data.pendingWalletApprovals ?? [];
  const showPayButtons = !data.settled && data.pendingPaymentApprovals.length === 0;
  const mobileStickyDouble = showPayButtons && data.pesapalPromptAvailable;
  const pendingTotalKes = data.pendingPaymentApprovals.reduce((s, p) => s + p.amount, 0);
  const pendingWalletTotalKes = pendingWalletApprovals.reduce((s, p) => s + p.amount, 0);
  const anyPendingApproval =
    data.pendingPaymentApprovals.length > 0 || pendingWalletApprovals.length > 0;

  return (
    <div
      className={cn(
        'relative min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-slate-100 via-white to-emerald-50/35 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20 sm:pb-10',
        showPayButtons && mobileStickyDouble
          ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom))]'
          : showPayButtons
            ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom))]'
            : 'pb-8'
      )}
    >
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(16,185,129,0.11),transparent)] dark:bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(16,185,129,0.14),transparent)]"
        aria-hidden
      />
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 shadow-sm shadow-slate-900/[0.03] backdrop-blur-lg dark:border-slate-800/80 dark:bg-slate-950/85 dark:shadow-black/20">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-900/20 dark:shadow-black/40">
            <Store className="h-[1.15rem] w-[1.15rem] text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {data.businessName}
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Customer credit
            </p>
          </div>
          {anyPendingApproval ? (
            <span
              className="shrink-0 animate-pulse rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-center text-[10px] font-extrabold uppercase leading-none tracking-wide text-white shadow-md shadow-amber-900/30 ring-2 ring-amber-300/80 dark:from-amber-500 dark:to-orange-600 dark:ring-amber-400/40"
              title="Claim submitted — waiting for the store to approve"
            >
              Pending approval
            </span>
          ) : null}
        </div>
      </header>

      <main className="relative mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-8 sm:space-y-10">
          {/* Page intro */}
          <div>
            <span className="inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
              Your account
            </span>
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">
              Hello, <span className="text-slate-900 dark:text-slate-100">{data.firstName}</span>
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[1.85rem] sm:leading-tight">
              Credit status
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Phone on file:{' '}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-sm font-medium tabular-nums text-slate-800 dark:bg-slate-800/80 dark:text-slate-200">
                {data.maskedPhone}
              </span>
            </p>
          </div>

          {data.pendingPaymentApprovals.length > 0 ? (
            <section
              aria-labelledby="pending-hero-heading"
              className="relative overflow-hidden rounded-3xl border-[3px] border-amber-400 bg-gradient-to-br from-amber-100 via-amber-50 to-orange-50 p-5 shadow-[0_16px_48px_-12px_rgba(217,119,6,0.5)] ring-4 ring-amber-400/25 dark:border-amber-500 dark:from-amber-950 dark:via-amber-950/70 dark:to-orange-950/50 dark:shadow-amber-950/40 dark:ring-amber-500/20 sm:p-7"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-400/30 blur-3xl dark:bg-amber-500/25"
                aria-hidden
              />
              <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-orange-400/20 blur-2xl dark:bg-orange-600/15" aria-hidden />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-900/35 dark:shadow-black/40">
                  <AlertCircle className="h-8 w-8" strokeWidth={2.25} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-800 dark:text-amber-300">
                    Waiting on the store
                  </p>
                  <h2
                    id="pending-hero-heading"
                    className="mt-1.5 text-2xl font-extrabold tracking-tight text-amber-950 dark:text-amber-50 sm:text-[1.65rem] sm:leading-tight"
                  >
                    Payment pending approval
                  </h2>
                  <p className="mt-3 text-base font-semibold leading-snug text-amber-950 dark:text-amber-100">
                    <span className="tabular-nums">{formatKes(pendingTotalKes)}</span> submitted
                    {data.pendingPaymentApprovals.length > 1 ? ` (${data.pendingPaymentApprovals.length} claims)` : ''}.
                    Your balance stays{' '}
                    <span className="tabular-nums text-amber-950 underline decoration-amber-600/50 decoration-2 underline-offset-2 dark:text-amber-50">
                      {formatKes(data.totalCredit)}
                    </span>{' '}
                    until staff approve or reject.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/85">
                    Check back here after the store confirms — pay and record options stay off until then.
                  </p>
                  <ul className="mt-5 space-y-3 border-t border-amber-400/40 pt-5 dark:border-amber-600/40">
                    {data.pendingPaymentApprovals.map((p, i) => (
                      <li
                        key={`${p.submittedAt}-${i}`}
                        className="flex flex-col gap-2 rounded-2xl border-2 border-amber-300/80 bg-white/95 px-4 py-3.5 shadow-sm dark:border-amber-700/50 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-lg font-bold tabular-nums text-amber-950 dark:text-amber-50">
                            {formatKes(p.amount)}
                          </p>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            {p.paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'} · Submitted{' '}
                            {formatCreditWhen(p.submittedAt)}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-amber-600 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-md shadow-amber-900/25 sm:self-center">
                          <Clock className="h-3.5 w-3.5 opacity-90" aria-hidden />
                          Pending approval
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {pendingWalletApprovals.length > 0 ? (
            <section
              aria-labelledby="pending-wallet-heading"
              className="relative overflow-hidden rounded-3xl border-[3px] border-violet-400 bg-gradient-to-br from-violet-100 via-violet-50 to-fuchsia-50 p-5 shadow-[0_16px_48px_-12px_rgba(139,92,246,0.35)] ring-4 ring-violet-400/20 dark:border-violet-500 dark:from-violet-950 dark:via-violet-950/70 dark:to-fuchsia-950/40 dark:shadow-violet-950/30 dark:ring-violet-500/15 sm:p-7"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/20"
                aria-hidden
              />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30 dark:shadow-black/40">
                  <Wallet className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-900 dark:text-violet-300">
                    Wallet top-up — pending
                  </p>
                  <h2
                    id="pending-wallet-heading"
                    className="mt-1.5 text-xl font-extrabold tracking-tight text-violet-950 dark:text-violet-50 sm:text-2xl sm:leading-tight"
                  >
                    Waiting for the store to confirm
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-snug text-violet-950 dark:text-violet-100">
                    <span className="tabular-nums">{formatKes(pendingWalletTotalKes)}</span> submitted
                    {pendingWalletApprovals.length > 1 ? ` (${pendingWalletApprovals.length} claims)` : ''}. Your
                    wallet balance stays{' '}
                    <span className="tabular-nums underline decoration-violet-500/50 decoration-2 underline-offset-2">
                      {formatKes(data.walletBalance)}
                    </span>{' '}
                    until staff approve.
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-violet-400/40 pt-4 dark:border-violet-600/40">
                    {pendingWalletApprovals.map((p, i) => (
                      <li
                        key={`${p.submittedAt}-${i}`}
                        className="flex flex-col gap-1 rounded-2xl border-2 border-violet-300/80 bg-white/95 px-4 py-3 dark:border-violet-800/50 dark:bg-slate-900/70"
                      >
                        <p className="text-lg font-bold tabular-nums text-violet-950 dark:text-violet-50">
                          {formatKes(p.amount)}
                        </p>
                        <p className="text-sm text-violet-900 dark:text-violet-200">
                          {p.paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'} · {formatCreditWhen(p.submittedAt)}
                        </p>
                        {p.reference ? (
                          <p className="font-mono text-xs text-violet-800 dark:text-violet-300">Ref: {p.reference}</p>
                        ) : null}
                        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                          <Clock className="h-3 w-3" aria-hidden />
                          Pending
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {/* Primary: balance */}
          <section aria-labelledby="balance-heading">
            <p id="balance-heading" className={SECTION_LABEL}>
              Current balance
            </p>
            <div
              className={cn(
                cardSurface,
                'relative overflow-hidden',
                !data.settled &&
                  'before:absolute before:inset-x-0 before:top-0 before:z-[1] before:h-[3px] before:bg-gradient-to-r before:from-emerald-500 before:via-teal-500 before:to-emerald-600',
                data.settled &&
                  'before:absolute before:inset-x-0 before:top-0 before:z-[1] before:h-[3px] before:bg-gradient-to-r before:from-emerald-400 before:via-teal-500 before:to-emerald-500'
              )}
            >
              <div className="p-4 sm:p-6">
                <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-start md:gap-8">
                  <div className="flex shrink-0 justify-center md:justify-start">{balanceDial}</div>
                  <div className="min-w-0 w-full flex-1 text-center md:text-left">
                    {data.settled ? (
                      <>
                        <div className="mb-2 flex justify-center md:justify-start">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            No balance due
                          </span>
                        </div>
                        <p className="text-base font-medium text-slate-900 dark:text-slate-100">
                          You&apos;re all caught up
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          Nothing is outstanding on this account. Bookmark this page to check again anytime.
                        </p>
                        <p className="mt-4 rounded-xl border border-violet-200/70 bg-violet-50/60 px-3 py-2.5 text-left dark:border-violet-900/50 dark:bg-violet-950/30">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                            Store wallet
                          </span>
                          <span className="mt-0.5 block text-lg font-semibold tabular-nums text-violet-950 dark:text-violet-100">
                            {formatKes(data.walletBalance)}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/80">
                            Usable toward purchases at the till (separate from tab balance).
                          </span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Amount due to {data.businessName}
                        </p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white md:text-4xl">
                          {formatKes(data.totalCredit)}
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Store wallet</span>{' '}
                          <span className="font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                            {formatKes(data.walletBalance)}
                          </span>
                          <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Prepaid balance at {data.businessName} — staff can apply it when you pay at the till.
                          </span>
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {data.pendingPaymentApprovals.length > 0 ? (
                            <>
                              We&apos;re waiting for the store to confirm your submitted payment. You can use pay / record
                              options again after they approve or reject your claim. Staff can help if you need to follow
                              up.
                            </>
                          ) : (
                            <>
                              Pay with an M-Pesa prompt (opens secure checkout), or if you already paid cash or M-Pesa
                              elsewhere, record it so the store can approve and update your balance. Staff at the store
                              can help too.
                            </>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {showPayButtons && (
                  <div
                    className={cn(
                      'mt-6 hidden w-full min-w-0 gap-2.5 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid',
                      data.pesapalPromptAvailable ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                    )}
                  >
                    {data.pesapalPromptAvailable && (
                      <Button
                        type="button"
                        size="touch"
                        variant="outline"
                        className={cn(
                          mpesaPromptButtonClass,
                          'h-auto min-h-12 w-full min-w-0 whitespace-normal px-3 text-balance sm:px-4'
                        )}
                        onClick={() => openTabStkDialog()}
                      >
                        <Smartphone className="h-5 w-5 shrink-0" aria-hidden />
                        Pay with M-Pesa prompt
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="touch"
                      className={cn(
                        recordPaymentButtonClass,
                        'h-auto min-h-12 w-full min-w-0 whitespace-normal px-3 text-balance sm:px-4'
                      )}
                      onClick={() => setPayOpen(true)}
                    >
                      <Banknote className="h-5 w-5 shrink-0" aria-hidden />
                      Record payment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Activity */}
          <section aria-labelledby="activity-heading">
            <p id="activity-heading" className={SECTION_LABEL}>
              Activity
            </p>
            <div className={cn(cardSurface, 'overflow-hidden')}>
              <div className="grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-slate-700/80">
                <div className="px-2 py-4 text-center transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 sm:py-5">
                  <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white sm:text-2xl">
                    {data.debtCount}
                  </p>
                  <p className="mt-1 px-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400 sm:text-[11px]">
                    Credit notes
                  </p>
                </div>
                <div className="px-2 py-4 text-center transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 sm:py-5">
                  <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white sm:text-2xl">
                    {data.paymentCount}
                  </p>
                  <p className="mt-1 px-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400 sm:text-[11px]">
                    Payments
                  </p>
                </div>
                <div className="px-2 py-4 text-center transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 sm:py-5">
                  <p className="text-sm font-semibold tabular-nums leading-tight text-slate-900 dark:text-white sm:text-base">
                    {formatKes(data.lifetimeDebtTotal)}
                  </p>
                  <p className="mt-1 px-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400 sm:text-[11px]">
                    Lifetime on credit
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Coming soon features */}
          <section aria-labelledby="more-heading">
            <p id="more-heading" className={SECTION_LABEL}>
              More from this store
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div
                className={cn(
                  cardSurface,
                  'min-w-0 border-violet-200/40 bg-gradient-to-br from-violet-50/90 via-white to-white p-4 dark:border-violet-900/30 dark:from-violet-950/25 dark:via-slate-900 dark:to-slate-900 sm:p-5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60">
                    <Wallet className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden />
                  </div>
                  {data.pesapalPromptAvailable ? (
                    <span className="rounded-full border border-violet-200/60 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                      M-Pesa
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Store wallet</h2>
                <p className="mt-1 text-lg font-semibold tabular-nums text-violet-800 dark:text-violet-200">
                  {formatKes(data.walletBalance)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {data.pesapalPromptAvailable
                    ? 'Pay instantly with M-Pesa, or record a payment you already made (amount + confirmation code) for staff to approve.'
                    : 'Record a top-up you already made for staff to approve, or ask them to add money at the store.'}
                </p>
                <div className="mt-4 flex w-full min-w-0 flex-col gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-auto min-h-11 w-full min-w-0 justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold leading-snug',
                      'whitespace-normal text-balance shadow-sm',
                      'border-violet-300 bg-white/90 text-violet-900 hover:bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-100 dark:hover:bg-violet-950/55'
                    )}
                    disabled={!data.pesapalPromptAvailable}
                    onClick={() => {
                      if (!data.pesapalPromptAvailable) {
                        toast.error(
                          'M-Pesa checkout is not set up for this store yet. Ask staff to top up your wallet at the till.'
                        );
                        return;
                      }
                      setWalletPickInput('');
                      setWalletPickError(null);
                      setWalletPickOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    Add money
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-auto min-h-11 w-full min-w-0 justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-semibold leading-snug',
                      'whitespace-normal text-balance shadow-sm',
                      'border-violet-400/70 bg-violet-50/50 text-violet-900 hover:bg-violet-100/80 dark:border-violet-600/60 dark:bg-violet-950/25 dark:text-violet-100 dark:hover:bg-violet-950/45'
                    )}
                    onClick={() => {
                      setWalletClaimAmount('');
                      setWalletClaimMpesa('');
                      setWalletClaimNotes('');
                      setWalletClaimMethod('mpesa');
                      setWalletClaimOpen(true);
                    }}
                  >
                    <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                    Record top-up
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  cardSurface,
                  'border-rose-200/40 bg-gradient-to-br from-rose-50/90 via-white to-white p-4 dark:border-rose-900/25 dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900 sm:p-5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/50">
                    <Gift className="h-5 w-5 text-rose-700 dark:text-rose-300" aria-hidden />
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      loyaltyRate > 0
                        ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'border-slate-200/70 bg-white/80 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400'
                    )}
                  >
                    {loyaltyRate > 0 ? 'Earning on' : 'Earning off'}
                  </span>
                </div>
                <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Loyalty points</h2>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                  {loyaltyPts.toLocaleString('en-KE')}
                  <span className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    pts
                  </span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {loyaltyRate > 0 ? (
                    <>
                      When the store links your tab or wallet at checkout, you earn about{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                        {loyaltyExample100}
                      </span>{' '}
                      point{loyaltyExample100 === 1 ? '' : 's'} per {formatKes(100)} spent (whole points only; exact
                      total depends on each sale).
                    </>
                  ) : (
                    <>
                      This store has not enabled point earning yet. Your balance stays on file for when they turn it
                      on.
                    </>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section aria-label="Actions">
            <div className="flex flex-col gap-3 sm:flex-row">
              {data.debtDetails.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 gap-2 rounded-xl border-slate-200/90 bg-white/90 font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setItemsOpen(true)}
                >
                  <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
                  Items on credit
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 gap-2 rounded-xl border-slate-200/90 bg-white/90 font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={copyPageLink}
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                Copy page link
              </Button>
            </div>
          </section>

          <footer className="rounded-xl border border-slate-200/60 bg-slate-50/50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              This page reflects the tab balance and store wallet we have on file for the number in your link. M-Pesa
              prompt checkout is provided when the store has online payments configured. Recording a payment manually
              sends a claim to the store; your tab balance updates after they approve it. You can also record a wallet
              top-up you already made (amount and M-Pesa code) for staff to approve. Loyalty points accrue when the
              store links you at checkout and has earning turned on in settings.
            </p>
          </footer>
        </div>
      </main>

      {showPayButtons && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:hidden">
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_-8px_32px_-4px_rgba(15,23,42,0.12)] backdrop-blur-lg dark:border-slate-700 dark:bg-slate-950/95 dark:shadow-black/40">
            <div className="flex flex-col gap-2">
            {data.pesapalPromptAvailable && (
              <Button
                type="button"
                size="touch-lg"
                variant="outline"
                className={cn(mpesaPromptButtonClass, 'shadow-sm')}
                onClick={() => openTabStkDialog()}
              >
                <Smartphone className="h-5 w-5 shrink-0" aria-hidden />
                M-Pesa prompt · {formatKes(data.totalCredit)}
              </Button>
            )}
            <Button type="button" size="touch-lg" className={recordPaymentButtonClass} onClick={() => setPayOpen(true)}>
              <Banknote className="h-6 w-6 shrink-0" aria-hidden />
              Record payment · {formatKes(data.totalCredit)}
            </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
        <DialogContent
          className={cn(
            DIALOG_SHELL,
            'flex max-h-[min(90dvh,640px)] flex-col p-0 sm:max-w-md'
          )}
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/40 px-6 pt-8 pb-4 dark:border-slate-800 dark:from-slate-900 dark:to-emerald-950/20">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-3 pr-8 text-lg font-semibold tracking-tight">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60">
                  <ShoppingBag className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                </span>
                Items on your credit
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Line items from purchases recorded as credit at {data.businessName}. Amounts are from the time of each
              sale.
            </DialogDescription>
          </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {data.debtDetails.map((entry, idx) => (
              <div
                key={`${entry.recordedAt}-${idx}`}
                className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatCreditWhen(entry.recordedAt)}</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatKes(entry.amount)}
                  </p>
                </div>
                {entry.note ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{entry.note}</p>
                ) : null}
                {entry.items.length > 0 ? (
                  <ul className="mt-3 space-y-2 border-t border-slate-200/80 pt-3 dark:border-slate-700">
                    {entry.items.map((line, li) => (
                      <li
                        key={`${line.name}-${li}`}
                        className="flex justify-between gap-3 text-sm text-slate-800 dark:text-slate-200"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{line.name}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            · {formatQty(line.quantity)} {line.unitLabel}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                          {formatKes(line.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-t border-slate-200/80 pt-3 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No line-item breakdown — this entry may have been added manually at the store.
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 sm:justify-end">
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setItemsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stkOpen}
        onOpenChange={(open) => {
          setStkOpen(open);
          if (!open) {
            resetStk();
            setStkPurpose('tab');
            setWalletTopupKes(null);
          }
        }}
      >
        <DialogContent className={DIALOG_SHELL}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pt-8 pb-5 text-white dark:from-emerald-800 dark:to-teal-900">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Smartphone className="h-5 w-5 text-white" aria-hidden />
                </span>
                {stkPurpose === 'wallet' ? 'Top up store wallet' : 'Pay with M-Pesa prompt'}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-emerald-50/95">
                {stkStep === 'waiting'
                  ? 'Complete the payment in the window that opened (or use the link). This page checks automatically when M-Pesa confirms.'
                  : stkStep === 'failed'
                    ? stkFailMessage || 'The payment did not go through. You can try again or pay at the store.'
                    : stkPurpose === 'wallet' && walletTopupKes != null
                      ? `You are adding ${formatKes(walletTopupKes)} to your store wallet at ${data.businessName}. A secure window will open — complete M-Pesa there.`
                      : `Amount due: ${formatKes(data.totalCredit)}. A secure window will open — enter your M-Pesa details there, same as paying at the till.`}
              </DialogDescription>
          </DialogHeader>
          </div>

          {stkStep === 'form' && (
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  {stkPurpose === 'wallet' ? 'Top-up amount' : 'Amount to pay'}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-900 dark:text-emerald-100">
                  {stkPurpose === 'wallet' && walletTopupKes != null
                    ? formatKes(walletTopupKes)
                    : formatKes(data.totalCredit)}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Tap continue to open Pesapal&apos;s payment window. Enter your Safaricom number there to get the M-Pesa
                prompt — we don&apos;t collect your number on this page.
              </p>
            </div>
          )}

          {stkStep === 'waiting' && (
            <div className="flex flex-col items-center gap-4 px-6 py-8">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30 dark:bg-emerald-500/20" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden />
                </div>
              </div>
              <p className="max-w-[240px] text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Waiting for M-Pesa confirmation…
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50 sm:justify-end">
            {stkStep === 'form' && (
              <>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStkOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  disabled={stkSubmitting}
                  onClick={() => void startStkPayment()}
                >
                  {stkSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Starting…
                    </>
                  ) : (
                    'Continue to payment'
                  )}
                </Button>
              </>
            )}
            {stkStep === 'waiting' && (
              <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => setStkOpen(false)}>
                Close (payment may still complete)
              </Button>
            )}
            {stkStep === 'failed' && (
              <>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStkOpen(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  onClick={() => {
                    resetStk();
                  }}
                >
                  Try again
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={walletPickOpen}
        onOpenChange={(o) => {
          setWalletPickOpen(o);
          if (!o) {
            setWalletPickError(null);
          }
        }}
      >
        <DialogContent className={cn(DIALOG_SHELL, 'p-6 pt-8')}>
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60">
                <Wallet className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden />
              </span>
              Top up store wallet
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Choose how much to add. You&apos;ll complete M-Pesa in a secure window; this page updates when payment
              confirms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {WALLET_TOPUP_PRESETS_KES.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setWalletPickInput(String(k));
                    setWalletPickError(null);
                  }}
                  className={cn(
                    'rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors',
                    walletPickInput.replace(/,/g, '').trim() === String(k)
                      ? 'border-violet-600 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                  )}
                >
                  {formatKes(k)}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet-topup-custom">Or enter amount (KES)</Label>
              <Input
                id="wallet-topup-custom"
                inputMode="numeric"
                placeholder={`${PUBLIC_WALLET_TOPUP_MIN_KES} – ${PUBLIC_WALLET_TOPUP_MAX_KES}`}
                value={walletPickInput}
                onChange={(e) => {
                  setWalletPickInput(e.target.value);
                  setWalletPickError(null);
                }}
                className="h-12 rounded-xl text-base tabular-nums"
              />
              {walletPickError ? (
                <p className="text-sm text-rose-600 dark:text-rose-400">{walletPickError}</p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Minimum KES {PUBLIC_WALLET_TOPUP_MIN_KES.toLocaleString('en-KE')}, maximum KES{' '}
                  {PUBLIC_WALLET_TOPUP_MAX_KES.toLocaleString('en-KE')}.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-0 pt-4 dark:border-slate-800 dark:bg-transparent sm:justify-end">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setWalletPickOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl bg-violet-600 hover:bg-violet-700" onClick={confirmWalletTopupPick}>
              Continue to M-Pesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {PayModal}
      {WalletClaimModal}
    </div>
  );
}
