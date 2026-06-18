"use client";

import type { ActionButton } from "./constants";

interface ShiftActionsBarProps {
  buttons: ActionButton[];
}

export function ShiftActionsBar({ buttons }: ShiftActionsBarProps) {
  if (buttons.length === 0) return null;

  return (
    <section className="w-full">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-0.5">
        Shift & register
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {buttons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              key={button.label}
              onClick={button.onClick}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-[#1c2e18] px-3 py-2.5 sm:px-4 sm:py-3 text-left transition-all hover:border-[#1c6a1e]/40 hover:shadow-sm active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-lg bg-[#1c6a1e]/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#1c6a1e]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                  {button.label}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {button.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
