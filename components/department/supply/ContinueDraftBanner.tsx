"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDepartmentApp } from "@/components/department/DepartmentAppProvider";
import {
  draftHasProgress,
  loadNewPODraft,
  summarizeNewPODraft,
  type NewPODraftSummary,
} from "@/lib/department/po-new-draft";
import { deptLabel, formatSupplierName } from "@/lib/department/supply-constants";

function formatSavedAgo(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return "earlier today";
}

export function ContinueDraftBanner() {
  const { userId } = useDepartmentApp();
  const [summary, setSummary] = useState<NewPODraftSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const refresh = () => {
      const draft = loadNewPODraft(userId);
      if (!draft || !draftHasProgress(draft)) {
        setSummary(null);
        return;
      }
      setSummary(summarizeNewPODraft(draft));
    };

    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [userId]);

  if (!summary || dismissed) return null;

  const supplierLabel = summary.supplierName
    ? formatSupplierName(summary.supplierName)
    : "your supplier";
  const dept = summary.department ? deptLabel(summary.department) : null;

  return (
    <div className="rounded-xl border border-[#1c6a1e]/25 bg-gradient-to-r from-[#1c6a1e]/10 to-[#1c6a1e]/5 p-3">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#1c6a1e]/15 flex items-center justify-center shrink-0 mt-0.5">
          <History className="w-4 h-4 text-[#1c6a1e]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Continue your draft order
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {supplierLabel}
            {dept ? ` · ${dept}` : ""}
            {summary.itemCount > 0 && (
              <>
                {" "}
                · {summary.itemCount} item{summary.itemCount !== 1 ? "s" : ""}
              </>
            )}
            {summary.total > 0 && (
              <>
                {" "}
                · KES{" "}
                {summary.total.toLocaleString("en-KE", {
                  maximumFractionDigits: 0,
                })}
              </>
            )}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Saved on this device {formatSavedAgo(summary.savedAt)}
          </p>
          <Button
            size="sm"
            className="mt-2 h-8 bg-[#1c6a1e] hover:bg-[#165a19] text-white text-xs"
            asChild
          >
            <Link href="/department/supply/new">
              Continue
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
          aria-label="Dismiss draft banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
