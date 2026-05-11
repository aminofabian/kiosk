"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiGet } from "@/lib/utils/api-client";
import type { CreditAccount } from "@/lib/db/types";
import { creditAccountPhonesDisplay } from "@/lib/utils/credit-phones";

interface CreditFormProps {
  customerName: string;
  customerPhone: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  creditAccountId: string | null;
  onCreditAccountIdChange: (id: string | null) => void;
}

const PHONE_DEBOUNCE_MS = 400;
const PHONE_PREFIX = "+254";

export function CreditForm({
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange,
  creditAccountId,
  onCreditAccountIdChange,
}: CreditFormProps) {
  const [accountsByPhone, setAccountsByPhone] = useState<CreditAccount[]>([]);
  const [loadingByPhone, setLoadingByPhone] = useState(false);

  // Pre-populate with +254 on mount if empty
  useEffect(() => {
    if (!customerPhone) {
      onCustomerPhoneChange(PHONE_PREFIX);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchByPhone = useCallback(
    async (phone: string) => {
      const trimmed = phone.trim();
      if (trimmed.length < 6) {
        setAccountsByPhone([]);
        return;
      }
      setLoadingByPhone(true);
      try {
        const res = await apiGet<CreditAccount[]>(
          `/api/credits?phone=${encodeURIComponent(trimmed)}`,
        );
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
    },
    [onCreditAccountIdChange],
  );

  useEffect(() => {
    if (!customerPhone.trim()) {
      setAccountsByPhone([]);
      onCreditAccountIdChange(null);
      return;
    }
    const timer = setTimeout(() => {
      fetchByPhone(customerPhone);
    }, PHONE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [customerPhone, fetchByPhone, onCreditAccountIdChange]);

  const selectAccount = (id: string) => {
    onCreditAccountIdChange(id);
  };

  const formatPrice = (n: number) =>
    `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const hasMatches = accountsByPhone.length > 0;
  const isNewCustomer =
    !hasMatches && customerPhone.replace(/\D/g, "").length >= 6;

  // Strip +254 prefix — show only editable suffix digits
  const suffix = customerPhone.startsWith(PHONE_PREFIX)
    ? customerPhone.slice(PHONE_PREFIX.length)
    : "";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Phone first - required */}
        <div className="space-y-2">
          <Label htmlFor="customerPhone-suffix">Phone Number *</Label>
          <div className="flex items-stretch h-12">
            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-input bg-muted text-sm font-medium text-muted-foreground select-none shrink-0">
              +254
            </span>
            <Input
              id="customerPhone-suffix"
              type="tel"
              value={suffix}
              onChange={(e) => {
                const raw = e.target.value;
                // Only allow digits, strip leading 0
                let digits = raw.replace(/\D/g, "");
                if (digits.startsWith("0")) {
                  digits = digits.slice(1);
                }
                // Limit to 9 digits
                if (digits.length > 9) {
                  digits = digits.slice(0, 9);
                }
                onCustomerPhoneChange(`${PHONE_PREFIX}${digits}`);
                onCustomerNameChange("");
              }}
              placeholder="722 522 163"
              required
              className="h-12 touch-target rounded-l-none"
              autoComplete="tel"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {suffix.length === 0
              ? "Enter the 9 digits after +254"
              : suffix.length < 9
                ? `${suffix.length}/9 digits`
                : suffix.length === 9
                  ? "✓"
                  : ""}
          </p>
          {suffix.length > 0 && suffix.length < 9 && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Enter all 9 digits to continue
            </p>
          )}
        </div>

        {loadingByPhone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking for existing customer…
          </div>
        )}

        {!loadingByPhone && hasMatches && (
          <div className="space-y-2">
            <Label>Select customer</Label>
            <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
              {accountsByPhone.map((acc) => {
                const phonesLine = creditAccountPhonesDisplay(acc);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => selectAccount(acc.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors touch-target ${
                      creditAccountId === acc.id
                        ? "border-[#1c6a1e] bg-[#1c6a1e]/10"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium truncate">
                      {acc.customer_name}
                    </div>
                    {phonesLine ? (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {phonesLine}
                      </div>
                    ) : null}
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Credit / wallet
                      </p>
                      <p className="text-sm font-semibold text-[#1c6a1e] tabular-nums leading-snug">
                        {formatPrice(acc.total_credit)}
                        <span className="text-slate-400 dark:text-slate-500 font-normal mx-1">
                          /
                        </span>
                        {formatPrice(acc.wallet_balance ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Tab · store wallet
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Select the customer above. Use a different phone number to add a
              new customer.
            </p>
          </div>
        )}

        {!loadingByPhone && isNewCustomer && (
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name *</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
              placeholder="Enter customer name"
              required
              className="h-12 touch-target"
            />
            <p className="text-xs text-muted-foreground">
              No existing account found. Enter name to create new credit
              account.
            </p>
          </div>
        )}

        {!loadingByPhone &&
          !hasMatches &&
          !isNewCustomer &&
          customerPhone.replace(/\D/g, "").length > 0 && (
            <p className="text-sm text-muted-foreground">
              Enter at least 6 digits to search for existing customers
            </p>
          )}
      </CardContent>
    </Card>
  );
}
