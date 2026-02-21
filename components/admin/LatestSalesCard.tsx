'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Loader2 } from 'lucide-react';

interface LatestSaleItem {
  item_name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
  item_type_snapshot: string | null;
}

interface LatestSale {
  id: string;
  total_amount: number;
  sale_date: number;
  created_at: number;
  items: LatestSaleItem[];
}

interface LatestSalesCardProps {
  startTs: number;
  endTs: number;
  itemType?: string;
  accentColor?: 'green' | 'blue' | 'teal';
}

const formatPrice = (price: number) =>
  `KES ${Math.abs(price).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const accentStyles = {
  green: {
    icon: 'text-green-600',
    amount: 'text-green-600',
    dot: 'bg-green-500',
  },
  blue: {
    icon: 'text-blue-600',
    amount: 'text-blue-600',
    dot: 'bg-blue-500',
  },
  teal: {
    icon: 'text-[#1c6a1e]',
    amount: 'text-[#1c6a1e]',
    dot: 'bg-[#1c6a1e]',
  },
};

export function LatestSalesCard({
  startTs,
  endTs,
  itemType,
  accentColor = 'teal',
}: LatestSalesCardProps) {
  const [sales, setSales] = useState<LatestSale[]>([]);
  const [loading, setLoading] = useState(true);

  const style = accentStyles[accentColor];

  useEffect(() => {
    let cancelled = false;
    async function fetchLatest() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          start: String(startTs),
          end: String(endTs),
        });
        if (itemType) params.set('itemType', itemType);
        const res = await fetch(`/api/sales/latest?${params}`);
        const result = await res.json();
        if (result.success && result.data?.sales && !cancelled) {
          setSales(result.data.sales);
        }
      } catch {
        if (!cancelled) setSales([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLatest();
    return () => {
      cancelled = true;
    };
  }, [startTs, endTs, itemType]);

  return (
    <Card className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Receipt className={`w-4 h-4 ${style.icon}`} />
          Latest Sales
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sales.length === 0 ? (
          <p className="text-center text-slate-500 py-8 text-sm">No sales in this period</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
            {sales.map((sale) => (
              <div key={sale.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatTime(sale.sale_date)}
                      </span>
                      <span className={`text-sm font-black shrink-0 ${style.amount}`}>
                        {formatPrice(sale.total_amount)}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {sale.items.map((item, i) => (
                        <li
                          key={`${sale.id}-${i}`}
                          className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                        >
                          <span className={`w-1 h-1 rounded-full shrink-0 ${style.dot}`} />
                          <span className="truncate">
                            {item.item_name}
                            <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">
                              × {item.quantity_sold.toFixed(item.quantity_sold % 1 === 0 ? 0 : 1)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
