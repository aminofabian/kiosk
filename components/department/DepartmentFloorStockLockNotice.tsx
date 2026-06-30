'use client';

import { Eye, Lock } from 'lucide-react';

type NoticeVariant = 'stock' | 'loss' | 'records';

const COPY: Record<
  NoticeVariant,
  { title: string; body: string; hint?: string }
> = {
  stock: {
    title: 'View-only stock',
    body: 'Direct quantity edits are off — open any item to record spoilage, damage, or theft, or use Daily count for audits.',
    hint: 'Search and filter here to see what needs attention on the floor.',
  },
  loss: {
    title: 'Loss recording locked',
    body: 'Spoilage, damage, and theft cannot be recorded on the floor right now. Tell your manager or wait for admin to update stock after cycle counts.',
    hint: 'Supply orders and expenses are still available in other tabs.',
  },
  records: {
    title: 'Inventory changes locked',
    body: 'Floor stock edits and loss write-offs are disabled. Use Daily count for physical audits; admin applies adjustments when escalations are approved.',
  },
};

export function DepartmentFloorStockLockNotice({
  variant = 'stock',
  className = '',
}: {
  variant?: NoticeVariant;
  className?: string;
}) {
  const copy = COPY[variant];

  return (
    <div
      className={`rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/20 px-3 py-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
          <Lock className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
            {copy.title}
          </p>
          <p className="text-xs text-indigo-800/90 dark:text-indigo-200/90 mt-0.5 leading-relaxed">
            {copy.body}
          </p>
          {copy.hint && (
            <p className="flex items-center gap-1 mt-1.5 text-[11px] text-indigo-600 dark:text-indigo-300">
              <Eye className="w-3 h-3 shrink-0" />
              {copy.hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
