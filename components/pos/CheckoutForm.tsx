'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore, useCartItems, useCartTotal } from '@/lib/stores/cart-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { CreditForm } from './CreditForm';
import { SplitPaymentForm, type SplitPayment } from './SplitPaymentForm';
import type { PaymentMethod } from '@/lib/constants';
import { apiPost, apiGet } from '@/lib/utils/api-client';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { getCurrentShift } from '@/lib/offline/cache';
import { addPendingSale } from '@/lib/offline/queue';

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
  onSaleComplete?: (saleId: string) => void;
}

export function CheckoutForm({ onBackToCart, onContinueShopping, onSaleComplete }: CheckoutFormProps = {}) {
  const router = useRouter();
  const { clearCart } = useCartStore();
  const items = useCartItems();
  const total = useCartTotal();
  const isOnline = useOnlineStatus();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [creditAccountId, setCreditAccountId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);

  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [isSplitValid, setIsSplitValid] = useState(false);

  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>('idle');
  const [orderTrackingId, setOrderTrackingId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);
  const [isMpesaInitiating, setIsMpesaInitiating] = useState(false);

  const MAX_POLL_COUNT = 60;
  const POLL_INTERVAL = 3000;

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;

  const isValid =
    paymentMethod === 'credit'
      ? total > 0 &&
        customerPhone.trim().length > 0 &&
        (customerName.trim().length > 0 || creditAccountId != null)
      : paymentMethod === 'cash'
        ? cashAmount >= total && total > 0
        : paymentMethod === 'mpesa'
          ? total > 0
          : paymentMethod === 'split'
            ? isSplitValid
            : false;

  const suggestedAmounts = useMemo(() => {
    const suggestions = new Set<number>();
    suggestions.add(total);
    const r50 = Math.ceil(total / 50) * 50;
    if (r50 > total) suggestions.add(r50);
    const r100 = Math.ceil(total / 100) * 100;
    if (r100 > total) suggestions.add(r100);
    const r500 = Math.ceil(total / 500) * 500;
    if (r500 > total && total > 100) suggestions.add(r500);
    const r1000 = Math.ceil(total / 1000) * 1000;
    if (r1000 > total && total > 200) suggestions.add(r1000);
    return Array.from(suggestions).sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  const handleSplitPaymentsChange = useCallback((payments: SplitPayment[], isValid: boolean) => {
    setSplitPayments(payments);
    setIsSplitValid(isValid);
  }, []);

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

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

  useEffect(() => {
    if (mpesaStatus === 'success') {
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
      if (!isOnline) {
        if (paymentMethod !== 'cash' && paymentMethod !== 'mpesa') {
          setError('Only Cash and M-Pesa (Mark as Paid) work offline.');
          setIsProcessing(false);
          return;
        }
        let shiftId: string | null = null;
        if (paymentMethod === 'cash') {
          const cachedShift = await getCurrentShift();
          if (!cachedShift?.id) {
            setError('Open a shift when online first to record cash sales offline.');
            setIsProcessing(false);
            return;
          }
          shiftId = cachedShift.id;
        }
        const localId = await addPendingSale({
          items: items.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            unitType: item.unitType,
            inventoryBatchId: item.inventoryBatchId || undefined,
          })),
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashAmount : undefined,
          shiftId,
          totalAmount: total,
        });
        clearCart();
        if (onSaleComplete) {
          onSaleComplete(localId);
        } else {
          router.push(`/pos/receipt/${localId}?print=true&offline=1`);
        }
        setIsProcessing(false);
        return;
      }

      const requestBody: Record<string, unknown> = {
        items: items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price,
          inventoryBatchId: item.inventoryBatchId || undefined,
        })),
        paymentMethod,
      };

      if (paymentMethod === 'cash') {
        requestBody.cashReceived = cashAmount;
      } else if (paymentMethod === 'credit') {
        if (creditAccountId) {
          requestBody.creditAccountId = creditAccountId;
        } else {
          requestBody.customerName = customerName;
          requestBody.customerPhone = customerPhone || undefined;
        }
      } else if (paymentMethod === 'split') {
        requestBody.splitPayments = splitPayments.map(p => ({
          method: p.method,
          amount: p.amount,
          customerName: p.customerName || undefined,
          customerPhone: p.customerPhone || undefined,
        }));
      }

      const result = await apiPost<{ saleId: string }>('/api/sales', requestBody);
      if (result.success && result.data) {
        clearCart();
        if (onSaleComplete) {
          onSaleComplete(result.data.saleId);
        } else {
          router.push(`/pos/receipt/${result.data.saleId}?print=true`);
        }
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
    if (!isOnline && paymentMethod !== 'cash' && paymentMethod !== 'mpesa') {
      setError('Only Cash and M-Pesa (Mark as Paid) work offline. Credit and Split require connection.');
      return;
    }
    if (!isValid) {
      if (paymentMethod === 'credit') {
        setError(
          !customerPhone.trim()
            ? 'Enter phone number first'
            : 'Select an existing customer or enter name for new customer'
        );
      } else if (paymentMethod === 'cash') {
        setError('Please enter a valid cash amount');
      } else if (paymentMethod === 'mpesa') {
        setError('Please ensure order total is valid');
      } else {
        setError('Please ensure order total is valid');
      }
      return;
    }
    if (paymentMethod === 'mpesa') {
      setIsProcessing(true);
      setError(null);
      await completeSale();
      return;
    }
    setIsProcessing(true);
    setError(null);
    await completeSale();
  };

  const resetMpesaState = () => {
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

  useEffect(() => {
    if (paymentMethod !== 'mpesa') {
      resetMpesaState();
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'credit') {
      setCreditAccountId(null);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (!isOnline && paymentMethod && paymentMethod !== 'cash' && paymentMethod !== 'mpesa') {
      setPaymentMethod(null);
      setError('Only Cash and M-Pesa (Mark as Paid) work offline.');
    }
  }, [isOnline, paymentMethod]);

  // --- Empty cart ---
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        </div>
        <p className="text-slate-500 dark:text-slate-400 mb-4">Your cart is empty</p>
        <Button
          onClick={() => onContinueShopping ? onContinueShopping() : router.push('/pos')}
          variant="outline"
          className="rounded-xl px-6"
        >
          Continue Shopping
        </Button>
      </div>
    );
  }

  // --- M-Pesa waiting ---
  if (mpesaStatus === 'waiting' || mpesaStatus === 'sending') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
            <Smartphone className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {mpesaStatus === 'sending' ? 'Opening Payment...' : 'Complete Payment'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mpesaStatus === 'sending'
                ? 'Preparing payment page...'
                : 'Complete the M-Pesa payment in the popup window.'}
            </p>
            {mpesaStatus === 'waiting' && (
              <p className="text-xs text-orange-600 font-medium mt-2">
                Select M-Pesa and enter your phone number in the popup
              </p>
            )}
          </div>
          <div className="text-2xl font-bold text-[#1c6a1e]">{formatPrice(total)}</div>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
            {mpesaStatus === 'waiting' && (
              <span>Waiting... {Math.floor(pollCount * 3 / 60)}:{String((pollCount * 3) % 60).padStart(2, '0')}</span>
            )}
          </div>
          <div className="space-y-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (paymentWindow && paymentWindow.closed && orderTrackingId) {
                  resetMpesaState();
                  initiateMpesaPayment();
                }
              }}
              className="w-full rounded-xl"
              disabled={!paymentWindow?.closed}
            >
              Reopen Payment Window
            </Button>
            <button
              type="button"
              onClick={resetMpesaState}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- M-Pesa failed/timeout ---
  if (mpesaStatus === 'timeout' || mpesaStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
            <XCircle className="h-7 w-7 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-600 mb-1">
              {mpesaStatus === 'timeout' ? 'Payment Timed Out' : 'Payment Failed'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {error || 'Payment could not be completed.'}
            </p>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => { resetMpesaState(); initiateMpesaPayment(); }}
              className="w-full rounded-xl bg-orange-600 hover:bg-orange-700"
            >
              Try Again
            </Button>
            <Button variant="outline" onClick={resetMpesaState} className="w-full rounded-xl">
              Change Payment Method
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main checkout ---
  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Compact Order Summary */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowItems(!showItems)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[#1c6a1e]/10 flex items-center justify-center">
                <span className="text-xs font-bold text-[#1c6a1e]">{items.length}</span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-white">{formatPrice(total)}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showItems ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {showItems && (
            <div className="px-4 pb-3 space-y-2 border-t border-slate-50 dark:border-slate-800/50 pt-2">
              {items.map((item) => (
                <div
                  key={item.inventoryBatchId ? `${item.itemId}:${item.inventoryBatchId}` : item.itemId}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate uppercase">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.quantity} {item.unitType} × {formatPrice(item.price)}
                      {item.batchNumber && <span className="ml-1 font-mono">Lot: {item.batchNumber}</span>}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Section */}
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
              Payment Method
            </p>
            <PaymentMethodSelector
              selectedMethod={paymentMethod}
              onSelectMethod={setPaymentMethod}
              disabledWhenOffline={!isOnline}
            />
          </div>

          {/* Cash */}
          {paymentMethod === 'cash' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 space-y-3 ring-1 ring-slate-200 dark:ring-slate-800">
              <Label htmlFor="cash" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Cash Received
              </Label>
              <Input
                id="cash"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0"
                className="text-2xl h-14 text-center font-bold border-slate-200 dark:border-slate-700 rounded-xl"
                autoFocus
              />

              {/* Quick amount buttons */}
              <div className="flex gap-1.5">
                {suggestedAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCashReceived(amount.toString())}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      cashAmount === amount
                        ? 'bg-[#1c6a1e] text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Change display */}
              {cashReceived && (
                <div
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                    change >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800'
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      change >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {change >= 0 ? 'Change' : 'Short by'}
                  </span>
                  <span
                    className={`text-xl font-bold ${
                      change >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatPrice(Math.abs(change))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* M-Pesa info */}
          {paymentMethod === 'mpesa' && (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-4 ring-1 ring-orange-200 dark:ring-orange-900">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">M-Pesa Payment</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    {isOnline ? 'Use buttons below to process' : 'Offline: Mark as Paid to record sale'}
                  </p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-300 mt-2">{formatPrice(total)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Credit */}
          {paymentMethod === 'credit' && (
            <CreditForm
              customerName={customerName}
              customerPhone={customerPhone}
              onCustomerNameChange={setCustomerName}
              onCustomerPhoneChange={setCustomerPhone}
              creditAccountId={creditAccountId}
              onCreditAccountIdChange={setCreditAccountId}
            />
          )}

          {/* Split */}
          {paymentMethod === 'split' && (
            <SplitPaymentForm
              total={total}
              onPaymentsChange={handleSplitPaymentsChange}
            />
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800">
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
        {paymentMethod === 'mpesa' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => initiateMpesaPayment()}
                className="h-12 rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-medium"
                disabled={isProcessing || isMpesaInitiating || !isOnline}
                title={!isOnline ? 'Requires connection' : undefined}
              >
                {isMpesaInitiating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Smartphone className="h-4 w-4 mr-1.5" />
                    Online Pay
                  </>
                )}
              </Button>
              <Button
                type="submit"
                className="h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-medium"
                disabled={isProcessing || isMpesaInitiating}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Mark Paid
                  </>
                )}
              </Button>
            </div>
            <p className="text-[10px] text-center text-slate-400">
              {isOnline ? '"Online Pay" for STK Push \u2022 "Mark Paid" for manual' : 'Offline: Mark Paid only'}
            </p>
          </>
        )}

        {paymentMethod !== 'mpesa' && (
          <Button
            type="submit"
            disabled={!isValid || isProcessing}
            className="w-full h-14 rounded-xl text-base font-bold bg-[#1c6a1e] hover:bg-[#155a17] text-white shadow-lg shadow-[#1c6a1e]/20 disabled:shadow-none disabled:opacity-50 transition-all"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-between w-full px-1">
                <span>{paymentMethod === 'split' ? 'Complete Split Payment' : 'Complete Sale'}</span>
                <span className="bg-white/20 px-3 py-1 rounded-lg text-sm font-semibold">{formatPrice(total)}</span>
              </span>
            )}
          </Button>
        )}

        <button
          type="button"
          onClick={() => onBackToCart ? onBackToCart() : router.push('/pos/cart')}
          className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          disabled={isProcessing}
        >
          &larr; Back to cart
        </button>
      </div>
    </form>
  );
}
