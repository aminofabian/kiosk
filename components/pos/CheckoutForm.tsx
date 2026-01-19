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
  redirectUrl: string;
}

interface PaymentStatusResponse {
  statusCode: number;
  statusDescription: string;
  message: string;
  completed: boolean;
  failed: boolean;
  confirmationCode?: string;
}

interface CheckoutFormProps {
  onBackToCart?: () => void;
  onContinueShopping?: () => void;
}

export function CheckoutForm({ onBackToCart, onContinueShopping }: CheckoutFormProps = {}) {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // M-Pesa STK Push state
  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>('idle');
  const [orderTrackingId, setOrderTrackingId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);
  const [isMpesaInitiating, setIsMpesaInitiating] = useState(false);

  const MAX_POLL_COUNT = 60; // 60 * 3s = 3 minutes timeout
  const POLL_INTERVAL = 3000; // 3 seconds

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
      // Close payment window if still open
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
      completeSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpesaStatus]);

  const initiateMpesaPayment = async () => {
    setIsMpesaInitiating(true);
    setMpesaStatus('sending');
    setError(null);
    setPollCount(0);

    try {
      const result = await apiPost<StkPushResponse>('/api/pesapal/stk-push', {
        amount: total,
        description: `POS Sale - ${items.length} item(s)`,
      });

      if (result.success && result.data) {
        setOrderTrackingId(result.data.orderTrackingId);
        
        // Open Pesapal payment page in a popup window
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          result.data.redirectUrl,
          'PesapalPayment',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );
        
        if (popup) {
          setPaymentWindow(popup);
        }
        
        setMpesaStatus('waiting');
      } else {
        setMpesaStatus('failed');
        setError(result.message || 'Failed to initiate M-Pesa payment');
      }
    } catch (err) {
      console.error('M-Pesa initiation error:', err);
      setMpesaStatus('failed');
      setError('Failed to initiate M-Pesa payment. Please try again.');
    } finally {
      setIsMpesaInitiating(false);
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
        // Redirect to receipt with print parameter for auto-printing
        router.push(`/pos/receipt/${result.data.saleId}?print=true`);
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
        setError('Please ensure order total is valid');
      } else {
        setError('Please ensure order total is valid');
      }
      return;
    }

    // For M-Pesa, complete sale directly (manual confirmation)
    // The automatic flow with Pesapal is handled separately via initiateMpesaPayment()
    if (paymentMethod === 'mpesa') {
      setIsProcessing(true);
      setError(null);
      await completeSale();
      return;
    }

    // For other payment methods, complete sale directly
    setIsProcessing(true);
    setError(null);
    await completeSale();
  };

  const resetMpesaState = () => {
    // Close payment window if open
    if (paymentWindow && !paymentWindow.closed) {
      paymentWindow.close();
    }
    setPaymentWindow(null);
    setMpesaStatus('idle');
    setOrderTrackingId(null);
    setPollCount(0);
    setConfirmationCode(null);
    setError(null);
    setIsMpesaInitiating(false);
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
          <Button 
            onClick={() => {
              if (onContinueShopping) {
                onContinueShopping();
              } else {
                router.push('/pos');
              }
            }} 
            size="touch"
          >
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
                  {mpesaStatus === 'sending' ? 'Opening Payment Page...' : 'Complete Payment'}
                </h2>
                <p className="text-muted-foreground">
                  {mpesaStatus === 'sending' 
                    ? 'Please wait while we prepare the payment page.'
                    : 'A payment window has opened. Please complete the M-Pesa payment there.'
                  }
                </p>
                {mpesaStatus === 'waiting' && (
                  <p className="text-sm text-orange-600 font-medium">
                    Select M-Pesa and enter your phone number in the popup window
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                <span className="text-sm text-muted-foreground">
                  {mpesaStatus === 'waiting' && `Waiting for payment confirmation... (${Math.floor(pollCount * 3 / 60)}:${String((pollCount * 3) % 60).padStart(2, '0')})`}
                </span>
              </div>

              <div className="pt-4">
                <p className="text-2xl font-bold text-[#259783]">{formatPrice(total)}</p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reopen the payment window if it was closed
                    if (paymentWindow && paymentWindow.closed && orderTrackingId) {
                      // Can't reopen same order, need to restart
                      resetMpesaState();
                      initiateMpesaPayment();
                    }
                  }}
                  className="w-full"
                  disabled={!paymentWindow?.closed}
                >
                  Reopen Payment Window
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    resetMpesaState();
                  }}
                  className="w-full text-muted-foreground"
                >
                  Cancel Payment
                </Button>
              </div>
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
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Smartphone className="h-5 w-5 text-orange-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-orange-800">
                          M-Pesa Payment
                        </p>
                        <p className="text-xs text-orange-600">
                          Select how you want to process M-Pesa payment
                        </p>
                        <p className="text-xs font-semibold text-orange-700 mt-2">
                          Amount: {formatPrice(total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await initiateMpesaPayment();
                      }}
                      className="flex flex-col items-center justify-center h-20 gap-2"
                      disabled={isProcessing || isMpesaInitiating}
                    >
                      {isMpesaInitiating ? (
                        <>
                          <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />
                          <span className="text-sm font-medium">Loading...</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-5 w-5 text-orange-600" />
                          <span className="text-sm font-medium">Online Payment</span>
                        </>
                      )}
                    </Button>
                    <Button
                      type="submit"
                      className="flex flex-col items-center justify-center h-20 gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                      disabled={isProcessing || isMpesaInitiating}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-sm font-medium">Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-sm font-medium">Mark as Paid</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Use &quot;Online Payment&quot; for Pesapal STK Push, or &quot;Mark as Paid&quot; if payment was received manually
                  </p>
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
            onClick={() => {
              if (onBackToCart) {
                onBackToCart();
              } else {
                router.push('/pos/cart');
              }
            }}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          {paymentMethod !== 'mpesa' && (
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
          )}
        </div>
      </div>
    </form>
  );
}
