"use client";

import { Check } from "lucide-react";
import {
  WORKFLOW_STEPS,
  workflowStepIndex,
} from "@/lib/department/supply-constants";

export function WorkflowSteps({
  approvalStatus,
  fulfillmentStatus,
}: {
  approvalStatus: string;
  fulfillmentStatus: string;
}) {
  const current = workflowStepIndex(approvalStatus, fulfillmentStatus);
  const isRejected = approvalStatus === "rejected";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
      {isRejected && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-3">
          Rejected — edit and resubmit to continue
        </p>
      )}
      <ol className="flex items-center justify-between gap-1">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = step.icon;
          return (
            <li key={step.key} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done
                    ? "bg-[#1c6a1e] border-[#1c6a1e] text-white"
                    : active
                      ? "border-[#1c6a1e] bg-[#1c6a1e]/10 text-[#1c6a1e]"
                      : "border-slate-200 dark:border-slate-700 text-slate-300"
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <span
                className={`text-[9px] mt-1.5 text-center leading-tight font-medium ${
                  active || done
                    ? "text-slate-800 dark:text-slate-200"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
