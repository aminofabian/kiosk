'use client';
import type { Sale, SaleItem } from '@/lib/db/types';

interface ReceiptProps {
  sale: Sale & { business_name?: string; user_name?: string | null };
  items: (SaleItem & { item_name: string; item_unit_type: string })[];
}

export function Receipt({ sale, items }: ReceiptProps) {
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
    <div id="receipt-to-print" className="receipt-print-container p-4 print:p-0 flex justify-center bg-gray-50 print:bg-white" style={{ color: '#000000', WebkitTextFillColor: '#000000' } as React.CSSProperties}>
      <div className="w-full max-w-[80mm] bg-white print:max-w-none print:w-[80mm] shadow-lg print:shadow-none rounded-lg print:rounded-none overflow-hidden font-mono text-black" style={{ color: '#000000', WebkitTextFillColor: '#000000' } as React.CSSProperties}>
        {/* Receipt Container */}
        <div className="px-3 py-4 print:px-2 print:py-3 text-base print:text-[14px] leading-relaxed text-black" style={{ color: '#000000', WebkitTextFillColor: '#000000', WebkitFontSmoothing: 'none', MozOsxFontSmoothing: 'grayscale' } as React.CSSProperties}>
          {/* Header (text-only, no logo for clear thermal printing) */}
          <div className="text-center mb-3 print:mb-2 text-black" style={{ color: '#000000' }}>
            <p className="text-xl print:text-lg font-extrabold tracking-[0.15em] mb-0.5 text-black" style={{ color: '#000000' }}>
              {sale.business_name || "FnM's"}
            </p>
            <p className="text-sm print:text-[13px] tracking-wide mb-1 text-black" style={{ color: '#000000' }}>
              Fresh and More
            </p>
            <p className="text-base print:text-[14px] mb-2 print:mb-1 text-black" style={{ color: '#000000' }}>
              Thank you for your purchase!
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Receipt Info */}
          <div className="space-y-1 mb-2 print:mb-1.5 text-base print:text-[14px] text-black" style={{ color: '#000000' }}>
            <div className="flex justify-between" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>Receipt #:</span>
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
            {sale.user_name && (
              <div className="flex justify-between" style={{ color: '#000000' }}>
                <span className="text-black" style={{ color: '#000000' }}>Served by:</span>
                <span className="font-bold text-black" style={{ color: '#000000' }}>{sale.user_name}</span>
              </div>
            )}
            {sale.customer_name && (
              <div className="flex justify-between" style={{ color: '#000000' }}>
                <span className="text-black" style={{ color: '#000000' }}>Customer:</span>
                <span className="text-black" style={{ color: '#000000' }}>{sale.customer_name}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Items Header */}
          <div className="text-base print:text-[14px] font-bold mb-1 print:mb-0.5 text-black" style={{ color: '#000000' }}>
            <div className="grid grid-cols-12" style={{ color: '#000000' }}>
              <div className="col-span-6 text-black" style={{ color: '#000000' }}>ITEM</div>
              <div className="col-span-2 text-right text-black" style={{ color: '#000000' }}>QTY</div>
              <div className="col-span-2 text-right text-black" style={{ color: '#000000' }}>PRICE</div>
              <div className="col-span-2 text-right text-black" style={{ color: '#000000' }}>TOTAL</div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-1 print:my-0.5"></div>

          {/* Items List */}
          <div className="space-y-1.5 mb-2 print:mb-1.5" style={{ color: '#000000' }}>
            {items.map((item) => {
              const itemTotal = item.quantity_sold * item.sell_price_per_unit;
              return (
                <div key={item.id} className="text-base print:text-[14px] text-black" style={{ color: '#000000' }}>
                  <div className="grid grid-cols-12" style={{ color: '#000000' }}>
                    <div className="col-span-6 leading-relaxed text-black" style={{ color: '#000000' }}>
                      {item.item_name}
                    </div>
                    <div className="col-span-2 text-right text-black" style={{ color: '#000000' }}>
                      {item.quantity_sold}
                    </div>
                    <div className="col-span-2 text-right text-black" style={{ color: '#000000' }}>
                      {formatPrice(item.sell_price_per_unit)}
                    </div>
                    <div className="col-span-2 text-right font-bold text-black" style={{ color: '#000000' }}>
                      {formatPrice(itemTotal)}
                    </div>
                  </div>
                  {item.item_unit_type && (
                    <div className="text-sm print:text-[12px] ml-0 mt-0.5 text-black" style={{ color: '#000000' }}>
                      @ {formatPrice(item.sell_price_per_unit)}/{item.item_unit_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Totals */}
          <div className="space-y-1.5 mb-2 print:mb-1.5" style={{ color: '#000000' }}>
            <div className="flex justify-between text-base print:text-[14px] text-black" style={{ color: '#000000' }}>
              <span className="text-black" style={{ color: '#000000' }}>SUBTOTAL:</span>
              <span className="font-bold text-black" style={{ color: '#000000' }}>KES {formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg print:text-base border-t-2 border-black pt-1.5 print:pt-1 mt-1.5 print:mt-1" style={{ color: '#000000' }}>
              <span className="font-bold uppercase text-black" style={{ color: '#000000' }}>TOTAL:</span>
              <span className="font-bold text-black" style={{ color: '#000000' }}>KES {formatPrice(sale.total_amount)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Footer */}
          <div className="text-center space-y-1 text-base print:text-[14px] text-black" style={{ color: '#000000' }}>
            <p className="font-bold mb-1 print:mb-0.5 text-black" style={{ color: '#000000' }}>Thank you for shopping with us!</p>
            
            {/* Contact Information */}
            <div className="space-y-1 mt-2 print:mt-1.5 pt-2 print:pt-1 border-t-2 border-black text-black" style={{ color: '#000000' }}>
              <p className="font-bold text-black" style={{ color: '#000000' }}>Get in Touch</p>
              <p className="text-black" style={{ color: '#000000' }}>www.fnms.co.ke</p>
              <p className="text-black" style={{ color: '#000000' }}>Tel: 0721 530 181</p>
              <p className="text-black" style={{ color: '#000000' }}>Email: support@fnms.co.ke</p>
            </div>

            {/* Additional Info */}
            <div className="mt-2 print:mt-1.5 space-y-1 text-black" style={{ color: '#000000' }}>
              <p className="text-sm print:text-[13px] text-black" style={{ color: '#000000' }}>
                Quality Products • Best Prices • Great Service
              </p>
              <p className="font-bold text-black" style={{ color: '#000000' }}>
                We appreciate your business!
              </p>
            </div>

            <p className="mt-2 print:mt-1.5 text-sm print:text-[13px] text-black" style={{ color: '#000000' }}>
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

