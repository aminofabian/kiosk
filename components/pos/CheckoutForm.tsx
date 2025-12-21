'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { CreditForm } from './CreditForm';
import type { PaymentMethod } from '@/lib/constants';

export function CheckoutForm() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;
  const isValid =
    paymentMethod === 'credit'
      ? total > 0 && customerName.trim().length > 0
      : paymentMethod === 'cash'
        ? cashAmount >= total && total > 0
        : paymentMethod === 'mpesa'
          ? total > 0
          : false;

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }

    if (!isValid) {
      if (paymentMethod === 'credit') {
        setError('Please enter customer name');
      } else if (paymentMethod === 'cash') {
        setError('Please enter a valid cash amount');
      } else {
        setError('Please ensure order total is valid');
      }
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            price: item.price,
          })),
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashAmount : undefined,
          customerName: paymentMethod === 'credit' ? customerName : undefined,
          customerPhone: paymentMethod === 'credit' ? customerPhone || undefined : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        clearCart();
        router.push(`/pos/receipt/${result.data.saleId}`);
      } else {
        setError(result.message || 'Failed to complete sale');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('An error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">Your cart is empty</p>
          <Button onClick={() => router.push('/pos')} size="touch">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex justify-between items-start"
                >
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.quantity} {item.unitType} × {formatPrice(item.price)}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span className="text-2xl text-[#259783]">
                  {formatPrice(total)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PaymentMethodSelector
                selectedMethod={paymentMethod}
                onSelectMethod={setPaymentMethod}
              />

              {paymentMethod === 'cash' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cash">Cash Received (KES)</Label>
                    <Input
                      id="cash"
                      type="number"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      className="text-lg h-14 touch-target"
                      autoFocus
                    />
                  </div>

                  {cashReceived && (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Total:</span>
                        <span className="font-medium">{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cash Received:</span>
                        <span className="font-medium">{formatPrice(cashAmount)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Change:</span>
                        <span
                          className={
                            change >= 0
                              ? 'text-[#259783]'
                              : 'text-destructive'
                          }
                        >
                          {formatPrice(Math.abs(change))}
                        </span>
                      </div>
                      {change < 0 && (
                        <p className="text-sm text-destructive mt-2">
                          Insufficient cash. Please enter more.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {paymentMethod === 'credit' && (
                <CreditForm
                  customerName={customerName}
                  customerPhone={customerPhone}
                  onCustomerNameChange={setCustomerName}
                  onCustomerPhoneChange={setCustomerPhone}
                />
              )}

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t bg-white p-6">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() => router.push('/pos/cart')}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="touch"
            disabled={!isValid || isProcessing}
            className="flex-1 bg-[#259783] hover:bg-[#45d827] text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              'Complete Sale'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

