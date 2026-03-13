'use client';

import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f8f6] dark:bg-[#0f1a0d] p-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900 border-2 border-amber-300 dark:border-amber-700 rounded-full flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">You&apos;re offline</h1>
        <p className="text-slate-600 dark:text-slate-400">
          This page wasn&apos;t cached. Please check your connection and try again.
        </p>
        <Link
          href="/pos"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1c6a1e] text-white font-medium hover:bg-[#155a12] transition-colors"
        >
          Go to POS
        </Link>
      </div>
    </div>
  );
}
