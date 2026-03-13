'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { CreditAccount } from '@/lib/db/types';

interface CreditFormProps {
  customerName: string;
  customerPhone: string;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  creditAccountId: string | null;
  onCreditAccountIdChange: (id: string | null) => void;
}

const PHONE_DEBOUNCE_MS = 400;

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

  const fetchByPhone = useCallback(async (phone: string) => {
    const trimmed = phone.trim();
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
    `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const hasMatches = accountsByPhone.length > 0;
  const isNewCustomer = !hasMatches && customerPhone.trim().length >= 6;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Phone first - required */}
        <div className="space-y-2">
          <Label htmlFor="customerPhone">Phone Number *</Label>
          <Input
            id="customerPhone"
            type="tel"
            value={customerPhone}
            onChange={(e) => {
              onCustomerPhoneChange(e.target.value);
              onCustomerNameChange('');
            }}
            placeholder="e.g., 0712345678"
            required
            className="h-12 touch-target"
            autoComplete="tel"
          />
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
              {accountsByPhone.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => selectAccount(acc.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors touch-target ${
                    creditAccountId === acc.id
                      ? 'border-[#1c6a1e] bg-[#1c6a1e]/10'
                      : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <div className="font-medium truncate">{acc.customer_name}</div>
                  {acc.customer_phone && (
                    <div className="text-xs text-muted-foreground">{acc.customer_phone}</div>
                  )}
                  <div className="text-sm font-semibold text-[#1c6a1e] mt-0.5">
                    Balance: {formatPrice(acc.total_credit)}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select the customer above. Use a different phone number to add a new customer.
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
              No existing account found. Enter name to create new credit account.
            </p>
          </div>
        )}

        {!loadingByPhone && !hasMatches && !isNewCustomer && customerPhone.trim() && (
          <p className="text-sm text-muted-foreground">
            Enter at least 6 digits to search for existing customers
          </p>
        )}
      </CardContent>
    </Card>
  );
}
