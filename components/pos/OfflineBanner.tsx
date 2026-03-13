'use client';

import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium">
      <WifiOff className="h-4 w-4" />
      <span>Offline mode — sales will sync when connection is restored</span>
    </div>
  );
}
