'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { POSLayout } from '@/components/layouts/pos-layout';
import { ShiftOpenForm } from '@/components/pos/ShiftOpenForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ShiftOpenPage() {
  return (
    <POSLayout
      header={
        <div className="flex items-center justify-between">
          <Link href="/pos">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Open Shift</h1>
          <div className="w-24" />
        </div>
      }
    >
      <ShiftOpenForm />
    </POSLayout>
  );
}

