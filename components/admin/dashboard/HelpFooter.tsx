"use client";

import { MessageCircle } from "lucide-react";
import { openSupportChat } from "@/lib/support-chat";

interface HelpFooterProps {
  isCashier: boolean;
}

export function HelpFooter({ isCashier }: HelpFooterProps) {
  if (isCashier) return null;

  return (
    <div className="w-full max-w-5xl pt-2 pb-4 text-center">
      <button
        type="button"
        onClick={() => openSupportChat()}
        className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-[#1c6a1e] dark:hover:text-[#2a8a30] transition-colors inline-flex items-center gap-1.5"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Need help? Chat with support
      </button>
    </div>
  );
}
