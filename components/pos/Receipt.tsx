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
    <div id="receipt-to-print" className="receipt-print-container p-4 print:p-0 flex justify-center bg-gray-50 print:bg-white">
      <div className="w-full max-w-[80mm] bg-white print:max-w-none print:w-[80mm] shadow-lg print:shadow-none rounded-lg print:rounded-none overflow-hidden font-mono text-black">
        {/* Receipt Container */}
        <div className="px-3 py-4 print:px-2 print:py-3 text-base print:text-[14px] leading-relaxed text-black">
          {/* Header (text-only, no logo for clear thermal printing) */}
          <div className="text-center mb-3 print:mb-2 text-black">
            <p className="text-xl print:text-lg font-extrabold tracking-[0.15em] mb-0.5 text-black">
              {sale.business_name || "FnM's"}
            </p>
            <p className="text-sm print:text-[13px] tracking-wide mb-1 text-black">
              Fresh and More
            </p>
            <p className="text-base print:text-[14px] mb-2 print:mb-1 text-black">
              Thank you for your purchase!
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Receipt Info */}
          <div className="space-y-1 mb-2 print:mb-1.5 text-base print:text-[14px] text-black">
            <div className="flex justify-between">
              <span className="text-black">Receipt #:</span>
              <span className="font-bold text-black">{sale.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Date:</span>
              <span className="text-black">{formatDateShort(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Time:</span>
              <span className="text-black">{formatTime(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Payment:</span>
              <span className="uppercase font-bold text-black">{sale.payment_method}</span>
            </div>
            {sale.user_name && (
              <div className="flex justify-between">
                <span className="text-black">Served by:</span>
                <span className="font-bold text-black">{sale.user_name}</span>
              </div>
            )}
            {sale.customer_name && (
              <div className="flex justify-between">
                <span className="text-black">Customer:</span>
                <span className="text-black">{sale.customer_name}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Items Header */}
          <div className="text-base print:text-[14px] font-bold mb-1 print:mb-0.5 text-black">
            <div className="grid grid-cols-12">
              <div className="col-span-6 text-black">ITEM</div>
              <div className="col-span-2 text-right text-black">QTY</div>
              <div className="col-span-2 text-right text-black">PRICE</div>
              <div className="col-span-2 text-right text-black">TOTAL</div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-1 print:my-0.5"></div>

          {/* Items List */}
          <div className="space-y-1.5 mb-2 print:mb-1.5">
            {items.map((item) => {
              const itemTotal = item.quantity_sold * item.sell_price_per_unit;
              return (
                <div key={item.id} className="text-base print:text-[14px] text-black">
                  <div className="grid grid-cols-12">
                    <div className="col-span-6 leading-relaxed text-black">
                      {item.item_name}
                    </div>
                    <div className="col-span-2 text-right text-black">
                      {item.quantity_sold}
                    </div>
                    <div className="col-span-2 text-right text-black">
                      {formatPrice(item.sell_price_per_unit)}
                    </div>
                    <div className="col-span-2 text-right font-bold text-black">
                      {formatPrice(itemTotal)}
                    </div>
                  </div>
                  {item.item_unit_type && (
                    <div className="text-sm print:text-[12px] ml-0 mt-0.5 text-black">
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
          <div className="space-y-1.5 mb-2 print:mb-1.5">
            <div className="flex justify-between text-base print:text-[14px] text-black">
              <span className="text-black">SUBTOTAL:</span>
              <span className="font-bold text-black">KES {formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg print:text-base border-t-2 border-black pt-1.5 print:pt-1 mt-1.5 print:mt-1">
              <span className="font-bold uppercase text-black">TOTAL:</span>
              <span className="font-bold text-black">KES {formatPrice(sale.total_amount)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black my-2 print:my-1"></div>

          {/* Footer */}
          <div className="text-center space-y-1 text-base print:text-[14px] text-black">
            <p className="font-bold mb-1 print:mb-0.5 text-black">Thank you for shopping with us!</p>
            
            {/* Contact Information */}
            <div className="space-y-1 mt-2 print:mt-1.5 pt-2 print:pt-1 border-t-2 border-black text-black">
              <p className="font-bold text-black">Get in Touch</p>
              <p className="text-black">www.fnms.co.ke</p>
              <p className="text-black">Tel: 0721 530 181</p>
              <p className="text-black">Email: support@fnms.co.ke</p>
            </div>

            {/* Additional Info */}
            <div className="mt-2 print:mt-1.5 space-y-1 text-black">
              <p className="text-sm print:text-[13px] text-black">
                Quality Products • Best Prices • Great Service
              </p>
              <p className="font-bold text-black">
                We appreciate your business!
              </p>
            </div>

            <p className="mt-2 print:mt-1.5 text-sm print:text-[13px] text-black">
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
      `}</style>
    </div>
  );
}

