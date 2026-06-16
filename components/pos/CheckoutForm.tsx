"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useCartStore,
  useCartItems,
  useCartTotal,
} from "@/lib/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Smartphone,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Wallet,
  Receipt,
} from "lucide-react";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { CreditForm } from "./CreditForm";
import { SplitPaymentForm, type SplitPayment } from "./SplitPaymentForm";
import { WalletApplySection } from "./WalletApplySection";
import { ManagerPinDialog } from "./ManagerPinDialog";
import type { PaymentMethod } from "@/lib/constants";
import type { CreditAccount } from "@/lib/db/types";
import { apiPost, apiGet } from "@/lib/utils/api-client";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { getCurrentShift } from "@/lib/offline/cache";
import { addPendingSale } from "@/lib/offline/queue";

type MpesaStatus =
  | "idle"
  | "sending"
  | "waiting"
  | "success"
  | "failed"
  | "timeout";

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
  onSaleComplete?: (saleId: string, pendingSaleId?: string) => void;
}

export function CheckoutForm({
  onBackToCart,
  onContinueShopping,
  onSaleComplete,
}: CheckoutFormProps = {}) {
  const router = useRouter();
  const { clearCart, syncPendingSale, getActiveCartPendingSaleId } = useCartStore();
  const activeCartId = useCartStore((s) => s.activeCartId || s.carts[0]?.id);
  const items = useCartItems();
  const total = useCartTotal();
  const isOnline = useOnlineStatus();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [cashReceived, setCashReceived] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [creditAccountId, setCreditAccountId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);

  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [isSplitValid, setIsSplitValid] = useState(false);

  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>("idle");
  const [orderTrackingId, setOrderTrackingId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);
  const [isMpesaInitiating, setIsMpesaInitiating] = useState(false);
  const [allowNewCreditAccounts, setAllowNewCreditAccounts] =
    useState<boolean>(true);
  const [canGiveCredit, setCanGiveCredit] = useState<boolean | null>(null);
  const [managerPin, setManagerPin] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pendingSaleAfterPin, setPendingSaleAfterPin] = useState(false);

  const [walletCreditAccountId, setWalletCreditAccountId] = useState<
    string | null
  >(null);
  const [walletAmountApplied, setWalletAmountApplied] = useState(0);
  const [creditWalletBalance, setCreditWalletBalance] = useState<number | null>(
    null,
  );
  const [creditWalletAmountInput, setCreditWalletAmountInput] = useState("");
  /** Wallet balance for the customer selected for credit or for cash/M-Pesa/split wallet — shown under Credit / wallet */
  const [checkoutWalletBalance, setCheckoutWalletBalance] = useState<
    number | null
  >(null);
  const [checkoutWalletBalanceLoading, setCheckoutWalletBalanceLoading] =
    useState(false);

  const MAX_POLL_COUNT = 60;
  const POLL_INTERVAL = 3000;

  useEffect(() => {
    let cancelled = false;
    async function loadUserFlags() {
      try {
        const result = await apiGet<{
          canGiveCredit: boolean;
        }>("/api/users/me");
        if (!cancelled && result.success && result.data) {
          setCanGiveCredit(result.data.canGiveCredit);
        }
      } catch {
        if (!cancelled) setCanGiveCredit(false);
      }
    }
    void loadUserFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  const EPS = 0.01;
  const amountDue = Math.max(
    0,
    Math.round((total - walletAmountApplied) * 100) / 100,
  );
  const walletCoversFull = total > EPS && walletAmountApplied + EPS >= total;

  const cashAmount = parseFloat(cashReceived) || 0;
  const cashExcessToWallet =
    paymentMethod === "cash" &&
    walletCreditAccountId &&
    cashAmount > amountDue + EPS
      ? Math.round((cashAmount - amountDue) * 100) / 100
      : 0;
  const change = Math.max(0, cashAmount - amountDue - cashExcessToWallet);

  const walletPreviewAccountId =
    paymentMethod === "credit" ? creditAccountId : walletCreditAccountId;

  const walletBalanceAfterSale = useMemo(() => {
    if (
      !walletPreviewAccountId ||
      checkoutWalletBalance === null ||
      checkoutWalletBalanceLoading ||
      !isOnline
    ) {
      return null;
    }
    const delta =
      checkoutWalletBalance -
      walletAmountApplied +
      (paymentMethod === "cash" ? cashExcessToWallet : 0);
    return Math.max(0, Math.round(delta * 100) / 100);
  }, [
    walletPreviewAccountId,
    checkoutWalletBalance,
    checkoutWalletBalanceLoading,
    isOnline,
    walletAmountApplied,
    paymentMethod,
    cashExcessToWallet,
  ]);

  const amountDuePrimaryLabel = useMemo(() => {
    if (!paymentMethod) return "Amount due";
    switch (paymentMethod) {
      case "credit":
        return amountDue < EPS ? "On tab after sale" : "New debt on tab";
      case "cash":
        return "Cash to collect";
      case "mpesa":
        return "M-Pesa amount due";
      case "split":
        return "Split payments total";
      default:
        return "Amount due";
    }
  }, [paymentMethod, amountDue]);

  const phoneDigits = customerPhone.replace(/\D/g, "");
  const hasValidPhone = phoneDigits.length >= 12; // +254 followed by 9 digits = 12+ digits

  const isValid =
    paymentMethod === "credit"
      ? total > EPS &&
        hasValidPhone &&
        (customerName.trim().length > 0 || creditAccountId != null) &&
        (amountDue > EPS || (creditAccountId != null && walletCoversFull))
      : paymentMethod === "cash"
        ? total > EPS && cashAmount + EPS >= amountDue
        : paymentMethod === "mpesa"
          ? total > EPS && (amountDue > EPS || walletCoversFull)
          : paymentMethod === "split"
            ? isSplitValid
            : false;

  const suggestedAmounts = useMemo(() => {
    const base = amountDue > EPS ? amountDue : total;
    const suggestions = new Set<number>();
    if (base > EPS) {
      suggestions.add(base);
      const r50 = Math.ceil(base / 50) * 50;
      if (r50 > base) suggestions.add(r50);
      const r100 = Math.ceil(base / 100) * 100;
      if (r100 > base) suggestions.add(r100);
      const r500 = Math.ceil(base / 500) * 500;
      if (r500 > base && base > 100) suggestions.add(r500);
      const r1000 = Math.ceil(base / 1000) * 1000;
      if (r1000 > base && base > 200) suggestions.add(r1000);
    }
    return Array.from(suggestions)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }, [total, amountDue]);

  const handleSplitPaymentsChange = useCallback(
    (payments: SplitPayment[], isValid: boolean) => {
      setSplitPayments(payments);
      setIsSplitValid(isValid);
    },
    [],
  );

  const prevPaymentMethod = useRef<PaymentMethod | null>(null);
  const prevCreditWalletDefaultAccountRef = useRef<string>("");
  useEffect(() => {
    const prev = prevPaymentMethod.current;
    prevPaymentMethod.current = paymentMethod;

    if (paymentMethod === "credit") {
      setWalletCreditAccountId(null);
    }

    if (!paymentMethod) return;
    const leftCredit = prev === "credit" && paymentMethod !== "credit";
    const enteredCredit =
      prev != null && prev !== "credit" && paymentMethod === "credit";
    if (leftCredit || enteredCredit) {
      setWalletAmountApplied(0);
      setCreditWalletAmountInput("");
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (!isOnline) {
      setWalletCreditAccountId(null);
      setWalletAmountApplied(0);
      setCreditWalletAmountInput("");
    }
  }, [isOnline]);

  // Fetch credit settings to know if new accounts are allowed
  useEffect(() => {
    apiGet<{ creditSettings: { allow_new_credit_accounts?: boolean } }>(
      "/api/credits/settings",
    )
      .then((result) => {
        if (result.success && result.data?.creditSettings) {
          setAllowNewCreditAccounts(
            result.data.creditSettings.allow_new_credit_accounts !== false,
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setCheckoutWalletBalance(null);
      setCheckoutWalletBalanceLoading(false);
      setCreditWalletBalance(null);
      return;
    }

    const accountIdForWallet =
      paymentMethod === "credit"
        ? creditAccountId
        : paymentMethod === "cash" ||
            paymentMethod === "mpesa" ||
            paymentMethod === "split"
          ? walletCreditAccountId
          : null;

    if (!paymentMethod || !accountIdForWallet) {
      setCheckoutWalletBalance(null);
      setCheckoutWalletBalanceLoading(false);
      if (paymentMethod !== "credit" || !creditAccountId) {
        setCreditWalletBalance(null);
      }
      return;
    }

    let cancelled = false;
    const pm = paymentMethod;
    setCheckoutWalletBalance(null);
    setCheckoutWalletBalanceLoading(true);
    if (pm === "credit") {
      setCreditWalletBalance(null);
    }

    (async () => {
      const res = await apiGet<{
        account: CreditAccount | null;
        transactions: unknown[];
      }>(`/api/credits/${accountIdForWallet}`);
      if (cancelled) return;
      setCheckoutWalletBalanceLoading(false);
      const wb =
        res.success && res.data?.account != null
          ? Number(res.data.account.wallet_balance ?? 0)
          : null;
      setCheckoutWalletBalance(wb);
      if (pm === "credit") {
        setCreditWalletBalance(wb ?? 0);
      } else {
        setCreditWalletBalance(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, paymentMethod, creditAccountId, walletCreditAccountId]);

  /** Credit sale: default wallet deduction to max (min(balance, cart)) when customer is chosen or balance loads */
  useEffect(() => {
    if (paymentMethod !== "credit") {
      prevCreditWalletDefaultAccountRef.current = "";
      return;
    }
    if (!creditAccountId) {
      prevCreditWalletDefaultAccountRef.current = "";
      return;
    }
    if (creditWalletBalance === null || total < EPS) return;

    const max = Math.round(Math.min(creditWalletBalance, total) * 100) / 100;
    if (prevCreditWalletDefaultAccountRef.current !== creditAccountId) {
      prevCreditWalletDefaultAccountRef.current = creditAccountId;
      if (max < EPS) {
        setWalletAmountApplied(0);
        setCreditWalletAmountInput("");
      } else {
        setWalletAmountApplied(max);
        setCreditWalletAmountInput(String(max));
      }
    }
  }, [paymentMethod, creditAccountId, creditWalletBalance, total]);

  /** Credit sale: cannot apply more than min(balance, cart) */
  useEffect(() => {
    if (
      paymentMethod !== "credit" ||
      !creditAccountId ||
      creditWalletBalance === null
    )
      return;
    const max = Math.round(Math.min(creditWalletBalance, total) * 100) / 100;
    setWalletAmountApplied((w) => (w > max + EPS ? max : w));
  }, [paymentMethod, creditAccountId, creditWalletBalance, total]);

  useEffect(() => {
    if (paymentMethod !== "credit") return;
    if (walletAmountApplied <= 0) {
      setCreditWalletAmountInput("");
    } else {
      setCreditWalletAmountInput(String(walletAmountApplied));
    }
  }, [paymentMethod, walletAmountApplied]);

  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const pollPaymentStatus = useCallback(async () => {
    if (!orderTrackingId) return;
    try {
      const result = await apiGet<PaymentStatusResponse>(
        `/api/pesapal/status/${orderTrackingId}`,
      );
      if (result.success && result.data) {
        if (result.data.completed) {
          setMpesaStatus("success");
          setConfirmationCode(result.data.confirmationCode || null);
          return true;
        } else if (result.data.failed) {
          setMpesaStatus("failed");
          setError(result.data.message || "Payment failed");
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Error polling payment status:", err);
      return false;
    }
  }, [orderTrackingId]);

  useEffect(() => {
    if (mpesaStatus !== "waiting" || !orderTrackingId) return;
    const timer = setTimeout(async () => {
      const isDone = await pollPaymentStatus();
      if (!isDone) {
        if (pollCount >= MAX_POLL_COUNT) {
          setMpesaStatus("timeout");
          setError(
            "Payment timed out. Please try again or check M-Pesa for confirmation.",
          );
        } else {
          setPollCount((c) => c + 1);
        }
      }
    }, POLL_INTERVAL);
    return () => clearTimeout(timer);
  }, [mpesaStatus, orderTrackingId, pollCount, pollPaymentStatus]);

  useEffect(() => {
    if (mpesaStatus === "success") {
      if (paymentWindow && !paymentWindow.closed) {
        paymentWindow.close();
      }
      completeSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpesaStatus]);

  const initiateMpesaPayment = async () => {
    if (amountDue < EPS) {
      setError(
        "Nothing to collect by M-Pesa — wallet covers this sale. Use Mark Paid.",
      );
      return;
    }
    setIsMpesaInitiating(true);
    setMpesaStatus("sending");
    setError(null);
    setPollCount(0);
    try {
      const result = await apiPost<StkPushResponse>("/api/pesapal/stk-push", {
        amount: amountDue,
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
          "PesapalPayment",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
        );
        if (popup) {
          setPaymentWindow(popup);
        }
        setMpesaStatus("waiting");
      } else {
        setMpesaStatus("failed");
        setError(result.message || "Failed to initiate M-Pesa payment");
      }
    } catch (err) {
      console.error("M-Pesa initiation error:", err);
      setMpesaStatus("failed");
      setError("Failed to initiate M-Pesa payment. Please try again.");
    } finally {
      setIsMpesaInitiating(false);
    }
  };

  const completeSale = async (overridePin?: string) => {
    const effectivePin = overridePin ?? managerPin;
    setIsProcessing(true);
    try {
      if (!isOnline) {
        if (paymentMethod !== "cash" && paymentMethod !== "mpesa") {
          setError("Only Cash and M-Pesa (Mark as Paid) work offline.");
          setIsProcessing(false);
          return;
        }
        if (walletAmountApplied > EPS || walletCreditAccountId) {
          setError(
            "Store wallet needs a connection. Go online to use wallet or cash overpayment to wallet.",
          );
          setIsProcessing(false);
          return;
        }
        let shiftId: string | null = null;
        if (paymentMethod === "cash") {
          const cachedShift = await getCurrentShift();
          if (!cachedShift?.id) {
            setError(
              "Open a shift when online first to record cash sales offline.",
            );
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
          cashReceived: paymentMethod === "cash" ? cashAmount : undefined,
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

      const linkedPendingSaleId = getActiveCartPendingSaleId();
      if (activeCartId) {
        await syncPendingSale(activeCartId);
        const cart = useCartStore.getState().carts.find((c) => c.id === activeCartId);
        const stillLinked = cart?.pendingSaleId ?? linkedPendingSaleId;
        if (cart?.syncStatus === "error" && !stillLinked) {
          setError("Could not save cart to server. Check your connection and try again.");
          setIsProcessing(false);
          return;
        }
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

      if (paymentMethod === "cash") {
        requestBody.cashReceived = cashAmount;
      } else if (paymentMethod === "credit") {
        if (creditAccountId) {
          requestBody.creditAccountId = creditAccountId;
        } else {
          requestBody.customerName = customerName;
          requestBody.customerPhone = customerPhone || undefined;
        }
      } else if (paymentMethod === "split") {
        requestBody.splitPayments = splitPayments.map((p) => ({
          method: p.method,
          amount: p.amount,
          customerName: p.customerName || undefined,
          customerPhone: p.customerPhone || undefined,
        }));
      }

      if (walletCreditAccountId) {
        requestBody.walletCreditAccountId = walletCreditAccountId;
      }
      if (walletAmountApplied > EPS) {
        requestBody.walletAmountApplied = walletAmountApplied;
      }
      if (effectivePin) {
        requestBody.managerPin = effectivePin;
      }
      const resolvedPendingSaleId =
        useCartStore.getState().getActiveCartPendingSaleId() ??
        linkedPendingSaleId;
      if (resolvedPendingSaleId) {
        requestBody.pendingSaleId = resolvedPendingSaleId;
      }
      if (paymentMethod === "mpesa" && mpesaStatus !== "success") {
        requestBody.mpesaManualOverride = true;
      }

      const result = await apiPost<{ saleId: string }>(
        "/api/sales",
        requestBody,
      );
      if (result.success && result.data) {
        clearCart({ skipAbandon: true });
        if (onSaleComplete) {
          onSaleComplete(result.data.saleId, resolvedPendingSaleId ?? undefined);
        } else {
          router.push(`/pos/receipt/${result.data.saleId}?print=true`);
        }
      } else {
        const msg = result.message || "Failed to complete sale";
        setError(msg);
        if (/manager approval|manager pin/i.test(msg)) {
          setPendingSaleAfterPin(true);
          setPinDialogOpen(true);
        }
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("An error occurred. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod) {
      setError("Please select a payment method");
      return;
    }
    if (!isOnline && paymentMethod !== "cash" && paymentMethod !== "mpesa") {
      setError(
        "Only Cash and M-Pesa (Mark as Paid) work offline. Credit and Split require connection.",
      );
      return;
    }
    if (!isValid) {
      if (paymentMethod === "credit") {
        setError(
          !customerPhone.trim()
            ? "Enter phone number first"
            : "Select an existing customer or enter name for new customer",
        );
      } else if (paymentMethod === "cash") {
        setError("Please enter a valid cash amount");
      } else if (paymentMethod === "mpesa") {
        setError("Please ensure order total is valid");
      } else {
        setError("Please ensure order total is valid");
      }
      return;
    }
    if (paymentMethod === "mpesa") {
      if (mpesaStatus !== "success" && !managerPin) {
        setPendingSaleAfterPin(true);
        setPinDialogOpen(true);
        return;
      }
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
    setMpesaStatus("idle");
    setOrderTrackingId(null);
    setPollCount(0);
    setConfirmationCode(null);
    setError(null);
    setIsMpesaInitiating(false);
  };

  useEffect(() => {
    if (paymentMethod !== "mpesa") {
      resetMpesaState();
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== "credit") {
      setCreditAccountId(null);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (
      !isOnline &&
      paymentMethod &&
      paymentMethod !== "cash" &&
      paymentMethod !== "mpesa"
    ) {
      setPaymentMethod(null);
      setError("Only Cash and M-Pesa (Mark as Paid) work offline.");
    }
  }, [isOnline, paymentMethod]);

  // --- Empty cart ---
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg
            className="w-7 h-7 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
            />
          </svg>
        </div>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Your cart is empty
        </p>
        <Button
          onClick={() =>
            onContinueShopping ? onContinueShopping() : router.push("/pos")
          }
          variant="outline"
          className="rounded-xl px-6"
        >
          Continue Shopping
        </Button>
      </div>
    );
  }

  // --- M-Pesa waiting ---
  if (mpesaStatus === "waiting" || mpesaStatus === "sending") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
            <Smartphone className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {mpesaStatus === "sending"
                ? "Opening Payment..."
                : "Complete Payment"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mpesaStatus === "sending"
                ? "Preparing payment page..."
                : "Complete the M-Pesa payment in the popup window."}
            </p>
            {mpesaStatus === "waiting" && (
              <p className="text-xs text-orange-600 font-medium mt-2">
                Select M-Pesa and enter your phone number in the popup
              </p>
            )}
          </div>
          <div className="text-2xl font-bold text-[#1c6a1e]">
            {formatPrice(amountDue)}
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
            {mpesaStatus === "waiting" && (
              <span>
                Waiting... {Math.floor((pollCount * 3) / 60)}:
                {String((pollCount * 3) % 60).padStart(2, "0")}
              </span>
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
  if (mpesaStatus === "timeout" || mpesaStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
            <XCircle className="h-7 w-7 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-600 mb-1">
              {mpesaStatus === "timeout"
                ? "Payment Timed Out"
                : "Payment Failed"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {error || "Payment could not be completed."}
            </p>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => {
                resetMpesaState();
                initiateMpesaPayment();
              }}
              className="w-full rounded-xl bg-orange-600 hover:bg-orange-700"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={resetMpesaState}
              className="w-full rounded-xl"
            >
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
        {/* New credit accounts disabled warning */}
        {paymentMethod === "credit" &&
          !allowNewCreditAccounts &&
          !creditAccountId && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                New credit accounts are currently disabled
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Only existing customers can take credit.
              </p>
            </div>
          )}

        {/* Compact Order Summary */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowItems(!showItems)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[#1c6a1e]/10 flex items-center justify-center">
                <span className="text-xs font-bold text-[#1c6a1e]">
                  {items.length}
                </span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-0.5">
                {walletAmountApplied > EPS ? (
                  <>
                    <span className="text-xs text-slate-400 line-through">
                      {formatPrice(total)}
                    </span>
                    <span className="text-base font-bold text-[#1c6a1e]">
                      {formatPrice(amountDue)} due
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {formatPrice(total)}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showItems ? "rotate-180" : ""}`}
              />
            </div>
          </button>
          {showItems && (
            <div className="px-4 pb-3 space-y-2 border-t border-slate-50 dark:border-slate-800/50 pt-2">
              {items.map((item) => (
                <div
                  key={
                    item.inventoryBatchId
                      ? `${item.itemId}:${item.inventoryBatchId}`
                      : item.itemId
                  }
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate uppercase">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.quantity} {item.unitType} ×{" "}
                      {formatPrice(item.price)}
                      {item.batchNumber && (
                        <span className="ml-1 font-mono">
                          Lot: {item.batchNumber}
                        </span>
                      )}
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
              creditDisabled={canGiveCredit === false}
              creditDisabledReason="Credit is not enabled for your account. Contact an admin."
            />
            {canGiveCredit === false && paymentMethod === "credit" && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                You cannot give credit on this account.
              </p>
            )}
            {(paymentMethod === "credit" && creditAccountId) ||
            walletCreditAccountId ? (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Credit / wallet
                </p>
                {!isOnline ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect to view wallet balance
                  </p>
                ) : checkoutWalletBalanceLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin shrink-0"
                      aria-hidden
                    />
                    Loading wallet…
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="text-slate-500 dark:text-slate-400">
                      Store wallet balance
                    </span>{" "}
                    <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                      {formatPrice(checkoutWalletBalance ?? 0)}
                    </span>
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {paymentMethod &&
            (paymentMethod === "cash" ||
              paymentMethod === "mpesa" ||
              paymentMethod === "split") && (
              <WalletApplySection
                cartTotal={total}
                disabled={!isOnline}
                creditAccountId={walletCreditAccountId}
                onCreditAccountIdChange={setWalletCreditAccountId}
                walletAmountApplied={walletAmountApplied}
                onWalletAmountAppliedChange={setWalletAmountApplied}
              />
            )}

          {/* Cash */}
          {paymentMethod === "cash" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 space-y-3 ring-1 ring-slate-200 dark:ring-slate-800">
              <Label
                htmlFor="cash"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Cash Received
                {walletAmountApplied > EPS && (
                  <span className="block text-xs font-normal text-slate-500 mt-0.5">
                    Amount due after wallet: {formatPrice(amountDue)}
                  </span>
                )}
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
                        ? "bg-[#1c6a1e] text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {amount.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Change display */}
              {cashReceived && (
                <div className="space-y-2">
                  {walletCreditAccountId &&
                    cashExcessToWallet > EPS &&
                    cashAmount + EPS >= amountDue && (
                      <p className="text-xs text-violet-700 dark:text-violet-300 font-medium px-1">
                        {formatPrice(cashExcessToWallet)} will be added to this
                        customer&apos;s wallet (no cash change).
                      </p>
                    )}
                  <div
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                      cashAmount + EPS >= amountDue
                        ? "bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800"
                        : "bg-red-50 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        cashAmount + EPS >= amountDue
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {cashAmount + EPS >= amountDue ? "Change" : "Short by"}
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        cashAmount + EPS >= amountDue
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatPrice(
                        cashAmount + EPS >= amountDue
                          ? Math.abs(change)
                          : Math.abs(amountDue - cashAmount),
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* M-Pesa info */}
          {paymentMethod === "mpesa" && (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-4 ring-1 ring-orange-200 dark:ring-orange-900">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                    M-Pesa Payment
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                    {isOnline
                      ? "Use buttons below to process"
                      : "Offline: Mark as Paid to record sale"}
                  </p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-300 mt-2">
                    {formatPrice(amountDue)}
                    {walletAmountApplied > EPS && (
                      <span className="block text-xs font-normal text-orange-600/90">
                        After wallet ({formatPrice(walletAmountApplied)}{" "}
                        applied)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Credit */}
          {paymentMethod === "credit" && (
            <>
              <CreditForm
                customerName={customerName}
                customerPhone={customerPhone}
                onCustomerNameChange={setCustomerName}
                onCustomerPhoneChange={setCustomerPhone}
                creditAccountId={creditAccountId}
                onCreditAccountIdChange={setCreditAccountId}
              />
              {creditAccountId &&
                creditWalletBalance != null &&
                creditWalletBalance > EPS && (
                  <div className="rounded-2xl p-4 space-y-3 ring-1 ring-violet-200 dark:ring-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20">
                    <Label
                      htmlFor="creditWalletAmt"
                      className="text-sm font-medium text-violet-900 dark:text-violet-100"
                    >
                      Pay from wallet · max{" "}
                      {formatPrice(Math.min(creditWalletBalance, total))}{" "}
                      (default)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="creditWalletAmt"
                        type="number"
                        step="1"
                        min={0}
                        max={Math.min(creditWalletBalance, total)}
                        value={creditWalletAmountInput}
                        onChange={(e) =>
                          setCreditWalletAmountInput(e.target.value)
                        }
                        onBlur={() => {
                          const n =
                            Math.round(
                              (parseFloat(creditWalletAmountInput) || 0) * 100,
                            ) / 100;
                          const max = Math.min(creditWalletBalance, total);
                          const capped = Math.max(0, Math.min(n, max));
                          setWalletAmountApplied(capped);
                          setCreditWalletAmountInput(
                            capped > 0 ? String(capped) : "",
                          );
                        }}
                        placeholder="0"
                        className="h-11"
                        disabled={!isOnline}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 h-11"
                        disabled={!isOnline}
                        onClick={() => {
                          const max = Math.min(creditWalletBalance, total);
                          setWalletAmountApplied(max);
                          setCreditWalletAmountInput(
                            max > 0 ? String(max) : "",
                          );
                        }}
                      >
                        Max
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="shrink-0 h-11"
                        disabled={!isOnline}
                        onClick={() => {
                          setWalletAmountApplied(0);
                          setCreditWalletAmountInput("");
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    {!isOnline && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Wallet needs a connection.
                      </p>
                    )}
                  </div>
                )}
            </>
          )}

          {/* Split */}
          {paymentMethod === "split" && (
            <SplitPaymentForm
              total={amountDue}
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
      <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm p-4 space-y-3">
        {paymentMethod && items.length > 0 && (
          <div
            className="rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
            role="region"
            aria-label="Payment summary"
          >
            <div className="px-3.5 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Checkout summary
              </p>
            </div>
            <div className="px-3.5 py-3 space-y-2.5 text-sm">
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-600 dark:text-slate-400">
                  Cart total
                </span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatPrice(total)}
                </span>
              </div>

              {walletAmountApplied > EPS && (
                <div className="flex justify-between items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/35 px-2.5 py-2 ring-1 ring-violet-200/80 dark:ring-violet-800/50">
                  <span className="flex items-center gap-2 text-violet-800 dark:text-violet-200 min-w-0">
                    <Wallet
                      className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                      aria-hidden
                    />
                    <span className="leading-tight">
                      <span className="block font-medium">
                        From store wallet
                      </span>
                      <span className="block text-[11px] text-violet-600/90 dark:text-violet-300/90 font-normal">
                        Deducted from balance
                      </span>
                    </span>
                  </span>
                  <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300 shrink-0">
                    −{formatPrice(walletAmountApplied)}
                  </span>
                </div>
              )}

              {paymentMethod === "cash" &&
                walletCreditAccountId &&
                cashExcessToWallet > EPS && (
                  <div className="flex justify-between items-center gap-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/25 px-2.5 py-2 ring-1 ring-emerald-200/70 dark:ring-emerald-900/40">
                    <span className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100 min-w-0">
                      <Wallet
                        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      <span className="leading-tight text-[13px]">
                        <span className="block font-medium">
                          Change → wallet
                        </span>
                        <span className="block text-[11px] opacity-90 font-normal">
                          Customer keeps no cash back
                        </span>
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300 shrink-0">
                      +{formatPrice(cashExcessToWallet)}
                    </span>
                  </div>
                )}

              <div className="h-px bg-slate-200 dark:bg-slate-700" />

              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                    {amountDuePrimaryLabel}
                  </p>
                  {paymentMethod === "credit" &&
                    amountDue < EPS &&
                    walletAmountApplied > EPS && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Wallet covers this sale — nothing new on tab
                      </p>
                    )}
                  {paymentMethod === "cash" && amountDue > EPS && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Tender this amount (after wallet)
                    </p>
                  )}
                </div>
                <p className="text-xl font-bold tabular-nums text-[#1c6a1e] dark:text-emerald-400 shrink-0">
                  {formatPrice(amountDue)}
                </p>
              </div>

              {walletBalanceAfterSale !== null && (
                <div className="pt-2 mt-0.5 border-t border-dashed border-slate-200 dark:border-slate-600">
                  <div className="flex justify-between items-center gap-2 text-[13px]">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Wallet
                        className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 shrink-0"
                        aria-hidden
                      />
                      <span className="leading-tight">
                        <span className="block font-medium text-slate-700 dark:text-slate-300">
                          Wallet after sale
                        </span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-500 font-normal">
                          Estimated balance
                        </span>
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-violet-700 dark:text-violet-300">
                      {formatPrice(walletBalanceAfterSale)}
                    </span>
                  </div>
                </div>
              )}

              {!isOnline && walletPreviewAccountId && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1.5">
                  Wallet preview needs a connection.
                </p>
              )}
            </div>
          </div>
        )}

        {paymentMethod === "mpesa" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => initiateMpesaPayment()}
                className="h-12 rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-medium"
                disabled={
                  isProcessing ||
                  isMpesaInitiating ||
                  !isOnline ||
                  amountDue < EPS
                }
                title={
                  !isOnline
                    ? "Requires connection"
                    : amountDue < EPS
                      ? "Nothing to pay by M-Pesa"
                      : undefined
                }
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
            <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 leading-snug">
              {isOnline
                ? "Online Pay opens M-Pesa · Mark Paid if they paid outside the prompt"
                : "Offline: use Mark Paid only"}
            </p>
          </>
        )}

        {paymentMethod === "credit" && !isValid && !isProcessing && (
          <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-400 -mb-1">
            {!hasValidPhone
              ? "Enter the full 9-digit phone number to continue"
              : !customerName.trim() && !creditAccountId
                ? "Select a customer or enter a name"
                : total <= EPS
                  ? "Cart is empty"
                  : ""}
          </p>
        )}

        {paymentMethod !== "mpesa" && (
          <Button
            type="submit"
            disabled={!isValid || isProcessing}
            className="w-full min-h-[3.75rem] h-auto py-3 rounded-2xl text-base font-bold bg-[#1c6a1e] hover:bg-[#155a17] text-white shadow-lg shadow-[#1c6a1e]/25 disabled:shadow-none disabled:opacity-50 transition-all flex flex-col gap-1"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2 py-0.5">
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing…
              </span>
            ) : (
              <>
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2
                    className="h-5 w-5 opacity-90 shrink-0"
                    aria-hidden
                  />
                  <span>
                    {paymentMethod === "split"
                      ? "Complete split payment"
                      : "Complete sale"}
                  </span>
                </span>
                <span className="text-xs font-semibold text-white/90 tabular-nums leading-tight px-1 text-center max-w-[95%]">
                  {walletAmountApplied > EPS ? (
                    <>
                      <span>Wallet −{formatPrice(walletAmountApplied)}</span>
                      <span className="text-white/60 mx-1">·</span>
                      {paymentMethod === "credit" && amountDue < EPS ? (
                        <span>Nothing new on tab</span>
                      ) : paymentMethod === "credit" ? (
                        <span>Tab +{formatPrice(amountDue)}</span>
                      ) : paymentMethod === "cash" ? (
                        <span>Collect {formatPrice(amountDue)}</span>
                      ) : paymentMethod === "split" ? (
                        <span>Pay total {formatPrice(amountDue)}</span>
                      ) : (
                        <span>{formatPrice(amountDue)}</span>
                      )}
                    </>
                  ) : paymentMethod === "credit" ? (
                    amountDue < EPS ? (
                      <>No new amount on tab</>
                    ) : (
                      <>New on tab: {formatPrice(amountDue)}</>
                    )
                  ) : paymentMethod === "split" ? (
                    <>Pay {formatPrice(amountDue)} across methods</>
                  ) : (
                    <>Collect {formatPrice(amountDue)}</>
                  )}
                </span>
              </>
            )}
          </Button>
        )}

        <button
          type="button"
          onClick={() =>
            onBackToCart ? onBackToCart() : router.push("/pos/cart")
          }
          className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          disabled={isProcessing}
        >
          &larr; Back to cart
        </button>
      </div>

      <ManagerPinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        title={
          paymentMethod === "mpesa"
            ? "Approve manual M-Pesa payment"
            : "Manager approval required"
        }
        description={
          paymentMethod === "mpesa"
            ? "An owner or admin PIN is required to mark this sale as paid without M-Pesa verification."
            : "Enter an owner or admin PIN to approve this sale (below-cost price or oversell)."
        }
        onVerified={(pin) => {
          setManagerPin(pin);
          setPinDialogOpen(false);
          if (pendingSaleAfterPin) {
            setPendingSaleAfterPin(false);
            void completeSale(pin);
          }
        }}
      />
    </form>
  );
}
