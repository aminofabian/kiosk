"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface SupplyShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function SupplyShell({
  title,
  subtitle,
  backHref = "/department/supply",
  backLabel = "Back",
  action,
  footer,
  children,
}: SupplyShellProps) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f4f7f4] dark:bg-[#0e1810] text-slate-900 dark:text-slate-100">
      <header className="shrink-0 safe-area-top bg-white/95 dark:bg-[#152214]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2 px-3 h-14 max-w-2xl mx-auto w-full">
          <Link
            href={backHref}
            className="pos-icon-btn flex-shrink-0"
            aria-label={backLabel}
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-bold truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="max-w-2xl mx-auto w-full px-3 py-4 pb-6">{children}</div>
      </main>

      {footer && (
        <footer className="shrink-0 safe-area-bottom border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#152214]/95 backdrop-blur-xl px-3 py-3">
          <div className="max-w-2xl mx-auto w-full">{footer}</div>
        </footer>
      )}
    </div>
  );
}
