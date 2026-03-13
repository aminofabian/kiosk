'use client';

import { useState } from 'react';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { preloadOfflineData } from '@/lib/offline/sync';
import { getLastSyncAt } from '@/lib/offline/cache';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

function formatLastSync(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function SyncForOfflineButton() {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    getLastSyncAt().then((ts) => ts && setLastSync(ts));
  }, [syncing]);

  const handleSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      const result = await preloadOfflineData();
      if (result.success) {
        setLastSync(Date.now());
        toast.success(
          `Synced for offline: ${result.categories ?? 0} categories, ${result.items ?? 0} items`
        );
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (!isOnline) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="gap-1.5 text-xs"
      title="Download all products for offline use"
    >
      {syncing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      <span>{syncing ? 'Syncing...' : 'Sync for offline'}</span>
      {lastSync && !syncing && (
        <span className="text-muted-foreground font-normal">({formatLastSync(lastSync)})</span>
      )}
    </Button>
  );
}
