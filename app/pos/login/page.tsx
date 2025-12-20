'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PINLogin } from '@/components/pos/PINLogin';
import { Loader2 } from 'lucide-react';

interface BusinessInfo {
  id: string;
  name: string;
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );
}

function POSLoginContent() {
  const searchParams = useSearchParams();
  const businessIdParam = searchParams.get('business');
  
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBusiness = async () => {
      const storedBusinessId = localStorage.getItem('pos_business_id');
      const businessId = businessIdParam || storedBusinessId;

      if (!businessId) {
        setError('No business selected. Please sign in with email first.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/businesses/${businessId}`);
        const result = await response.json();

        if (result.success && result.data) {
          setBusiness({
            id: result.data.id,
            name: result.data.name,
          });
          localStorage.setItem('pos_business_id', result.data.id);
        } else {
          setError('Business not found');
        }
      } catch {
        setError('Failed to load business');
      } finally {
        setIsLoading(false);
      }
    };

    loadBusiness();
  }, [businessIdParam]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            {error || 'Business not found'}
          </h1>
          <p className="text-slate-600 mb-4">
            Please sign in with your email to continue.
          </p>
          <a
            href="/login"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">🛒 Quick Login</h1>
        </div>
        <PINLogin businessId={business.id} businessName={business.name} />
      </div>
    </div>
  );
}

export default function POSLoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <POSLoginContent />
    </Suspense>
  );
}
