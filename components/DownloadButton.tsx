'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Smartphone, Share2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface DownloadButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function DownloadButton({ className, variant = 'default', size = 'default' }: DownloadButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);
    };

    checkIfInstalled();
    checkIOS();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setDialogOpen(true);
      return;
    }

    if (!deferredPrompt) {
      setDialogOpen(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setDialogOpen(false);
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      setDialogOpen(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        variant={variant}
        size={size}
        className={className}
      >
        <Download className="w-4 h-4 mr-2" />
        Download App
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              {isIOS ? 'Install on iOS' : 'Install App'}
            </DialogTitle>
            <DialogDescription>
              {isIOS
                ? 'Follow these steps to add Grocery POS to your home screen:'
                : 'Installation may not be available in this browser. Please use Chrome, Edge, or Safari on mobile devices.'}
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-300">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Tap the Share button</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Look for the <Share2 className="inline w-3 h-3" /> icon at the bottom of your screen
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-300">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Select "Add to Home Screen"</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Scroll down in the share menu to find this option
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-300">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Tap "Add" to confirm</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    The app icon will appear on your home screen
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                For the best experience, please use:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Chrome or Edge on Android
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Safari on iOS (see iOS instructions above)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Chrome or Edge on desktop
                </li>
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Close
            </Button>
            {!isIOS && deferredPrompt && (
              <Button
                onClick={async () => {
                  try {
                    await deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                      setDeferredPrompt(null);
                      setDialogOpen(false);
                    }
                  } catch (error) {
                    console.error('Error showing install prompt:', error);
                  }
                }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
