'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { PaymentForm } from '@/components/admin/PaymentForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { CreditAccount } from '@/lib/db/types';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const creditAccountId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<CreditAccount | null>(null);

  useEffect(() => {
    async function fetchAccount() {
      try {
        setLoading(true);
        const response = await fetch(`/api/credits/${creditAccountId}`);
        const result = await response.json();

        if (result.success) {
          setAccount(result.data);
        } else {
          setError(result.message || 'Failed to load credit account');
        }
      } catch (err) {
        setError('Failed to load credit account');
        console.error('Error fetching account:', err);
      } finally {
        setLoading(false);
      }
    }

    if (creditAccountId) {
      fetchAccount();
    }
  }, [creditAccountId]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading account...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !account) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error || 'Account not found'}</p>
            <Button onClick={() => router.push('/admin/credits')} size="touch">
              Back to Credits
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/credits">
            <Button variant="ghost" size="touch" className="gap-2">
              <ArrowLeft className="h-5 w-5" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Collect Payment</h1>
        </div>
        <PaymentForm account={account} />
      </div>
    </AdminLayout>
  );
}

