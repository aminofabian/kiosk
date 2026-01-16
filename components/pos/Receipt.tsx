'use client';

import Image from 'next/image';
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
    <div className="p-4 print:p-0 flex justify-center bg-gray-50 print:bg-white">
      <div className="w-full max-w-[80mm] bg-white print:max-w-none print:w-[80mm] shadow-lg print:shadow-none rounded-lg print:rounded-none overflow-hidden font-mono">
        {/* Receipt Container */}
        <div className="px-3 py-4 print:px-2 print:py-3 text-[11px] print:text-[10px] leading-tight">
          {/* Logo and Header */}
          <div className="text-center mb-3 print:mb-2">
            <div className="flex justify-center mb-1 print:mb-0.5">
              <Image
                src="/fruits/logo.png"
                alt="FnM's Logo"
                width={120}
                height={120}
                className="object-contain"
                priority
              />
            </div>
            <p className="text-xs font-bold mb-1 print:text-[10px]">
              Fresh n More
            </p>
            <p className="text-[10px] print:text-[9px] mb-2 print:mb-1">
              Thank you for your purchase!
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-black my-2 print:my-1"></div>

          {/* Receipt Info */}
          <div className="space-y-0.5 mb-2 print:mb-1.5 text-[10px] print:text-[9px]">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{sale.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{formatDateShort(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span>{formatTime(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment:</span>
              <span className="uppercase font-bold">{sale.payment_method}</span>
            </div>
            {sale.user_name && (
              <div className="flex justify-between">
                <span>Served by:</span>
                <span className="font-bold">{sale.user_name}</span>
              </div>
            )}
            {sale.customer_name && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{sale.customer_name}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-black my-2 print:my-1"></div>

          {/* Items Header */}
          <div className="text-[10px] print:text-[9px] font-bold mb-1 print:mb-0.5">
            <div className="grid grid-cols-12">
              <div className="col-span-6">ITEM</div>
              <div className="col-span-2 text-right">QTY</div>
              <div className="col-span-2 text-right">PRICE</div>
              <div className="col-span-2 text-right">TOTAL</div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black my-1 print:my-0.5"></div>

          {/* Items List */}
          <div className="space-y-1 mb-2 print:mb-1.5">
            {items.map((item) => {
              const itemTotal = item.quantity_sold * item.sell_price_per_unit;
              return (
                <div key={item.id} className="text-[10px] print:text-[9px]">
                  <div className="grid grid-cols-12">
                    <div className="col-span-6 leading-tight">
                      {item.item_name}
                    </div>
                    <div className="col-span-2 text-right">
                      {item.quantity_sold}
                    </div>
                    <div className="col-span-2 text-right">
                      {formatPrice(item.sell_price_per_unit)}
                    </div>
                    <div className="col-span-2 text-right font-bold">
                      {formatPrice(itemTotal)}
                    </div>
                  </div>
                  {item.item_unit_type && (
                    <div className="text-[9px] print:text-[8px] ml-0 mt-0">
                      @ {formatPrice(item.sell_price_per_unit)}/{item.item_unit_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-black my-2 print:my-1"></div>

          {/* Totals */}
          <div className="space-y-1 mb-2 print:mb-1.5">
            <div className="flex justify-between text-[10px] print:text-[9px]">
              <span>SUBTOTAL:</span>
              <span className="font-bold">KES {formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm print:text-xs border-t border-black pt-1 print:pt-0.5 mt-1 print:mt-0.5">
              <span className="font-bold uppercase">TOTAL:</span>
              <span className="font-bold">KES {formatPrice(sale.total_amount)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black my-2 print:my-1"></div>

          {/* Footer */}
          <div className="text-center space-y-0.5 text-[10px] print:text-[9px]">
            <p className="font-bold mb-1 print:mb-0.5">Thank you for shopping with us!</p>
            
            {/* Contact Information */}
            <div className="space-y-0.5 mt-2 print:mt-1.5 pt-2 print:pt-1 border-t border-black">
              <p className="font-bold">Get in Touch</p>
              <p>www.fnms.co.ke</p>
              <p>Tel: 0721 530 181</p>
              <p>Email: support@fnms.co.ke</p>
            </div>

            {/* Additional Info */}
            <div className="mt-2 print:mt-1.5 space-y-0.5">
              <p className="text-[9px] print:text-[8px]">
                Quality Products • Best Prices • Great Service
              </p>
              <p className="font-bold">
                We appreciate your business!
              </p>
            </div>

            <p className="mt-2 print:mt-1.5 text-[9px] print:text-[8px]">
              {formatDate(sale.sale_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
        .font-mono {
          font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
        }
      `}</style>
    </div>
  );
}

