'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { user } = useCurrentUser();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia(
        '(display-mode: standalone)'
      ).matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkIfInstalled();

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Fallback: show the banner after a short delay even
    // if beforeinstallprompt never fires (Safari, Firefox, etc.)
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
    // Chrome / Edge and other browsers that support beforeinstallprompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
          setShowInstallButton(false);
        }
      } catch (error) {
        console.error('Error showing install prompt:', error);
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    // Other browsers: show a small inline hint instead of a big drawer
    setShowInstructions(true);
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
    setDeferredPrompt(null);
  };

  if (isInstalled || !showInstallButton) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              Install {user?.businessName || 'POS'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Add to your home screen for quick access.
            </p>
            {showInstructions && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Your browser doesn&apos;t support one-click install. Use your
                browser menu and choose{' '}
                <span className="font-semibold">
                  &quot;Install app&quot; / &quot;Add to Home Screen&quot;
                </span>{' '}
                to add this app.
              </p>
            )}
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
    </div>
  );
}
