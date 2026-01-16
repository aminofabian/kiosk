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
    <div className="p-4 print:p-0 flex justify-center">
      <div className="w-full max-w-[80mm] bg-white print:max-w-none print:w-[80mm]">
        {/* Receipt Container */}
        <div className="px-4 py-6 print:px-3 print:py-4">
          {/* Logo and Header */}
          <div className="text-center mb-4 print:mb-3">
            <div className="flex justify-center mb-3 print:mb-2">
              <Image
                src="/fruits/logo.png"
                alt="Logo"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-xl font-bold uppercase tracking-wide mb-1 print:text-lg">
              {sale.business_name || 'Grocery Store'}
            </h1>
            <div className="text-xs text-gray-600 print:text-[10px]">
              <p>Thank you for your purchase!</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-400 my-3 print:my-2"></div>

          {/* Receipt Info */}
          <div className="text-xs space-y-1 mb-3 print:text-[10px] print:mb-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Receipt #:</span>
              <span className="font-mono font-semibold">{sale.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span>{formatDateShort(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span>{formatTime(sale.sale_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment:</span>
              <span className="capitalize font-semibold">{sale.payment_method}</span>
            </div>
            {sale.user_name && (
              <div className="flex justify-between">
                <span className="text-gray-600">Served by:</span>
                <span className="font-semibold">{sale.user_name}</span>
              </div>
            )}
            {sale.customer_name && (
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span>{sale.customer_name}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-400 my-3 print:my-2"></div>

          {/* Items Header */}
          <div className="text-xs font-semibold mb-2 print:text-[10px] print:mb-1">
            <div className="grid grid-cols-12 gap-1">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-2 mb-3 print:space-y-1 print:mb-2">
            {items.map((item) => {
              const itemTotal = item.quantity_sold * item.sell_price_per_unit;
              return (
                <div key={item.id} className="text-xs print:text-[10px]">
                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6 font-medium leading-tight">
                      {item.item_name}
                    </div>
                    <div className="col-span-2 text-right text-gray-600">
                      {item.quantity_sold}
                    </div>
                    <div className="col-span-2 text-right text-gray-600">
                      {formatPrice(item.sell_price_per_unit)}
                    </div>
                    <div className="col-span-2 text-right font-semibold">
                      {formatPrice(itemTotal)}
                    </div>
                  </div>
                  {item.item_unit_type && (
                    <div className="text-[10px] text-gray-500 ml-0 print:text-[9px]">
                      @ {formatPrice(item.sell_price_per_unit)}/{item.item_unit_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-400 my-3 print:my-2"></div>

          {/* Totals */}
          <div className="space-y-1 mb-4 print:mb-3">
            <div className="flex justify-between text-sm print:text-xs">
              <span className="font-semibold">SUBTOTAL:</span>
              <span className="font-semibold">KES {formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg print:text-base border-t-2 border-gray-800 pt-2 print:pt-1 mt-2 print:mt-1">
              <span className="font-bold uppercase">Total:</span>
              <span className="font-bold">KES {formatPrice(sale.total_amount)}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-400 my-3 print:my-2"></div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-600 space-y-1 print:text-[10px]">
            <p className="font-semibold mb-2 print:mb-1">Thank you for shopping with us!</p>
            
            {/* Contact Information */}
            <div className="space-y-0.5 mt-3 print:mt-2 pt-2 print:pt-1 border-t border-dashed border-gray-300">
              <p className="font-semibold text-gray-700 mb-1 print:mb-0.5">Get in Touch</p>
              <p className="text-[10px] print:text-[9px] font-medium">www.fnms.co.ke</p>
              <p className="text-[10px] print:text-[9px]">Tel: 0721 530 181</p>
              <p className="text-[10px] print:text-[9px]">Email: support@fnms.co.ke</p>
            </div>

            {/* Additional Info */}
            <div className="mt-2 print:mt-1 space-y-0.5">
              <p className="text-[10px] print:text-[9px] italic text-gray-500">
                Quality Products • Best Prices • Great Service
              </p>
              <p className="text-[10px] print:text-[9px]">
                We appreciate your business!
              </p>
            </div>

            <p className="mt-2 print:mt-1 text-[10px] print:text-[9px] opacity-75">
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
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

