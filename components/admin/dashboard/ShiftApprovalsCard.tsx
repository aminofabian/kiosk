"use client";

import { useEffect, useState } from "react";
import { Banknote, ChevronRight, Loader2 } from "lucide-react";

interface ShiftApprovalsCardProps {
  isAdminOrOwner: boolean;
  onOpen: () => void;
}

export function ShiftApprovalsCard({
  isAdminOrOwner,
  onOpen,
}: ShiftApprovalsCardProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdminOrOwner) {
      setLoading(false);
      return;
    }

    const load = () => {
      fetch("/api/balance/approvals?status=pending", { cache: "no-store" })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && Array.isArray(result.data)) {
            setPendingCount(result.data.length);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };

    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [isAdminOrOwner]);

  if (!isAdminOrOwner) return null;

  const hasPending = pendingCount > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full overflow-hidden rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-left transition-all active:scale-[0.99] ${
        hasPending
          ? "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35"
          : "bg-white dark:bg-[#1c2e18] border border-slate-200/80 dark:border-slate-700/60 hover:border-[#1c6a1e]/40 hover:shadow-sm"
      }`}
    >
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${
            hasPending
              ? "bg-white/20"
              : "bg-[#1c6a1e]/10"
          }`}
        >
          {loading ? (
            <Loader2
              className={`w-5 h-5 animate-spin ${
                hasPending ? "text-white" : "text-[#1c6a1e]"
              }`}
            />
          ) : (
            <Banknote
              className={`w-5 h-5 ${
                hasPending ? "text-white" : "text-[#1c6a1e]"
              }`}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2
              className={`text-sm sm:text-base font-bold leading-tight ${
                hasPending
                  ? "text-white"
                  : "text-slate-900 dark:text-white"
              }`}
            >
              {hasPending ? "Approve shifts" : "Shift approvals"}
            </h2>
            {hasPending && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-amber-700 text-[11px] font-bold flex items-center justify-center">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </div>
          <p
            className={`text-[11px] sm:text-xs mt-0.5 leading-tight ${
              hasPending
                ? "text-white/85"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {hasPending
              ? `${pendingCount} cashier balance request${pendingCount !== 1 ? "s" : ""} waiting`
              : "Review opening & closing balance requests"}
          </p>
        </div>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            hasPending
              ? "bg-white/15 group-hover:bg-white/25"
              : "bg-slate-100 dark:bg-slate-800 group-hover:bg-[#1c6a1e]/10"
          }`}
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              hasPending
                ? "text-white/90"
                : "text-slate-400 group-hover:text-[#1c6a1e]"
            }`}
          />
        </div>
      </div>
    </button>
  );
}
