'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { POSLayout } from '@/components/layouts/pos-layout';
import { ShiftCloseForm } from '@/components/pos/ShiftCloseForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Shift } from '@/lib/db/types';

export default function ShiftClosePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);

  useEffect(() => {
    async function fetchShift() {
      try {
        setLoading(true);
        const response = await fetch('/api/shifts/current');
        const result = await response.json();

        if (result.success && result.data) {
          setShift(result.data);
        } else {
          setError('No open shift found');
        }
      } catch (err) {
        setError('Failed to load shift');
        console.error('Error fetching shift:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchShift();
  }, []);

  if (loading) {
    return (
      <POSLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading shift...</p>
          </div>
        </div>
      </POSLayout>
    );
  }

  if (error || !shift) {
    return (
      <POSLayout>
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error || 'No open shift found'}</p>
            <Button onClick={() => router.push('/pos')} size="touch">
              Back to POS
            </Button>
          </div>
        </div>
      </POSLayout>
    );
  }

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
          <h1 className="text-xl font-bold">Close Shift</h1>
          <div className="w-24" />
        </div>
      }
    >
      <ShiftCloseForm shift={shift} />
    </POSLayout>
  );
}

