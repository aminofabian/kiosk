"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, PackageCheck, Plus, Scale, X } from "lucide-react";

interface MobileActionFABProps {
  isMobile: boolean;
  setStockAdjustDrawerOpen: (open: boolean) => void;
}

export function MobileActionFAB({
  isMobile,
  setStockAdjustDrawerOpen,
}: MobileActionFABProps) {
  const router = useRouter();
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed bottom-20 right-4 z-30 flex flex-col-reverse items-end gap-3">
        {fabOpen && (
          <>
            <button
              onClick={() => {
                setFabOpen(false);
                if (isMobile) {
                  router.push("/admin/stock/adjust");
                } else {
                  setStockAdjustDrawerOpen(true);
                }
              }}
              className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Add Stock
              </span>
            </button>
            <Link
              href="/admin/stock/take"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-150"
            >
              <div className="w-8 h-8 rounded-full bg-[#1c6a1e] flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Stock Take
              </span>
            </Link>
            <Link
              href="/admin/stock"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-100"
            >
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                <PackageCheck className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                View Stock
              </span>
            </Link>
          </>
        )}

        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
            fabOpen
              ? "bg-slate-800 dark:bg-slate-200 rotate-45"
              : "bg-[#1c6a1e] bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] shadow-[#1c6a1e]/30"
          }`}
          style={
            fabOpen ? {} : { backgroundColor: "#1c6a1e", color: "#ffffff" }
          }
        >
          {fabOpen ? (
            <X
              className="w-6 h-6 text-white dark:text-slate-900"
              style={{ color: "#ffffff" }}
            />
          ) : (
            <Plus className="w-7 h-7 text-white" style={{ color: "#ffffff" }} />
          )}
        </button>
      </div>

      {fabOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-20 animate-in fade-in duration-200"
          onClick={() => setFabOpen(false)}
        />
      )}
    </>
  );
}
