"use client";

import { Check } from "lucide-react";

const STEPS = [
  { key: "supplier", label: "Supplier" },
  { key: "products", label: "Products" },
  { key: "notes", label: "Notes" },
] as const;

export function NewPOSteps({
  supplierDone,
  productsDone,
}: {
  supplierDone: boolean;
  productsDone: boolean;
}) {
  const activeIndex = !supplierDone ? 0 : !productsDone ? 1 : 2;

  return (
    <ol className="flex items-center gap-1 mb-4">
      {STEPS.map((step, i) => {
        const done = i === 0 ? supplierDone : i === 1 ? productsDone : supplierDone;
        const active = i === activeIndex;
        return (
          <li key={step.key} className="flex items-center flex-1 min-w-0">
            <div
              className={`flex items-center gap-1.5 min-w-0 ${
                active ? "text-[#1c6a1e]" : done ? "text-slate-600" : "text-slate-400"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                  done
                    ? "bg-[#1c6a1e] border-[#1c6a1e] text-white"
                    : active
                      ? "border-[#1c6a1e] bg-[#1c6a1e]/10"
                      : "border-slate-200 dark:border-slate-700"
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="text-[10px] font-semibold truncate hidden sm:inline">
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 mx-1 ${
                  done ? "bg-[#1c6a1e]/40" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
