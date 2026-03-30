'use client';

import type { Sale, SaleItem } from '@/lib/db/types';

interface SplitPayment {
  id: string;
  sale_id: string;
  payment_method: 'cash' | 'mpesa' | 'credit';
  amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: number;
}

interface ReceiptProps {
  sale: Sale & { business_name?: string; user_name?: string | null };
  items: (SaleItem & {
    item_name: string;
    item_unit_type: string;
    batch_number?: string | null;
  })[];
  splitPayments?: SplitPayment[];
}

/** Deterministic pseudo-barcode stripes from sale id (decorative, not scannable). */
function barcodeStripes(seed: string): number[] {
  const s = seed.replace(/-/g, '');
  const widths: number[] = [];
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  for (let i = 0; i < 80; i++) {
    const rot = h >>> 13;
    h = Math.imul(h ^ rot, 1274126177) >>> 0;
    widths.push((h % 3) + 1);
  }
  return widths;
}

function ReceiptBarcode({ seed }: { seed: string }) {
  const stripes = barcodeStripes(seed);
  return (
    <div
      className="flex w-full justify-center gap-0 my-3 print:my-2 h-11 print:h-9 items-stretch overflow-hidden"
      aria-hidden
    >
      {stripes.map((w, i) => (
        <div
          key={i}
          className="shrink-0 bg-black"
          style={{ width: `${w}px`, minWidth: `${w}px` }}
        />
      ))}
    </div>
  );
}

function receiptTitle(method: Sale['payment_method']): string {
  switch (method) {
    case 'cash':
      return 'CASH RECEIPT';
    case 'mpesa':
      return 'MPESA RECEIPT';
    case 'split':
      return 'SPLIT PAYMENT RECEIPT';
    case 'credit':
      return 'CREDIT RECEIPT';
    default:
      return 'SALES RECEIPT';
  }
}

