'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, Smartphone, CreditCard, Plus, X, CheckCircle2 } from 'lucide-react';

export interface SplitPayment {
  method: 'cash' | 'mpesa' | 'credit';
  amount: number;
  customerName?: string;
  customerPhone?: string;
}

interface SplitPaymentFormProps {
  total: number;
  onPaymentsChange: (payments: SplitPayment[], isValid: boolean) => void;
}

const paymentMethods = [
  { value: 'cash' as const, label: 'Cash', icon: Wallet, color: 'bg-[#259783]' },
  { value: 'mpesa' as const, label: 'M-Pesa', icon: Smartphone, color: 'bg-orange-500' },
  { value: 'credit' as const, label: 'Credit', icon: CreditCard, color: 'bg-blue-500' },
];

export function SplitPaymentForm({ total, onPaymentsChange }: SplitPaymentFormProps) {
  const [payments, setPayments] = useState<SplitPayment[]>([
    { method: 'cash', amount: 0 },
  ]);
  const [cashReceived, setCashReceived] = useState<string>('');

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const cashPayment = payments.find(p => p.method === 'cash');
  const cashAmount = parseFloat(cashReceived) || 0;
  const cashChange = cashPayment ? cashAmount - cashPayment.amount : 0;

  // Check if all credit payments have customer name
  const creditPayments = payments.filter(p => p.method === 'credit');
  const allCreditHasName = creditPayments.every(p => p.customerName && p.customerName.trim().length > 0);

  // Validation: total must match and credit must have customer info
  const isValid = Math.abs(remaining) < 0.01 && totalPaid > 0 && allCreditHasName && 
    (!cashPayment || cashAmount >= cashPayment.amount);

  useEffect(() => {
    onPaymentsChange(payments, isValid);
  }, [payments, isValid, onPaymentsChange]);

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
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], amount };
    setPayments(newPayments);
  };

  const updateCreditInfo = (index: number, field: 'customerName' | 'customerPhone', value: string) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
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
                        <div className={`text-sm font-medium ${cashChange >= 0 ? 'text-[#259783]' : 'text-destructive'}`}>
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
                        <Label htmlFor={`customer-name-${index}`} className="text-sm">
                          Customer Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`customer-name-${index}`}
                          type="text"
                          value={payment.customerName || ''}
                          onChange={(e) => updateCreditInfo(index, 'customerName', e.target.value)}
                          placeholder="Enter customer name"
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`customer-phone-${index}`} className="text-sm text-muted-foreground">
                          Phone (optional)
                        </Label>
                        <Input
                          id={`customer-phone-${index}`}
                          type="tel"
                          value={payment.customerPhone || ''}
                          onChange={(e) => updateCreditInfo(index, 'customerPhone', e.target.value)}
                          placeholder="07XX XXX XXX"
                          className="h-12"
                        />
                      </div>
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
          <span className={remaining <= 0.01 ? 'text-[#259783]' : 'text-destructive'}>
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
        {!allCreditHasName && creditPayments.length > 0 && (
          <p className="text-sm text-destructive">
            Please enter customer name for credit payment.
          </p>
        )}
      </div>
    </div>
  );
}
