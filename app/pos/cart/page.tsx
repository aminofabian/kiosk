'use client';

import { POSLayout } from '@/components/layouts/pos-layout';
import { CartView } from '@/components/pos/CartView';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
  return (
    <POSLayout
      header={
        <div className="flex items-center justify-between">
          <Link href="/pos">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back to POS
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Shopping Cart</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      }
    >
      <CartView />
    </POSLayout>
  );
}

