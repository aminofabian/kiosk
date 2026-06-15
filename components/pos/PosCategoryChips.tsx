'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Category } from '@/lib/db/types';

interface PosCategoryChipsProps {
  categories: Category[];
  onSelect: (categoryId: string) => void;
}

/** Mobile-friendly category chips — minimum 44px touch targets */
export function PosCategoryChips({ categories, onSelect }: PosCategoryChipsProps) {
  const [expanded, setExpanded] = useState(false);

  if (categories.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 min-h-[44px] px-1 py-2 text-left touch-target"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Categories
          </span>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            ({categories.length})
          </span>
        </span>
        {!expanded && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[45%]">
            Tap to browse
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-2 px-0.5 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-600/60 hover:border-[#1c6a1e]/60 hover:bg-[#1c6a1e]/8 dark:hover:bg-[#1c6a1e]/12 hover:text-[#1c6a1e] active:scale-[0.98] transition-all duration-150 shadow-sm touch-target"
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
