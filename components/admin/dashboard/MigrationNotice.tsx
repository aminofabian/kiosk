"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "kiosk-migration-notice-dismissed";
const NEW_SITE_URL = "https://kiosk.ke";

export function MigrationNotice() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage failures
    }
    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="w-full rounded-xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 p-4 sm:p-5 relative overflow-hidden">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-amber-600/70 hover:text-amber-800 hover:bg-amber-100/80 dark:text-amber-400/70 dark:hover:text-amber-200 dark:hover:bg-amber-900/40 transition-colors"
        aria-label="Dismiss notice"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 sm:gap-4 pr-6">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Hello — we&apos;re moving to kiosk.ke
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              We&apos;re migrating from{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                kiosk.co.ke
              </span>{" "}
              to{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                kiosk.ke
              </span>
              . Please sign up on the new site so your business is ready.
              This version will be closing soon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              asChild
              size="sm"
              className="h-8 text-xs bg-[#1c6a1e] hover:bg-[#165a18] text-white"
            >
              <a
                href={NEW_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Sign up at kiosk.ke
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </Button>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
              Act soon — this site is shutting down
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
