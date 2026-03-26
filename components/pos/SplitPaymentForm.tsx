'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Smartphone, CreditCard, Plus, X, CheckCircle2, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import type { CreditAccount } from '@/lib/db/types';

export interface SplitPayment {
  method: 'cash' | 'mpesa' | 'credit';
  amount: number;
  customerName?: string;
  customerPhone?: string;
}

const PHONE_DEBOUNCE_MS = 400;

interface SplitPaymentFormProps {
  total: number;
  onPaymentsChange: (payments: SplitPayment[], isValid: boolean) => void;
}

const paymentMethods = [
  { value: 'cash' as const, label: 'Cash', icon: Wallet, color: 'bg-[#1c6a1e]' },
  { value: 'mpesa' as const, label: 'M-Pesa', icon: Smartphone, color: 'bg-orange-500' },
  { value: 'credit' as const, label: 'Credit', icon: CreditCard, color: 'bg-blue-500' },
];

export function SplitPaymentForm({ total, onPaymentsChange }: SplitPaymentFormProps) {
  const [payments, setPayments] = useState<SplitPayment[]>([
    { method: 'cash', amount: 0 },
  ]);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [accountsByPhone, setAccountsByPhone] = useState<CreditAccount[]>([]);
  const [loadingByPhone, setLoadingByPhone] = useState(false);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const cashPayment = payments.find(p => p.method === 'cash');
  const cashAmount = parseFloat(cashReceived) || 0;
  const cashChange = cashPayment ? cashAmount - cashPayment.amount : 0;

  // Check if all credit payments have required phone
  const creditPayments = payments.filter(p => p.method === 'credit');
  const allCreditHasPhone = creditPayments.every(p => p.customerPhone && p.customerPhone.trim().length > 0);

  const addPaymentMethod = (method: 'cash' | 'mpesa' | 'credit') => {
    // Don't add if already exists
    if (payments.some(p => p.method === method)) return;
    
    setPayments([...payments, { method, amount: 0 }]);
  };

  const removePaymentMethod = (index: number) => {
    if (payments.length <= 1) return;
    const newPayments = payments.filter((_, i) => i !== index);
    setPayments(newPayments);
    
    // Reset cash received if cash is removed
    if (payments[index].method === 'cash') {
      setCashReceived('');
    }
  };

  const updatePaymentAmount = (index: number, amount: number) => {
    setPayments((prev) => {
      const newPayments = [...prev];
      newPayments[index] = { ...newPayments[index], amount };
      return newPayments;
    });
  };

  const updateCreditInfo = (index: number, updates: Partial<Pick<SplitPayment, 'customerName' | 'customerPhone'>>) => {
    setPayments((prev) => {
      const newPayments = [...prev];
      newPayments[index] = { ...newPayments[index], ...updates };
      return newPayments;
    });
  };

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
      } else {
        setAccountsByPhone([]);
      }
    } catch {
      setAccountsByPhone([]);
    } finally {
      setLoadingByPhone(false);
    }
  }, []);

  const creditPaymentIndex = payments.findIndex((p) => p.method === 'credit');
  const creditPayment = creditPaymentIndex >= 0 ? payments[creditPaymentIndex] : null;
  const creditPhone = creditPayment?.customerPhone || '';
  const hasMatches = accountsByPhone.length > 0;
  const isNewCustomer = !hasMatches && creditPhone.trim().length >= 6;
  // Validation: total must match and credit must have customer info
  const newCustomerHasName = !isNewCustomer || !!(creditPayment?.customerName && creditPayment.customerName.trim().length > 0);
  const isValid = Math.abs(remaining) < 0.01 && totalPaid > 0 && allCreditHasPhone && newCustomerHasName &&
    (!cashPayment || cashAmount >= cashPayment.amount);

  useEffect(() => {
    onPaymentsChange(payments, isValid);
  }, [payments, isValid, onPaymentsChange]);

  useEffect(() => {
    if (!creditPayment) {
      setAccountsByPhone([]);
      setLoadingByPhone(false);
      return;
    }
    if (!creditPhone.trim()) {
      setAccountsByPhone([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchByPhone(creditPhone);
    }, PHONE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [creditPayment, creditPhone, fetchByPhone]);

  const selectExistingAccount = (account: CreditAccount) => {
    if (creditPaymentIndex < 0) return;
    updateCreditInfo(creditPaymentIndex, {
      customerPhone: account.customer_phone || creditPhone,
      customerName: account.customer_name,
    });
  };

  const setRemainingToPayment = (index: number) => {
    const currentPayment = payments[index];
    const otherPaymentsTotal = payments
      .filter((_, i) => i !== index)
      .reduce((sum, p) => sum + p.amount, 0);
    const newAmount = Math.max(0, total - otherPaymentsTotal);
    updatePaymentAmount(index, newAmount);
  };

  const formatPrice = (price: number) => `KES ${price.toFixed(0)}`;

  const availableMethods = paymentMethods.filter(
    m => !payments.some(p => p.method === m.value)
  );

  return (
    <div className="space-y-4">
      {/* Payment entries */}
      <div className="space-y-3">
        {payments.map((payment, index) => {
          const methodConfig = paymentMethods.find(m => m.value === payment.method)!;
          const Icon = methodConfig.icon;

          return (
            <Card key={index} className="border-2">
              <CardContent className="pt-4 pb-3">
                <div className="space-y-3">
                  {/* Header with method and remove button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${methodConfig.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold">{methodConfig.label}</span>
                    </div>
                    {payments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePaymentMethod(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Amount input */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={payment.amount || ''}
                        onChange={(e) => updatePaymentAmount(index, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="text-lg h-12"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRemainingToPayment(index)}
                      className="h-12 px-3 text-xs"
                    >
                      Fill remaining
                    </Button>
                  </div>

                  {/* Cash received input for cash payments */}
                  {payment.method === 'cash' && payment.amount > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label htmlFor={`cash-received-${index}`} className="text-sm text-muted-foreground">
                        Cash Received
                      </Label>
                      <Input
                        id={`cash-received-${index}`}
                        type="number"
                        step="1"
                        min="0"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="Enter cash received"
                        className="h-12"
                      />
                      {cashReceived && (
                        <div className={`text-sm font-medium ${cashChange >= 0 ? 'text-[#1c6a1e]' : 'text-destructive'}`}>
                          Change: {formatPrice(Math.abs(cashChange))}
                          {cashChange < 0 && ' (insufficient)'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Credit customer info */}
                  {payment.method === 'credit' && (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="space-y-2">
                        <Label htmlFor={`customer-phone-${index}`} className="text-sm">
                          Phone Number <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`customer-phone-${index}`}
                          type="tel"
                          value={payment.customerPhone || ''}
                          onChange={(e) => {
                            updateCreditInfo(index, {
                              customerPhone: e.target.value,
                              customerName: '',
                            });
                          }}
                          placeholder="e.g., 0712345678"
                          className="h-12"
                          autoComplete="tel"
                        />
                      </div>

                      {loadingByPhone && index === creditPaymentIndex && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking for existing customer...
                        </div>
                      )}

                      {!loadingByPhone && index === creditPaymentIndex && hasMatches && (
                        <div className="space-y-2">
                          <Label>Select customer</Label>
                          <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                            {accountsByPhone.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => selectExistingAccount(acc)}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                                  payment.customerName === acc.customer_name
                                    ? 'border-[#1c6a1e] bg-[#1c6a1e]/10'
                                    : 'border-transparent hover:bg-muted'
                                }`}
                              >
                                <div className="font-medium truncate">{acc.customer_name}</div>
                                {acc.customer_phone && (
                                  <div className="text-xs text-muted-foreground">{acc.customer_phone}</div>
                                )}
                                <div className="text-sm font-semibold text-[#1c6a1e] mt-0.5">
                                  Balance: KES {acc.total_credit.toFixed(0)}
                                </div>
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Select the customer above. Use a different phone number to add a new customer.
                          </p>
                        </div>
                      )}

                      {!loadingByPhone && index === creditPaymentIndex && isNewCustomer && (
                        <div className="space-y-2">
                          <Label htmlFor={`customer-name-${index}`} className="text-sm">
                            Customer Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`customer-name-${index}`}
                            type="text"
                            value={payment.customerName || ''}
                            onChange={(e) => updateCreditInfo(index, { customerName: e.target.value })}
                            placeholder="Enter customer name"
                            className="h-12"
                          />
                          <p className="text-xs text-muted-foreground">
                            No existing account found. Enter name to create new credit account.
                          </p>
                        </div>
                      )}

                      {!loadingByPhone && index === creditPaymentIndex && !hasMatches && !isNewCustomer && payment.customerPhone?.trim() && (
                        <p className="text-sm text-muted-foreground">
                          Enter at least 6 digits to search for existing customers
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add payment method buttons */}
      {availableMethods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Button
                key={method.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPaymentMethod(method.value)}
                className="flex items-center gap-2"
              >
                <Plus className="h-3 w-3" />
                <Icon className="h-4 w-4" />
                <span>Add {method.label}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="space-y-2 p-4 bg-muted rounded-lg">
        <div className="flex justify-between text-sm">
          <span>Order Total:</span>
          <span className="font-medium">{formatPrice(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Paid:</span>
          <span className="font-medium">{formatPrice(totalPaid)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-lg font-bold">
          <span>Remaining:</span>
          <span className={remaining <= 0.01 ? 'text-[#1c6a1e]' : 'text-destructive'}>
            {remaining <= 0.01 ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-5 w-5" />
                Fully Paid
              </span>
            ) : (
              formatPrice(remaining)
            )}
          </span>
        </div>
        {remaining > 0.01 && (
          <p className="text-sm text-destructive">
            Please allocate the remaining {formatPrice(remaining)} to complete the payment.
          </p>
        )}
        {!allCreditHasPhone && creditPayments.length > 0 && (
          <p className="text-sm text-destructive">
            Please enter customer phone number for credit payment.
          </p>
        )}
        {isNewCustomer && !(creditPayment?.customerName && creditPayment.customerName.trim()) && (
          <p className="text-sm text-destructive">
            Please enter customer name for new credit customer.
          </p>
        )}
      </div>
    </div>
  );
}
