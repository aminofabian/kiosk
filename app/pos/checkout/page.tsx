'use client';

import { useState } from 'react';
import { POSLayout } from '@/components/layouts/pos-layout';
import { CheckoutForm } from '@/components/pos/CheckoutForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPage() {
  return (
    <POSLayout
      header={
        <div className="flex items-center justify-between">
          <Link href="/pos/cart">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back to Cart
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Checkout</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      }
    >
      <CheckoutForm />
    </POSLayout>
  );
}

