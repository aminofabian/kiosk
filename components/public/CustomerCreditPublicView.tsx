'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Copy,
  Gift,
  Loader2,
  PartyPopper,
  Plus,
  Store,
  Wallet,
  Sparkles,
  TrendingDown,
  Banknote,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

type ComingSoonKind = 'wallet' | 'loyalty' | null;

export function CustomerCreditPublicView({ phoneSlug }: { phoneSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicCreditStatusPayload | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [comingSoon, setComingSoon] = useState<ComingSoonKind>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [stkOpen, setStkOpen] = useState(false);
  const [stkStep, setStkStep] = useState<'form' | 'waiting' | 'failed'>('form');
  const [stkSubmitting, setStkSubmitting] = useState(false);
  const [stkOrderId, setStkOrderId] = useState<string | null>(null);
  const [stkFailMessage, setStkFailMessage] = useState<string | null>(null);

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

  const resetStk = useCallback(() => {
    setStkStep('form');
    setStkOrderId(null);
    setStkFailMessage(null);
    setStkSubmitting(false);
  }, []);

  const startStkPayment = useCallback(async () => {
    if (!data || !data.pesapalPromptAvailable) return;
    setStkSubmitting(true);
    setStkFailMessage(null);
    try {
      const enc = encodeURIComponent(phoneSlug);
      const res = await fetch(`/api/public/credit-by-phone/${enc}/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
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
        'PesapalCredit',
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

  const ComingSoonModal = (
    <Dialog open={comingSoon !== null} onOpenChange={(o) => !o && setComingSoon(null)}>
      <DialogContent className={cn(DIALOG_SHELL, 'p-6 pt-8')}>
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            </span>
            Coming soon
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {comingSoon === 'wallet' && (
              <>
                We&apos;re building <strong>store wallet top-ups</strong> so you can add money ahead
                of time and checkout faster. Stay tuned.
              </>
            )}
            {comingSoon === 'loyalty' && (
              <>
                <strong>Loyalty points</strong>, tiers, and member perks are on the way. You&apos;ll
                earn on purchases and unlock rewards here.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
          <Button type="button" className="w-full rounded-xl sm:w-auto" onClick={() => setComingSoon(null)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            This will mark{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatKes(data.totalCredit)}
            </span>{' '}
            as paid on your account. Only continue if you have already paid the store (cash or M-Pesa).
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
            False entries may be reversed by the store. When in doubt, pay at the counter and ask staff to update your
            balance.
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

  const mobileStickyDouble = !data.settled && data.pesapalPromptAvailable;

  return (
    <div
      className={cn(
        'relative min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-slate-100 via-white to-emerald-50/35 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20 sm:pb-10',
        !data.settled && mobileStickyDouble
          ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom))]'
          : !data.settled
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
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Amount due to {data.businessName}
                        </p>
                        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white md:text-4xl">
                          {formatKes(data.totalCredit)}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          Pay with an M-Pesa prompt (opens secure checkout), or if you already paid cash or M-Pesa
                          elsewhere, record it so your balance updates. Staff at the store can help too.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {!data.settled && (
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
                        onClick={() => setStkOpen(true)}
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
                  'border-violet-200/40 bg-gradient-to-br from-violet-50/90 via-white to-white p-4 dark:border-violet-900/30 dark:from-violet-950/25 dark:via-slate-900 dark:to-slate-900 sm:p-5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60">
                    <Wallet className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden />
                  </div>
                  <span className="rounded-full border border-violet-200/60 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                    Soon
                  </span>
                </div>
                <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Store wallet</h2>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-400 dark:text-slate-500">KES 0</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Preload funds for faster checkout.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full rounded-xl border-violet-200 text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-950/40"
                  onClick={() => setComingSoon('wallet')}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add money
                </Button>
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
                  <span className="rounded-full border border-rose-200/60 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    Soon
                  </span>
                </div>
                <h2 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Loyalty</h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Points &amp; perks</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Rewards and member benefits are on the way.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full rounded-xl border-rose-200 text-rose-900 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-100 dark:hover:bg-rose-950/40"
                  onClick={() => setComingSoon('loyalty')}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Learn more
                </Button>
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
              This page reflects the balance we have on file for the number in your link. M-Pesa prompt checkout is
              provided when the store has online payments configured. Recording a payment manually marks your full
              outstanding amount as paid in our system. Wallet and loyalty options will appear here when available.
            </p>
          </footer>
        </div>
      </main>

      {!data.settled && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:hidden">
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_-8px_32px_-4px_rgba(15,23,42,0.12)] backdrop-blur-lg dark:border-slate-700 dark:bg-slate-950/95 dark:shadow-black/40">
            <div className="flex flex-col gap-2">
            {data.pesapalPromptAvailable && (
              <Button
                type="button"
                size="touch-lg"
                variant="outline"
                className={cn(mpesaPromptButtonClass, 'shadow-sm')}
                onClick={() => setStkOpen(true)}
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
          if (!open) resetStk();
        }}
      >
        <DialogContent className={DIALOG_SHELL}>
          <div className="border-b border-slate-100 bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pt-8 pb-5 text-white dark:from-emerald-800 dark:to-teal-900">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Smartphone className="h-5 w-5 text-white" aria-hidden />
                </span>
                Pay with M-Pesa prompt
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-emerald-50/95">
                {stkStep === 'waiting'
                  ? 'Complete the payment in the window that opened (or use the link). This page checks automatically when M-Pesa confirms.'
                  : stkStep === 'failed'
                    ? stkFailMessage || 'The payment did not go through. You can try again or pay at the store.'
                    : `Amount due: ${formatKes(data.totalCredit)}. A secure window will open — enter your M-Pesa details there, same as paying at the till.`}
              </DialogDescription>
          </DialogHeader>
          </div>

          {stkStep === 'form' && (
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Amount to pay
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-900 dark:text-emerald-100">
                  {formatKes(data.totalCredit)}
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

      {PayModal}
      {ComingSoonModal}
    </div>
  );
}
