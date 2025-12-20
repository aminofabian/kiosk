'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Sale, SaleItem } from '@/lib/db/types';

interface ReceiptProps {
  sale: Sale & { business_name?: string };
  items: (SaleItem & { item_name: string; item_unit_type: string })[];
}

export function Receipt({ sale, items }: ReceiptProps) {
  const formatPrice = (price: number) => {
    return `KES ${price.toFixed(0)}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 print:p-0">
      <div className="max-w-md mx-auto bg-white print:shadow-none">
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-6 print:p-4">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">
                {sale.business_name || 'Demo Grocery Store'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Thank you for your purchase!
              </p>
            </div>

            <Separator className="my-4" />

            {/* Sale Info */}
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sale ID:</span>
                <span className="font-mono text-xs">{sale.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{formatDate(sale.sale_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment:</span>
                <span className="capitalize">{sale.payment_method}</span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Items */}
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.quantity_sold} {item.item_unit_type} ×{' '}
                      {formatPrice(item.sell_price_per_unit)}
                    </div>
                  </div>
                  <div className="font-semibold">
                    {formatPrice(item.quantity_sold * item.sell_price_per_unit)}
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Total */}
            <div className="flex justify-between items-center text-lg font-bold mb-6">
              <span>Total:</span>
              <span className="text-2xl text-[#4bee2b]">
                {formatPrice(sale.total_amount)}
              </span>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground pt-4 border-t">
              <p>This is a demo receipt</p>
              <p className="mt-1">Have a great day!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

