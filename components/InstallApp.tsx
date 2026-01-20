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
import { Download, X, Smartphone, Share2 } from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isFirefox, setIsFirefox] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useCurrentUser();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    const detectBrowser = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(userAgent);
      const isFirefoxBrowser = /firefox/i.test(userAgent);
      
      setIsIOS(isIOSDevice);
      setIsSafari(isSafariBrowser && !isIOSDevice);
      setIsFirefox(isFirefoxBrowser);
    };

    checkIfInstalled();
    detectBrowser();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show button for all browsers after a short delay (to allow Chrome to set deferredPrompt)
    // This ensures the button shows even if beforeinstallprompt doesn't fire
    const timer = setTimeout(() => {
      if (!isInstalled) {
        setShowInstallButton(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    // If we have deferredPrompt (Chrome/Edge), use it
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShowInstallButton(false);
        }
        
        setDeferredPrompt(null);
        return;
      } catch (error) {
        console.error('Error showing install prompt:', error);
      }
    }
    
    // For other browsers, show instructions drawer
    setDrawerOpen(true);
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
    setDeferredPrompt(null);
  };

  if (isInstalled || !showInstallButton) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              Install {user?.businessName || 'POS'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Add to your home screen for quick access
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen">
          <DrawerHeader className="border-b bg-[#259783]/10 dark:bg-[#259783]/20">
            <DrawerTitle className="text-xl flex items-center gap-2 text-slate-900 dark:text-white">
              <Smartphone className="w-5 h-5 text-[#259783]" />
              {isIOS ? 'Install on iOS' : 'Install App'}
            </DrawerTitle>
            <DrawerDescription>
              {isIOS
                ? `Follow these steps to add ${user?.businessName || 'POS'} to your home screen:`
                : isSafari
                ? `Follow these steps to add ${user?.businessName || 'POS'} to your home screen on Safari:`
                : isFirefox
                ? `Follow these steps to add ${user?.businessName || 'POS'} to your home screen on Firefox:`
                : 'Follow these steps to install the app:'}
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
            ) : isSafari ? (
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Click the Share button</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Look for the <Share2 className="inline w-3 h-3" /> icon in the Safari toolbar
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Select "Add to Dock" or "Add to Home Screen"</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Choose the option that appears in the share menu
                    </p>
                  </div>
                </div>
              </div>
            ) : isFirefox ? (
              <div className="space-y-4 py-4">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Click the menu button (☰)</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Located in the top-right corner of Firefox
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center font-bold text-[#259783]">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 dark:text-white">Select "Install" or "Add to Home Screen"</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      If available, this option will appear in the menu
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Firefox on desktop may not support PWA installation. For the best experience, use Chrome, Edge, or Safari.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Installation instructions vary by browser. For the best experience:
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    <strong>Chrome/Edge:</strong> Click the install button above or look for the install icon in the address bar
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    <strong>Safari (iOS):</strong> Tap Share → Add to Home Screen
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    <strong>Safari (Mac):</strong> Click Share → Add to Dock
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#259783]"></span>
                    <strong>Firefox:</strong> Look for the install option in the menu
                  </li>
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <Button onClick={() => setDrawerOpen(false)} variant="outline" className="flex-1">
                Close
              </Button>
              {!isIOS && !isSafari && !isFirefox && deferredPrompt && (
                <Button
                  onClick={async () => {
                    try {
                      await deferredPrompt.prompt();
                      const { outcome } = await deferredPrompt.userChoice;
                      if (outcome === 'accepted') {
                        setShowInstallButton(false);
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