export function Receipt({ sale, items, splitPayments }: ReceiptProps) {
  const formatPrice = (price: number) => price.toFixed(0);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-KE', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity_sold * item.sell_price_per_unit,
    0
  );

  const storeName = (sale.business_name || "FnM's").toUpperCase();

  return (
    <div
      id="receipt-to-print"
      className="receipt-print-container p-4 print:p-3 flex justify-center bg-[#e8e8e8] print:bg-white"
      style={{ color: '#000000', WebkitTextFillColor: '#000000' } as React.CSSProperties}
    >
      <div
        className="w-full max-w-[280px] sm:max-w-[300px] bg-[#f0f0f0] print:bg-white print:w-full print:max-w-none shadow-md print:shadow-none rounded-sm print:rounded-none overflow-hidden print:overflow-visible font-mono text-black"
        style={{ color: '#000000', WebkitTextFillColor: '#000000' } as React.CSSProperties}
      >
        <div
          className="px-3 py-4 print:px-2 print:py-3 text-[13px] print:text-[11px] leading-snug text-black"
          style={{
            color: '#000000',
            WebkitTextFillColor: '#000000',
            WebkitFontSmoothing: 'none',
            MozOsxFontSmoothing: 'grayscale',
          } as React.CSSProperties}
        >
          {/* Header — centered, thermal style */}
          <div className="text-center uppercase tracking-wide text-black">
            <p className="text-[15px] print:text-[13px] font-black leading-tight mb-1 text-black">
              {storeName}
            </p>
            <p className="text-[11px] print:text-[10px] font-semibold normal-case tracking-normal mb-2 text-black">
              Fresh n More
            </p>
            <p className="text-[12px] print:text-[11px] font-black mb-3 text-black">
              {receiptTitle(sale.payment_method)}
            </p>
          </div>

          <div className="space-y-0.5 mb-1 text-black">
            <div className="flex justify-between gap-2">
              <span className="text-black">Date:</span>
              <span className="text-black tabular-nums">{formatDateShort(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-black">Time:</span>
              <span className="text-black tabular-nums">{formatTime(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between gap-2 text-[11px] print:text-[10px]">
              <span className="text-black">Receipt#</span>
              <span className="font-bold text-black tabular-nums">{sale.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <ReceiptBarcode seed={sale.id} />

          <div className="border-t border-dotted border-black my-2 print:my-1.5" />

          {/* Line items — name left, line total right */}
          <div className="space-y-1 mb-2 text-black">
            {items.map((item) => {
              const lineTotal = item.quantity_sold * item.sell_price_per_unit;
              const qtyLabel =
                item.quantity_sold !== 1 ? ` ×${item.quantity_sold}` : '';
              return (
                <div key={item.id} className="text-black">
                  <div className="flex justify-between gap-2 items-baseline">
                    <span className="flex-1 min-w-0 text-left text-black leading-tight">
                      {item.item_name}
                      {qtyLabel && (
                        <span className="font-bold text-black">{qtyLabel}</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-black text-right">
                      KES {formatPrice(lineTotal)}
                    </span>
                  </div>
                  {item.item_unit_type && (
                    <div className="text-[10px] print:text-[9px] text-black mt-0.5 pl-0">
                      @ {formatPrice(item.sell_price_per_unit)}/{item.item_unit_type}
                    </div>
                  )}
                  {item.batch_number && (
                    <div className="text-[10px] print:text-[9px] text-black">
                      Lot: {item.batch_number}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-dotted border-black my-2 print:my-1.5" />

          {/* Totals — bold label left, value right */}
          <div className="space-y-1 mb-2 text-black">
            <div className="flex justify-between gap-2 font-black text-[13px] print:text-[12px]">
              <span className="text-black">TOTAL:</span>
              <span className="tabular-nums text-black">KES {formatPrice(sale.total_amount)}</span>
            </div>
            {subtotal !== sale.total_amount && (
              <div className="flex justify-between gap-2 text-[11px] print:text-[10px] font-semibold">
                <span className="text-black">SUBTOTAL:</span>
                <span className="tabular-nums text-black">KES {formatPrice(subtotal)}</span>
              </div>
            )}
            {sale.payment_method === 'cash' && (
              <div className="flex justify-between gap-2 font-bold text-[12px] print:text-[11px]">
                <span className="text-black">CASH:</span>
                <span className="tabular-nums text-black">KES {formatPrice(sale.total_amount)}</span>
              </div>
            )}
            {sale.payment_method === 'mpesa' && (
              <div className="flex justify-between gap-2 font-bold text-[12px] print:text-[11px]">
                <span className="text-black">MPESA:</span>
                <span className="tabular-nums text-black">KES {formatPrice(sale.total_amount)}</span>
              </div>
            )}
            {sale.payment_method === 'split' && splitPayments && splitPayments.length > 0 && (
              <div className="space-y-0.5 pt-1 border-t border-dotted border-black">
                {splitPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between gap-2 font-bold text-[11px] print:text-[10px]"
                  >
                    <span className="uppercase text-black">
                      {payment.payment_method}
                      {payment.payment_method === 'credit' && payment.customer_name && (
                        <span className="normal-case font-semibold">
                          {' '}
                          ({payment.customer_name})
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-black">KES {formatPrice(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {sale.payment_method === 'credit' && (
              <div className="flex justify-between gap-2 font-bold text-[12px] print:text-[11px]">
                <span className="text-black">CREDIT:</span>
                <span className="tabular-nums text-black">KES {formatPrice(sale.total_amount)}</span>
              </div>
            )}
          </div>

          {(sale.user_name || sale.customer_name) && (
            <>
              <div className="border-t border-dotted border-black my-2 print:my-1.5" />
              <div className="space-y-0.5 text-[10px] print:text-[9px] text-black">
                {sale.user_name && (
                  <div className="flex justify-between gap-2">
                    <span className="text-black">Served by:</span>
                    <span className="text-black truncate max-w-[55%] text-right">{sale.user_name}</span>
                  </div>
                )}
                {sale.customer_name && (
                  <div className="flex justify-between gap-2">
                    <span className="text-black">Customer:</span>
                    <span className="text-black truncate max-w-[55%] text-right">{sale.customer_name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border-t border-dotted border-black my-3 print:my-2" />

          <p className="receipt-thank-you text-center text-[11px] print:text-[10px] leading-relaxed text-black">
            THANK YOU FOR
            <br />
            SHOPPING
          </p>

          <div className="text-center text-[9px] print:text-[8px] mt-2 space-y-0.5 normal-case text-black">
            <p className="text-black">www.fnms.co.ke · Tel: 0113 277 767</p>
            <p className="font-bold text-black">Till: 3020127 — Zelisline</p>
            <p className="text-black mt-1 tabular-nums">{formatDate(sale.sale_date)}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .font-mono {
          font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
        }

        #receipt-to-print,
        #receipt-to-print *,
        #receipt-to-print *::before,
        #receipt-to-print *::after {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-fill-color: #000000 !important;
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: grayscale !important;
          font-smoothing: none !important;
          text-rendering: optimizeLegibility !important;
          font-weight: 600 !important;
        }

        #receipt-to-print b,
        #receipt-to-print strong,
        #receipt-to-print .font-bold,
        #receipt-to-print [class*='font-bold'],
        #receipt-to-print .font-black,
        #receipt-to-print [class*='font-black'],
        #receipt-to-print .font-extrabold,
        #receipt-to-print [class*='font-extrabold'] {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-fill-color: #000000 !important;
          font-weight: 900 !important;
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: grayscale !important;
        }

        #receipt-to-print .border-black,
        #receipt-to-print [class*='border'] {
          border-color: #000000 !important;
        }

        #receipt-to-print span,
        #receipt-to-print p,
        #receipt-to-print div {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-fill-color: #000000 !important;
        }

        #receipt-to-print .receipt-thank-you {
          font-style: italic !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
      `}</style>
    </div>
  );
}
