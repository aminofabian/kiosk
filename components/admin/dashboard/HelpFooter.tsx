"use client";

import { HelpCircle } from "lucide-react";

interface HelpFooterProps {
  isCashier: boolean;
  onOpenGuide: () => void;
}

export function HelpFooter({ isCashier, onOpenGuide }: HelpFooterProps) {
  if (isCashier) return null;

  return (
    <div className="w-full max-w-5xl pt-2 pb-4 text-center">
      <button
        type="button"
        onClick={onOpenGuide}
        className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] transition-colors inline-flex items-center gap-1.5"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Need help? View guide
      </button>
    </div>
  );
}
