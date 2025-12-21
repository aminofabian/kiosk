'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { BannerManager } from '@/components/admin/BannerManager';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

export default function BannersPage() {
  const { user } = useCurrentUser();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      setAuthorized(user.role === 'owner');
    }
  }, [user]);

  if (authorized === null) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-[#259783]" />
        </div>
      </AdminLayout>
    );
  }

  if (!authorized) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Access Denied
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Only business owners can manage banners.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#259783] flex items-center justify-center shadow-lg shadow-[#259783]/20">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  Banner Management
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Upload and manage storefront banners
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          <BannerManager />
        </div>
      </div>
    </AdminLayout>
  );
}
