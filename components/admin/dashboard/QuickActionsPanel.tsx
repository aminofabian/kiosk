"use client";

import { useState } from "react";
import { ChevronDown, Zap } from "lucide-react";
import { ActionGrid } from "./ActionGrid";
import type { ActionSection } from "./constants";

interface SectionGroup {
  section: ActionSection;
  label: string;
  buttons: import("./constants").ActionButton[];
}

interface QuickActionsPanelProps {
  groups: SectionGroup[];
}

const QUICK_ACTION_SECTIONS: ActionSection[] = [
  "catalog",
  "inventory",
  "money",
  "reports",
  "settings",
];

export function QuickActionsPanel({ groups }: QuickActionsPanelProps) {
  const [open, setOpen] = useState(false);

  const actionGroups = groups.filter((g) =>
    QUICK_ACTION_SECTIONS.includes(g.section),
  );
  const totalActions = actionGroups.reduce(
    (n, g) => n + g.buttons.length,
    0,
  );

  if (actionGroups.length === 0) return null;

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-[#1c2e18] px-4 py-3 text-left transition-colors hover:border-slate-300 dark:hover:border-slate-600"
      >
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Quick actions
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {totalActions} shortcuts — catalog, inventory, money & more
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <ActionGrid groups={actionGroups} nested />
        </div>
      )}
    </section>
  );
}
