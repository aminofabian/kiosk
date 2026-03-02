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
  compact?: boolean;
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
  compact = false,
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
    <Card className={`bg-white dark:bg-slate-800 ${compact ? 'border border-slate-200 dark:border-slate-700' : 'border-2 border-slate-200 dark:border-slate-700'}`}>
      <CardHeader className={compact ? 'py-2 px-3 pb-1' : 'pb-3'}>
        <CardTitle className={`font-bold flex items-center gap-2 ${compact ? 'text-sm' : 'text-base'}`}>
          <Receipt className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${style.icon}`} />
          Latest Sales
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? 'pt-0 px-3 pb-3' : 'pt-0'}>
        {loading ? (
          <div className={`flex items-center justify-center ${compact ? 'py-6' : 'py-10'}`}>
            <Loader2 className={`animate-spin text-slate-400 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
          </div>
        ) : sales.length === 0 ? (
          <p className={`text-center text-slate-500 text-sm ${compact ? 'py-4' : 'py-8'}`}>No sales in this period</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
            {sales.slice(0, compact ? 5 : undefined).map((sale) => (
              <div key={sale.id} className={compact ? 'py-1.5 first:pt-0 last:pb-0' : 'py-3 first:pt-0 last:pb-0'}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-0.5' : 'mb-1.5'}`}>
                      <span className={`font-medium text-slate-500 dark:text-slate-400 tabular-nums ${compact ? 'text-[10px]' : 'text-xs'}`}>
                        {formatTime(sale.sale_date)}
                      </span>
                      <span className={`font-black shrink-0 ${style.amount} ${compact ? 'text-xs' : 'text-sm'}`}>
                        {formatPrice(sale.total_amount)}
                      </span>
                    </div>
                    <ul className={compact ? 'space-y-0' : 'space-y-0.5'}>
                      {sale.items.slice(0, compact ? 2 : undefined).map((item, i) => (
                        <li
                          key={`${sale.id}-${i}`}
                          className={`flex items-center gap-2 text-slate-600 dark:text-slate-300 ${compact ? 'text-[11px]' : 'text-xs'}`}
                        >
                          <span className={`rounded-full shrink-0 ${style.dot} ${compact ? 'w-1 h-1' : 'w-1 h-1'}`} />
                          <span className="truncate">
                            {item.item_name}
                            <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">
                              × {item.quantity_sold.toFixed(item.quantity_sold % 1 === 0 ? 0 : 1)}
                            </span>
                          </span>
                        </li>
                      ))}
                      {compact && sale.items.length > 2 && (
                        <li className="text-[10px] text-slate-400">+{sale.items.length - 2} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
            {compact && sales.length > 5 && (
              <p className="text-[10px] text-slate-400 pt-1">+{sales.length - 5} more sales</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
