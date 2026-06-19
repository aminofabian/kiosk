'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { getPostLoginPath } from '@/lib/utils/post-login-redirect';
import { storeUserRole } from '@/lib/utils/user-role-storage';
import { Loader2 } from 'lucide-react';

function ImpersonateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing access token');
      return;
    }

    let cancelled = false;

    (async () => {
      const result = await signIn('impersonate', { token, redirect: false });
      if (cancelled) return;

      if (result?.error) {
        setError('This access link is invalid or has expired');
        return;
      }

      const session = await getSession();
      const role = session?.user?.role;
      if (role) storeUserRole(role);
      router.replace(getPostLoginPath(role));
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="text-center max-w-md">
          <p className="text-red-400 font-medium">{error}</p>
          <p className="text-slate-500 text-sm mt-2">
            Go back to superadmin and try &quot;Open site&quot; again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p>Signing you in…</p>
      </div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      }
    >
      <ImpersonateContent />
    </Suspense>
  );
}
