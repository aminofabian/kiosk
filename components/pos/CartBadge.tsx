'use client';

import { useCartStore } from '@/lib/stores/cart-store';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export function CartBadge() {
  const { items, total } = useCartStore();

  if (items.length === 0) {
    return null;
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link href="/pos/cart">
      <div className="relative inline-flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
        <ShoppingCart className="h-6 w-6" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          <span className="text-xs text-muted-foreground">
            KES {total.toFixed(0)}
          </span>
        </div>
        <Badge variant="default" className="ml-1">
          {items.length}
        </Badge>
      </div>
    </Link>
  );
}

