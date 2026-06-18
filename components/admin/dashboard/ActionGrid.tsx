"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  THEME_STYLES,
  type ActionButton,
  type ActionSection,
} from "./constants";

interface SectionGroup {
  section: ActionSection;
  label: string;
  buttons: ActionButton[];
}

interface ActionGridProps {
  groups: SectionGroup[];
  nested?: boolean;
}

function ActionButtonCard({ button, index }: { button: ActionButton; index: number }) {
  const Icon = button.icon;
  const style = THEME_STYLES[button.theme];
  const isNav = button.group === "navigate";

  const card = (
    <button
      onClick={button.onClick}
      className="group relative w-full bg-white dark:bg-[#1c2e18] rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-3 sm:p-3.5 text-left transition-all duration-300 ease-out hover:shadow-xl hover:shadow-slate-900/[0.04] dark:hover:shadow-black/20 hover:-translate-y-1 hover:border-slate-300/80 dark:hover:border-slate-600/60 active:translate-y-0 active:shadow-md cursor-pointer overflow-hidden"
    >
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${style.iconBg}`}
        style={{ opacity: 0 }}
      />
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 rounded-2xl bg-gradient-to-br from-current via-transparent to-transparent ${style.iconText}`}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]`}
        >
          <Icon
            className={`w-[18px] h-[18px] sm:w-5 sm:h-5 ${style.iconText} transition-transform duration-300 group-hover:scale-110`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
            {button.label}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
            {button.description}
          </p>
        </div>
        {isNav && (
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0 transition-all duration-300 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:translate-x-0.5" />
        )}
      </div>
    </button>
  );

  if (button.href && !button.onClick) {
    return (
      <Link key={button.href} href={button.href}>
        {card}
      </Link>
    );
  }

  return <div key={button.label + index}>{card}</div>;
}

export function ActionGrid({ groups, nested }: ActionGridProps) {
  if (groups.length === 0) return null;

  return (
    <div
      className={`w-full space-y-6 ${nested ? "" : "max-w-5xl mt-6"}`}
    >
      {groups.map(({ section, label, buttons }) => (
        <section key={section} className="w-full">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 px-0.5">
            {label}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {buttons.map((button, index) => (
              <ActionButtonCard key={button.label + index} button={button} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
