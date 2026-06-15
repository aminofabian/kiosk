'use client';

import { ReactNode, useEffect } from 'react';
import { OfflineBanner } from '@/components/pos/OfflineBanner';
import { SyncOnReconnect } from '@/components/pos/SyncOnReconnect';
import { SyncForOfflineButton } from '@/components/pos/SyncForOfflineButton';
import { preloadOfflineData } from '@/lib/offline/sync';

interface POSLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  /** Fit parent flex area instead of viewport (e.g. above a bottom nav). */
  fillParent?: boolean;
}

export function POSLayout({ children, header, fillParent }: POSLayoutProps) {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      preloadOfflineData().catch((err) => console.error('preloadOfflineData:', err));
    }
  }, []);

  return (
    <div
      className={`relative flex flex-col bg-[#f6f8f6] dark:bg-[#0f1a0d] ${
        fillParent ? 'h-full w-full' : 'h-screen w-screen'
      }`}
    >
      <SyncOnReconnect />
      <OfflineBanner />
      <div className="absolute top-2 right-2 z-10 flex">
        <SyncForOfflineButton />
      </div>
      {header && (
        <header className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1c2e18] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {header}
        </header>
      )}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
