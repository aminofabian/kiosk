'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RotateCcw, Search, Printer } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { RefundReceipt } from '@/components/pos/RefundReceipt';
import { creditAccountPhonesDisplay, formatKenyaPhoneForLookup } from '@/lib/utils/credit-phones';
import { normalizeSaleIdInput } from '@/lib/utils/sale-id';
import type { CreditAccount } from '@/lib/db/types';

type RefundMethod = 'cash' | 'mpesa' | 'wallet' | 'credit_note';

interface ReturnableItem {
  id: string;
  item_id: string;
  item_name: string;
  quantity_sold: number;
  quantity_returned: number;
  quantity_returnable: number;
  sell_price_per_unit: number;
}

interface SaleSummary {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  sale_date: number;
  customer_name: string | null;
  customer_phone: string | null;
}

interface RefundResult {
  returnId: string;
  totalRefundAmount: number;
  return: {
    id: string;
    total_refund_amount: number;
    refund_method: string;
    reason: string;
    mpesa_reference: string | null;
    created_at: number;
  };
  items: {
    quantity_returned: number;
    refund_amount: number;
    item_name: string;
    sell_price_per_unit: number;
  }[];
  sale: {
    total_amount: number;
    payment_method: string;
    sale_date: number;
    customer_name: string | null;
    business_name: string;
  };
  originalSaleId: string;
}

