'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { CreditAccount } from '@/lib/db/types';
import { creditAccountPhonesDisplay } from '@/lib/utils/credit-phones';

const PHONE_DEBOUNCE_MS = 400;

interface WalletApplySectionProps {
  cartTotal: number;
  disabled: boolean;
  creditAccountId: string | null;
  onCreditAccountIdChange: (id: string | null) => void;
  walletAmountApplied: number;
  onWalletAmountAppliedChange: (amount: number) => void;
}

export function WalletApplySection({
  cartTotal,
  disabled,
  creditAccountId,
  onCreditAccountIdChange,
  walletAmountApplied,
  onWalletAmountAppliedChange,
}: WalletApplySectionProps) {
  const [phone, setPhone] = useState('');
  const [accountsByPhone, setAccountsByPhone] = useState<CreditAccount[]>([]);
  const [loadingByPhone, setLoadingByPhone] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  /** Tracks last max apply so we can raise toward a new max when cart grows and user had left “full max” applied */
  const prevMaxApplyRef = useRef(0);

  const selected = creditAccountId
    ? accountsByPhone.find((a) => a.id === creditAccountId)
    : null;
  const balance = selected ? Number(selected.wallet_balance ?? 0) : 0;
  const maxApply = Math.min(balance, cartTotal);

  const fetchByPhone = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 6) {
      setAccountsByPhone([]);
      return;
    }
    setLoadingByPhone(true);
    try {
      const res = await apiGet<CreditAccount[]>(`/api/credits?phone=${encodeURIComponent(trimmed)}`);
      if (res.success && res.data) {
        setAccountsByPhone(res.data);
        if (res.data.length === 0) {
          onCreditAccountIdChange(null);
        }
      } else {
        setAccountsByPhone([]);
      }
    } catch {
      setAccountsByPhone([]);
    } finally {
      setLoadingByPhone(false);
    }
  }, [onCreditAccountIdChange]);

  useEffect(() => {
    if (!phone.trim()) {
      setAccountsByPhone([]);
      onCreditAccountIdChange(null);
      return;
    }
    const t = setTimeout(() => fetchByPhone(phone), PHONE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [phone, fetchByPhone, onCreditAccountIdChange]);

  useEffect(() => {
    if (walletAmountApplied <= 0) {
      setAmountInput('');
    } else {
      setAmountInput(String(walletAmountApplied));
    }
  }, [walletAmountApplied]);

  /** Keep applied amount valid when cart or balance changes; if user was at previous max and max grows, follow up to new max */
  useEffect(() => {
    if (!creditAccountId) {
      prevMaxApplyRef.current = 0;
      return;
    }
    const roundedMax = Math.round(maxApply * 100) / 100;
    const prevMax = prevMaxApplyRef.current;
    prevMaxApplyRef.current = roundedMax;

    if (roundedMax < 0.01) {
      if (walletAmountApplied > 0.01) {
        onWalletAmountAppliedChange(0);
      }
      return;
    }
    if (walletAmountApplied > roundedMax + 0.01) {
      onWalletAmountAppliedChange(roundedMax);
      return;
    }
    if (
      prevMax > 0.01 &&
      Math.abs(walletAmountApplied - prevMax) < 0.02 &&
      roundedMax > prevMax + 0.01
    ) {
      onWalletAmountAppliedChange(roundedMax);
    }
  }, [
    creditAccountId,
    maxApply,
    walletAmountApplied,
    onWalletAmountAppliedChange,
  ]);

  const selectAccount = (acc: CreditAccount) => {
    onCreditAccountIdChange(acc.id);
    const bal = Number(acc.wallet_balance ?? 0);
    const max = Math.min(bal, cartTotal);
    const applied = Math.round(Math.max(0, Math.min(max, cartTotal)) * 100) / 100;
    prevMaxApplyRef.current = applied;
    onWalletAmountAppliedChange(applied);
    setAmountInput(applied > 0.01 ? String(applied) : '');
  };

  const applyParsedAmount = (raw: string) => {
    const n = Math.round((parseFloat(raw) || 0) * 100) / 100;
    const capped = Math.max(0, Math.min(n, maxApply));
    onWalletAmountAppliedChange(capped);
    setAmountInput(capped > 0 ? String(capped) : '');
  };

  const formatPrice = (n: number) =>
    `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <Card className="border-violet-200/80 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
            Store wallet (optional)
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Look up a customer to use their prepaid balance. The amount defaults to the maximum that can apply to this
            cart. Cash overpayment can still go to the same customer&apos;s wallet.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="walletPhone">Customer phone</Label>
          <Input
            id="walletPhone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              onCreditAccountIdChange(null);
              onWalletAmountAppliedChange(0);
            }}
            placeholder="e.g., 0712345678"
            disabled={disabled}
            className="h-11 touch-target"
            autoComplete="tel"
          />
        </div>

        {loadingByPhone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up customer…
          </div>
        )}

        {!loadingByPhone && accountsByPhone.length > 0 && (
          <div className="space-y-2">
            <Label>Select customer</Label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-white dark:bg-slate-900">
              {accountsByPhone.map((acc) => {
                const wb = Number(acc.wallet_balance ?? 0);
                const phonesLine = creditAccountPhonesDisplay(acc);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectAccount(acc)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                      creditAccountId === acc.id
                        ? 'bg-violet-600 text-white'
                        : 'hover:bg-violet-100 dark:hover:bg-violet-900/40'
                    }`}
                  >
                    <span className="font-medium block">{acc.customer_name}</span>
                    <span className={`text-xs ${creditAccountId === acc.id ? 'text-violet-100' : 'text-muted-foreground'}`}>
                      {phonesLine}
                    </span>
                    <span className={`text-xs block mt-0.5 ${creditAccountId === acc.id ? 'text-violet-100' : 'text-violet-700 dark:text-violet-300'}`}>
                      Wallet {formatPrice(wb)}
                      {acc.total_credit > 0 && (
                        <span className="opacity-80"> · Tab {formatPrice(acc.total_credit)}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {creditAccountId && cartTotal > 0 && (
          <div className="space-y-2 pt-1 border-t border-violet-200/60 dark:border-violet-800/50">
            <Label htmlFor="walletAmount">
              Pay from wallet · max {formatPrice(maxApply)} (default)
            </Label>
            <div className="flex gap-2">
              <Input
                id="walletAmount"
                type="number"
                step="1"
                min={0}
                max={maxApply}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onBlur={() => applyParsedAmount(amountInput)}
                disabled={disabled || balance < 0.01}
                className="h-11"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 h-11"
                disabled={disabled || maxApply < 0.01}
                onClick={() => {
                  onWalletAmountAppliedChange(maxApply);
                  setAmountInput(maxApply > 0 ? String(maxApply) : '');
                }}
              >
                Max
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 h-11"
                disabled={disabled || walletAmountApplied < 0.01}
                onClick={() => {
                  onWalletAmountAppliedChange(0);
                  setAmountInput('');
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
