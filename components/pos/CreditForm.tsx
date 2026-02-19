'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus, User } from 'lucide-react';
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

type CreditMode = 'new' | 'existing';

export function CreditForm({
  customerName,
  customerPhone,
  onCustomerNameChange,
  onCustomerPhoneChange,
  creditAccountId,
  onCreditAccountIdChange,
}: CreditFormProps) {
  const [mode, setMode] = useState<CreditMode>(creditAccountId ? 'existing' : 'new');
  const [accounts, setAccounts] = useState<CreditAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (mode === 'existing') {
      setLoadingAccounts(true);
      apiGet<CreditAccount[]>('/api/credits')
        .then((res) => {
          if (res.success && res.data) setAccounts(res.data);
        })
        .finally(() => setLoadingAccounts(false));
    }
  }, [mode]);

  const switchToNew = () => {
    setMode('new');
    onCreditAccountIdChange(null);
    if (!customerName && !customerPhone) return;
    onCustomerNameChange('');
    onCustomerPhoneChange('');
  };

  const switchToExisting = () => {
    setMode('existing');
    onCustomerNameChange('');
    onCustomerPhoneChange('');
  };

  const selectAccount = (id: string) => {
    onCreditAccountIdChange(id);
  };

  const formatPrice = (n: number) =>
    `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* New vs Existing toggle */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <Button
            type="button"
            variant={mode === 'new' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 gap-2"
            onClick={switchToNew}
          >
            <UserPlus className="h-4 w-4" />
            New customer
          </Button>
          <Button
            type="button"
            variant={mode === 'existing' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 gap-2"
            onClick={switchToExisting}
          >
            <User className="h-4 w-4" />
            Existing creditor
          </Button>
        </div>

        {mode === 'new' && (
          <>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Customer Phone (Optional)</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={customerPhone}
                onChange={(e) => onCustomerPhoneChange(e.target.value)}
                placeholder="e.g., 0712345678"
                className="h-12 touch-target"
              />
              <p className="text-xs text-muted-foreground">
                Phone number helps identify existing customers
              </p>
            </div>
          </>
        )}

        {mode === 'existing' && (
          <div className="space-y-2">
            <Label>Select creditor to add items to</Label>
            {loadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No credit accounts yet. Use &quot;New customer&quot; to create one.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {accounts.map((acc) => (
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
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
