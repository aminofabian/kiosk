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
  items: (SaleItem & { item_name: string; item_unit_type: string })[];
  splitPayments?: SplitPayment[];
}

export function Receipt({ sale, items, splitPayments }: ReceiptProps) {
  const formatPrice = (price: number) => {
    return price.toFixed(0);
  };

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

  return (
    <div
      id="receipt-to-print"
      className="receipt-print-container p-4 print:p-4 flex justify-center bg-gray-50 print:bg-white"
      style={{ color: '#000000', WebkitTextFillColor: '#000000' } as React.CSSProperties}
    >
      {/* On-screen: wider, more readable. Print: also larger for standard A4 printing. */}
      <div
        className="w-full max-w-sm sm:max-w-md bg-white print:w-full print:max-w-lg print:mr-0 shadow-lg print:shadow-none rounded-lg print:rounded-none overflow-hidden font-mono text-black"
        style={{ color: '#000000', WebkitTextFillColor: '#000000' } as React.CSSProperties}
      >
        {/* Receipt Container */}
        <div
          className="px-4 py-5 print:px-6 print:py-4 text-base print:text-[13px] leading-tight text-black"
          style={{ color: '#000000', WebkitTextFillColor: '#000000', WebkitFontSmoothing: 'none', MozOsxFontSmoothing: 'grayscale' } as React.CSSProperties}
        >
          {/* Header (text-only, no logo for clear thermal printing) */}
          <div className="text-center mb-3 print:mb-0.5 text-black" style={{ color: '#000000' }}>
            <p className="text-lg print:text-[16px] font-extrabold tracking-wide mb-0.5 text-black" style={{ color: '#000000' }}>
              {sale.business_name || "FnM's"}
            </p>
            <p className="text-xs print:text-[12px] tracking-wide mb-1 text-black" style={{ color: '#000000' }}>
              Fresh and More
            </p>
            <p className="text-sm print:text-[12px] mb-2 print:mb-1 text-black" style={{ color: '#000000' }}>
              Thank you for your purchase!
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-black my-1 print:my-0.5"></div>

          {/* Receipt Info */}
          <div className="space-y-0.5 mb-1 print:mb-1 text-sm print:text-[13px] text-black" style={{ color: '#000000' }}>
            <div className="flex justify-between" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>Receipt#:</span>
              <span className="font-bold text-black" style={{ color: '#000000' }}>{sale.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>Date:</span>
              <span className="text-black" style={{ color: '#000000' }}>{formatDateShort(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>Time:</span>
              <span className="text-black" style={{ color: '#000000' }}>{formatTime(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>Payment:</span>
              <span className="uppercase font-bold text-black" style={{ color: '#000000' }}>{sale.payment_method}</span>
            </div>
            {/* Split Payment Details */}
            {sale.payment_method === 'split' && splitPayments && splitPayments.length > 0 && (
              <div className="mt-0.5 pl-1 border-l border-black space-y-0.5" style={{ color: '#000000' }}>
                {splitPayments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-xs print:text-[11px]" style={{ color: '#000000' }}>
                    <span className="uppercase text-black" style={{ color: '#000000' }}>
                      {payment.payment_method}
                      {payment.payment_method === 'credit' && payment.customer_name && (
                        <span className="normal-case"> ({payment.customer_name})</span>
                      )}
                    </span>
                    <span className="font-bold text-black" style={{ color: '#000000' }}>KES {formatPrice(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {sale.user_name && (
              <div className="flex justify-between" style={{ color: '#000000' }}>
                <span className="text-black" style={{ color: '#000000' }}>Served by:</span>
                <span className="font-bold text-black truncate max-w-[50%]" style={{ color: '#000000' }}>{sale.user_name}</span>
              </div>
            )}
            {sale.customer_name && (
              <div className="flex justify-between" style={{ color: '#000000' }}>
                <span className="text-black" style={{ color: '#000000' }}>Customer:</span>
                <span className="text-black truncate max-w-[50%]" style={{ color: '#000000' }}>{sale.customer_name}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-black my-1 print:my-0.5"></div>

          {/* Items Header */}
          <div className="text-xs print:text-[11px] font-bold mb-0.5 print:mb-0 text-black" style={{ color: '#000000' }}>
            <div className="flex justify-between" style={{ color: '#000000' }}>
              <span className="flex-1 text-black" style={{ color: '#000000' }}>ITEM</span>
              <span className="w-6 print:w-5 text-right text-black" style={{ color: '#000000' }}>QTY</span>
              <span className="w-10 print:w-8 text-right text-black" style={{ color: '#000000' }}>PRICE</span>
              <span className="w-12 print:w-10 text-right text-black" style={{ color: '#000000' }}>TOTAL</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black my-0.5 print:my-0"></div>

          {/* Items List */}
          <div className="space-y-0.5 mb-1 print:mb-0.5" style={{ color: '#000000' }}>
            {items.map((item) => {
              const itemTotal = item.quantity_sold * item.sell_price_per_unit;
              // Truncate long item names for print (shorter for narrower receipt)
              const truncatedName = item.item_name.length > 14 
                ? item.item_name.substring(0, 12) + '..' 
                : item.item_name;
              return (
                <div key={item.id} className="text-xs print:text-[11px] text-black" style={{ color: '#000000' }}>
                  <div className="flex justify-between" style={{ color: '#000000' }}>
                    <span className="flex-1 leading-tight text-black print:hidden" style={{ color: '#000000' }}>
                      {item.item_name}
                    </span>
                    <span className="flex-1 leading-tight text-black hidden print:inline" style={{ color: '#000000' }}>
                      {truncatedName}
                    </span>
                    <span className="w-6 print:w-5 text-right text-black" style={{ color: '#000000' }}>
                      {item.quantity_sold}
                    </span>
                    <span className="w-10 print:w-8 text-right text-black" style={{ color: '#000000' }}>
                      {formatPrice(item.sell_price_per_unit)}
                    </span>
                    <span className="w-12 print:w-10 text-right font-bold text-black" style={{ color: '#000000' }}>
                      {formatPrice(itemTotal)}
                    </span>
                  </div>
                  {item.item_unit_type && (
                    <div className="text-[10px] print:text-[10px] ml-0 text-black" style={{ color: '#000000' }}>
                      @ {formatPrice(item.sell_price_per_unit)}/{item.item_unit_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-black my-1 print:my-0.5"></div>

          {/* Totals */}
          <div className="space-y-0.5 mb-1 print:mb-1" style={{ color: '#000000' }}>
            <div className="flex justify-between text-sm print:text-[13px] text-black" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>SUBTOTAL:</span>
              <span className="font-bold text-black" style={{ color: '#000000' }}>KES {formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base print:text-[15px] border-t border-black pt-1 print:pt-1 mt-1 print:mt-1" style={{ color: '#000000' }}>
              <span className="font-bold uppercase text-black" style={{ color: '#000000' }}>TOTAL:</span>
              <span className="font-bold text-black" style={{ color: '#000000' }}>KES {formatPrice(sale.total_amount)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black my-1 print:my-0.5"></div>

          {/* Footer */}
          <div className="text-center space-y-0.5 text-xs print:text-[11px] text-black" style={{ color: '#000000' }}>
            <p className="font-bold mb-0.5 print:mb-0 text-black" style={{ color: '#000000' }}>Thank you for shopping!</p>
            
            {/* Contact Information */}
            <div className="space-y-0 mt-1 print:mt-1 pt-1 print:pt-1 border-t border-black text-black" style={{ color: '#000000' }}>
              <p className="font-bold text-black" style={{ color: '#000000' }}>Get in Touch</p>
              <p className="text-black" style={{ color: '#000000' }}>www.fnms.co.ke</p>
              <p className="text-black" style={{ color: '#000000' }}>Tel: 0721 530 181</p>
            </div>

            {/* Additional Info */}
            <div className="mt-1 print:mt-0 space-y-0 text-black" style={{ color: '#000000' }}>
              <p className="text-[10px] print:text-[10px] text-black" style={{ color: '#000000' }}>
                Quality • Value • Service
              </p>
            </div>

            <p className="mt-1 print:mt-1 text-[10px] print:text-[10px] text-black" style={{ color: '#000000' }}>
              {formatDate(sale.sale_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Font Styles */}
      <style jsx global>{`
        .font-mono {
          font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
        }
        
        /* Force all receipt text to be SUPER BLACK for maximum visibility */
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
        
        /* Make bold text even blacker */
        #receipt-to-print b,
        #receipt-to-print strong,
        #receipt-to-print .font-bold,
        #receipt-to-print [class*="font-bold"],
        #receipt-to-print [class*="font-extrabold"] {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-fill-color: #000000 !important;
          font-weight: 900 !important;
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        
        /* Ensure borders are also super black */
        #receipt-to-print .border-black,
        #receipt-to-print [class*="border"] {
          border-color: #000000 !important;
        }
        
        /* Force all spans and text elements to be super black */
        #receipt-to-print span,
        #receipt-to-print p,
        #receipt-to-print div {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-fill-color: #000000 !important;
        }
      `}</style>
    </div>
  );
}

