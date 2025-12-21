'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Download, Smartphone, Share2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface DownloadButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  label?: string;
}

export function DownloadButton({ className, variant = 'default', size = 'default', label = 'Download App' }: DownloadButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      setDrawerOpen(true);
      return;
    }

    if (!deferredPrompt) {
      setDrawerOpen(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setDrawerOpen(false);
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      setDrawerOpen(true);
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
        {label}
      </Button>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen">
          <DrawerHeader className="border-b bg-[#259783]/10 dark:bg-[#259783]/20">
            <DrawerTitle className="text-xl flex items-center gap-2 text-slate-900 dark:text-white">
              <Smartphone className="w-5 h-5 text-[#259783]" />
              {isIOS ? 'Install on iOS' : 'Install App'}
            </DrawerTitle>
            <DrawerDescription>
              {isIOS
                ? 'Follow these steps to add Grocery POS to your home screen:'
                : 'Installation may not be available in this browser. Please use Chrome, Edge, or Safari on mobile devices.'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-6 pb-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
            {isIOS ? (
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Tap the Share button</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Look for the <Share2 className="inline w-3 h-3" /> icon at the bottom of your screen
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Select "Add to Home Screen"</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Scroll down in the share menu to find this option
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Tap "Add" to confirm</p>
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
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    Chrome or Edge on Android
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    Safari on iOS (see iOS instructions above)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    Chrome or Edge on desktop
                  </li>
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={() => setDrawerOpen(false)} variant="outline" className="flex-1">
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
                        setDrawerOpen(false);
                      }
                    } catch (error) {
                      console.error('Error showing install prompt:', error);
                    }
                  }}
                  className="flex-1 bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-md shadow-[#259783]/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Install Now
                </Button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