interface PosReturnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PosReturnsDialog({ open, onOpenChange }: PosReturnsDialogProps) {
  const [saleIdInput, setSaleIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<SaleSummary | null>(null);
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
  const [mpesaReference, setMpesaReference] = useState('');
  const [creditAccountId, setCreditAccountId] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [accountsByPhone, setAccountsByPhone] = useState<CreditAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [refundResult, setRefundResult] = useState<RefundResult | null>(null);

  const reset = useCallback(() => {
    setSaleIdInput('');
    setSale(null);
    setItems([]);
    setQuantities({});
    setReason('');
    setRefundMethod('cash');
    setMpesaReference('');
    setCreditAccountId(null);
    setCustomerPhone('');
    setAccountsByPhone([]);
    setRefundResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const loadSale = async () => {
    const id = normalizeSaleIdInput(saleIdInput);
    if (!id) {
      setError('Enter a sale ID or receipt reference');
      return;
    }
    setLoading(true);
    setError(null);
    setRefundResult(null);
    try {
      const res = await apiGet<{
        sale: SaleSummary;
        items: ReturnableItem[];
      }>(`/api/sales/${encodeURIComponent(id)}/returns`);
      if (!res.success || !res.data) {
        setError(res.message || 'Sale not found');
        setSale(null);
        setItems([]);
        return;
      }
      setSale(res.data.sale);
      setItems(res.data.items);
      const initialQty: Record<string, string> = {};
      for (const item of res.data.items) {
        if (item.quantity_returnable > 0) {
          initialQty[item.id] = '';
        }
      }
      setQuantities(initialQty);
    } catch {
      setError('Failed to load sale');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!customerPhone.trim() || refundMethod === 'cash' || refundMethod === 'mpesa') {
      setAccountsByPhone([]);
      return;
    }
    const t = setTimeout(async () => {
      const lookup = formatKenyaPhoneForLookup(customerPhone);
      if (lookup.replace(/\D/g, '').length < 9) return;
      setLoadingAccounts(true);
      try {
        const res = await apiGet<CreditAccount[]>(
          `/api/credits?phone=${encodeURIComponent(lookup)}`
        );
        setAccountsByPhone(res.success && res.data ? res.data : []);
      } catch {
        setAccountsByPhone([]);
      } finally {
        setLoadingAccounts(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [customerPhone, refundMethod]);

  const selectedLines = items
    .map((item) => {
      const qty = parseFloat(quantities[item.id] || '0');
      if (!qty || qty <= 0) return null;
      return { saleItemId: item.id, quantity: qty };
    })
    .filter(Boolean) as { saleItemId: string; quantity: number }[];

  const previewTotal = items.reduce((sum, item) => {
    const qty = parseFloat(quantities[item.id] || '0');
    if (qty > 0) return sum + qty * item.sell_price_per_unit;
    return sum;
  }, 0);

  const handleSubmit = async () => {
    if (!sale) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<RefundResult>(`/api/sales/${sale.id}/returns`, {
        reason,
        refundMethod,
        creditAccountId: creditAccountId ?? undefined,
        mpesaReference: refundMethod === 'mpesa' ? mpesaReference : undefined,
        lines: selectedLines,
      });
      if (!res.success || !res.data) {
        setError(res.message || 'Return failed');
        return;
      }
      setRefundResult(res.data);
    } catch {
      setError('Return failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto print:max-w-none print:border-0">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-[#1c6a1e]" />
            Returns &amp; Refunds
          </DialogTitle>
          <DialogDescription>
            Look up a sale, select items to return, and issue a refund or credit note.
          </DialogDescription>
        </DialogHeader>

        {refundResult ? (
          <div>
            <RefundReceipt
              businessName={refundResult.sale.business_name}
              originalSaleId={refundResult.originalSaleId}
              returnId={refundResult.returnId}
              totalRefundAmount={refundResult.totalRefundAmount}
              refundMethod={refundResult.return.refund_method}
              reason={refundResult.return.reason}
              mpesaReference={refundResult.return.mpesa_reference}
              items={refundResult.items}
              saleDate={refundResult.sale.sale_date}
              createdAt={refundResult.return.created_at}
            />
            <div className="flex gap-2 mt-4 print:hidden">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30]"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : !sale ? (
          <div className="space-y-4 print:hidden">
            <div className="space-y-2">
              <Label htmlFor="returnSaleId">Sale ID</Label>
              <div className="flex gap-2">
                <Input
                  id="returnSaleId"
                  value={saleIdInput}
                  onChange={(e) => setSaleIdInput(e.target.value)}
                  placeholder="e.g. C05A6289 (from receipt)"
                  className="h-11 font-mono text-sm uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && loadSale()}
                />
                <Button
                  type="button"
                  onClick={loadSale}
                  disabled={loading}
                  className="h-11 bg-[#1c6a1e] hover:bg-[#2a8a30] shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use the 8-character code printed on the receipt (with or without #), or paste the full sale ID.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 print:hidden">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
              <p className="font-medium">Sale {sale.id.slice(0, 8)}…</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                KES {sale.total_amount.toFixed(0)} · {sale.payment_method}
                {sale.customer_name ? ` · ${sale.customer_name}` : ''}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Items to return</Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Sold {item.quantity_sold} · Returned {item.quantity_returned} · KES{' '}
                        {item.sell_price_per_unit.toFixed(0)} each
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity_returnable}
                      step="any"
                      disabled={item.quantity_returnable <= 0}
                      value={quantities[item.id] ?? ''}
                      onChange={(e) =>
                        setQuantities((q) => ({ ...q, [item.id]: e.target.value }))
                      }
                      className="w-20 h-10 text-center"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {previewTotal > 0 && (
              <p className="text-sm font-semibold text-[#1c6a1e]">
                Refund preview: KES {previewTotal.toFixed(0)}
              </p>
            )}

            <div className="space-y-2">
              <Label>Refund method</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['cash', 'Cash'],
                    ['mpesa', 'M-Pesa'],
                    ['wallet', 'Wallet credit'],
                    ['credit_note', 'Credit note'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRefundMethod(value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      refundMethod === value
                        ? 'border-[#1c6a1e] bg-[#1c6a1e]/10 text-[#1c6a1e] font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(refundMethod === 'wallet' || refundMethod === 'credit_note') && (
              <div className="space-y-2">
                <Label htmlFor="returnCustomerPhone">Customer phone</Label>
                <Input
                  id="returnCustomerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setCreditAccountId(null);
                  }}
                  placeholder="e.g. 0712345678"
                  className="h-11"
                />
                {loadingAccounts && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Looking up…
                  </p>
                )}
                {accountsByPhone.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto border rounded-lg p-2">
                    {accountsByPhone.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setCreditAccountId(acc.id)}
                        className={`w-full text-left rounded px-2 py-1.5 text-sm ${
                          creditAccountId === acc.id
                            ? 'bg-[#1c6a1e] text-white'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {acc.customer_name}
                        <span className="block text-xs opacity-80">
                          {creditAccountPhonesDisplay(acc)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {refundMethod === 'mpesa' && (
              <div className="space-y-2">
                <Label htmlFor="mpesaRef">M-Pesa confirmation / reference</Label>
                <Input
                  id="mpesaRef"
                  value={mpesaReference}
                  onChange={(e) => setMpesaReference(e.target.value)}
                  placeholder="e.g. QGH1A2B3C4"
                  className="h-11"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="returnReason">Reason</Label>
              <Input
                id="returnReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer changed mind, damaged packaging"
                className="h-11"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSale(null);
                  setItems([]);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[#1c6a1e] hover:bg-[#2a8a30]"
                disabled={submitting || selectedLines.length === 0 || !reason.trim()}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Process return'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
