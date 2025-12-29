'use client';

import { Suspense, useEffect, useState } from 'react';
import { PINLogin } from '@/components/pos/PINLogin';
import { Loader2 } from 'lucide-react';

const DEFAULT_DOMAIN = 'kiosk.co.ke';
const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];

function isPublicDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === DEFAULT_DOMAIN || LOCALHOST_DOMAINS.includes(lower);
}

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

import { getUserRole } from '@/lib/utils/user-role-storage';

function POSLoginContent() {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isKioskDomain, setIsKioskDomain] = useState(false);

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const hostname = window.location.hostname.toLowerCase();
        const publicDomain = isPublicDomain(hostname);
        const kioskDomain = !publicDomain;
        setIsPublic(publicDomain);
        setIsKioskDomain(kioskDomain);

        // If this is a public domain, redirect to regular login
        // PIN login should only be shown on kiosk/business-specific domains
        if (publicDomain) {
          window.location.href = '/login';
          return;
        }

        // Check if user role is stored and if they're not a cashier, redirect to regular login
        // PIN login should only be shown to cashiers
        const storedRole = getUserRole();
        if (storedRole && storedRole !== 'cashier') {
          window.location.href = '/login';
          return;
        }

        let domainToResolve = hostname;

        const portIndex = domainToResolve.indexOf(':');
        if (portIndex > -1) {
          domainToResolve = domainToResolve.substring(0, portIndex);
        }

        const response = await fetch(`/api/domain/resolve?domain=${encodeURIComponent(domainToResolve)}`);
        const result = await response.json();

        if (result.success && result.data) {
          setBusiness({
            id: result.data.businessId,
            name: result.data.businessName,
          });
        } else {
          setError('Business not found for this domain');
        }
      } catch {
        setError('Failed to load business');
      } finally {
        setIsLoading(false);
      }
    };

    loadBusiness();
  }, []);

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

  // Only show PIN login on kiosk domains (business-specific domains)
  if (!isKioskDomain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Redirecting to login...
          </h1>
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
