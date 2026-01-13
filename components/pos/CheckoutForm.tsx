'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { CreditForm } from './CreditForm';
import type { PaymentMethod } from '@/lib/constants';
import { apiPost, apiGet } from '@/lib/utils/api-client';

type MpesaStatus = 'idle' | 'sending' | 'waiting' | 'success' | 'failed' | 'timeout';

interface StkPushResponse {
  orderTrackingId: string;
  merchantReference: string;
}

interface PaymentStatusResponse {
  statusCode: number;
  statusDescription: string;
  message: string;
  completed: boolean;
  failed: boolean;
  confirmationCode?: string;
}

export function CheckoutForm() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [mpesaPhone, setMpesaPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // M-Pesa STK Push state
  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>('idle');
  const [orderTrackingId, setOrderTrackingId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);

  const MAX_POLL_COUNT = 40; // 40 * 3s = 2 minutes timeout
  const POLL_INTERVAL = 3000; // 3 seconds

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;
  
  // Validate phone number format (Kenyan)
  const isValidPhone = (phone: string) => {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    return /^(0|254|7)\d{8,9}$/.test(cleaned);
  };

  const isValid =
    paymentMethod === 'credit'
      ? total > 0 && customerName.trim().length > 0
      : paymentMethod === 'cash'
        ? cashAmount >= total && total > 0
        : paymentMethod === 'mpesa'
          ? total > 0 && isValidPhone(mpesaPhone)
          : false;

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  // Poll for payment status
  const pollPaymentStatus = useCallback(async () => {
    if (!orderTrackingId) return;

    try {
      const result = await apiGet<PaymentStatusResponse>(
        `/api/pesapal/status/${orderTrackingId}`
      );

      if (result.success && result.data) {
        if (result.data.completed) {
          setMpesaStatus('success');
          setConfirmationCode(result.data.confirmationCode || null);
          return true;
        } else if (result.data.failed) {
          setMpesaStatus('failed');
          setError(result.data.message || 'Payment failed');
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error polling payment status:', err);
      return false;
    }
  }, [orderTrackingId]);

  // Polling effect
  useEffect(() => {
    if (mpesaStatus !== 'waiting' || !orderTrackingId) return;

    const timer = setTimeout(async () => {
      const isDone = await pollPaymentStatus();
      
      if (!isDone) {
        if (pollCount >= MAX_POLL_COUNT) {
          setMpesaStatus('timeout');
          setError('Payment timed out. Please try again or check M-Pesa for confirmation.');
        } else {
          setPollCount((c) => c + 1);
        }
      }
    }, POLL_INTERVAL);

    return () => clearTimeout(timer);
  }, [mpesaStatus, orderTrackingId, pollCount, pollPaymentStatus]);

  // Complete sale after M-Pesa success
  useEffect(() => {
    if (mpesaStatus === 'success') {
      completeSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpesaStatus]);

  const initiateMpesaPayment = async () => {
    setMpesaStatus('sending');
    setError(null);
    setPollCount(0);

    try {
      const result = await apiPost<StkPushResponse>('/api/pesapal/stk-push', {
        phone: mpesaPhone,
        amount: total,
        description: `POS Sale - ${items.length} item(s)`,
      });

      if (result.success && result.data) {
        setOrderTrackingId(result.data.orderTrackingId);
        setMpesaStatus('waiting');
      } else {
        setMpesaStatus('failed');
        setError(result.message || 'Failed to send M-Pesa prompt');
      }
    } catch (err) {
      console.error('M-Pesa initiation error:', err);
      setMpesaStatus('failed');
      setError('Failed to send M-Pesa prompt. Please try again.');
    }
  };

  const completeSale = async () => {
    setIsProcessing(true);

    try {
      const result = await apiPost<{ saleId: string }>('/api/sales', {
        items: items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price,
        })),
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashAmount : undefined,
        customerName: paymentMethod === 'credit' ? customerName : undefined,
        customerPhone: paymentMethod === 'credit' ? customerPhone || undefined : undefined,
      });

      if (result.success && result.data) {
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
      } else if (paymentMethod === 'mpesa') {
        setError('Please enter a valid M-Pesa phone number');
      } else {
        setError('Please ensure order total is valid');
      }
      return;
    }

    // For M-Pesa, initiate STK Push first
    if (paymentMethod === 'mpesa') {
      await initiateMpesaPayment();
      return;
    }

    // For other payment methods, complete sale directly
    setIsProcessing(true);
    setError(null);
    await completeSale();
  };

  const resetMpesaState = () => {
    setMpesaStatus('idle');
    setOrderTrackingId(null);
    setPollCount(0);
    setConfirmationCode(null);
    setError(null);
  };

  // Reset M-Pesa state when payment method changes
  useEffect(() => {
    if (paymentMethod !== 'mpesa') {
      resetMpesaState();
    }
  }, [paymentMethod]);

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

  // M-Pesa waiting screen
  if (mpesaStatus === 'waiting' || mpesaStatus === 'sending') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-orange-600" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">
                  {mpesaStatus === 'sending' ? 'Sending M-Pesa Request...' : 'Waiting for Payment'}
                </h2>
                <p className="text-muted-foreground">
                  {mpesaStatus === 'sending' 
                    ? 'Please wait while we send the payment request to your phone.'
                    : `Check your phone (${mpesaPhone}) for the M-Pesa prompt and enter your PIN.`
                  }
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                <span className="text-sm text-muted-foreground">
                  {mpesaStatus === 'waiting' && `Checking payment status... (${pollCount}/${MAX_POLL_COUNT})`}
                </span>
              </div>

              <div className="pt-4">
                <p className="text-2xl font-bold text-[#259783]">{formatPrice(total)}</p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  resetMpesaState();
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // M-Pesa timeout/failed screen
  if (mpesaStatus === 'timeout' || mpesaStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-red-600">
                  {mpesaStatus === 'timeout' ? 'Payment Timed Out' : 'Payment Failed'}
                </h2>
                <p className="text-muted-foreground">
                  {error || 'The payment could not be completed. Please try again.'}
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    resetMpesaState();
                    initiateMpesaPayment();
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={resetMpesaState}
                  className="w-full"
                >
                  Change Payment Method
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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

              {paymentMethod === 'mpesa' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
                    <Input
                      id="mpesa-phone"
                      type="tel"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="07XX XXX XXX"
                      className="text-lg h-14 touch-target"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the phone number to receive the M-Pesa prompt
                    </p>
                  </div>

                  {mpesaPhone && isValidPhone(mpesaPhone) && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Smartphone className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-orange-800">
                            Ready to send M-Pesa prompt
                          </p>
                          <p className="text-xs text-orange-600">
                            An STK push will be sent to {mpesaPhone} for {formatPrice(total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
            className={`flex-1 text-white ${
              paymentMethod === 'mpesa' 
                ? 'bg-orange-600 hover:bg-orange-700' 
                : 'bg-[#259783] hover:bg-[#45d827]'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : paymentMethod === 'mpesa' ? (
              <>
                <Smartphone className="mr-2 h-5 w-5" />
                Send M-Pesa Prompt
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
