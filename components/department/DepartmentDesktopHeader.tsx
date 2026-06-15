'use client';

import Link from 'next/link';
import {
  ClipboardList,
  Loader2,
  LogOut,
  PackageMinus,
  RefreshCw,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import type { RefObject } from 'react';
import { Input } from '@/components/ui/input';

interface DepartmentDesktopHeaderProps {
  businessName?: string;
  userName?: string;
  deptTypes?: string[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  isSearchPending?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onLogout: () => void;
}

export function DepartmentDesktopHeader({
  businessName,
  userName,
  deptTypes = [],
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  searchInputRef,
  isSearchPending,
  onRefresh,
  refreshing,
  onLogout,
}: DepartmentDesktopHeaderProps) {
  return (
    <div className="px-4 py-2 md:px-4 md:py-2.5 bg-white dark:bg-[#1c2e18]">
      <div className="max-w-[1600px] mx-auto grid gap-2 grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'brand_toolbar'_'search_search'] xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:[grid-template-areas:'brand_search_toolbar'] xl:items-center xl:gap-x-3">
        <div className="[grid-area:brand] flex items-center gap-2 min-w-0 shrink-0 xl:w-[8.5rem]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1c6a1e] to-[#1e8a72] shadow-sm flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#1c6a1e] tracking-tight truncate">
              {businessName || 'Department'}
            </h1>
            {userName && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {userName}
                {deptTypes.length > 0 && ` · ${deptTypes.join(', ')}`}
              </p>
            )}
          </div>
        </div>

        <div className="[grid-area:toolbar] flex justify-end shrink-0 min-w-0">
          <div
            className="inline-flex items-center gap-0.5 flex-wrap justify-end rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/90 dark:bg-slate-900/40 p-0.5"
            role="toolbar"
            aria-label="Department actions"
          >
            <Link
              href="/department/stock"
              title="Stock adjustments"
              className="pos-icon-btn !w-8 !h-8 shrink-0 text-[#1c6a1e]"
            >
              <PackageMinus className="w-4 h-4" />
            </Link>
            <Link
              href="/department/requests"
              title="My orders"
              className="pos-icon-btn !w-8 !h-8 shrink-0 text-[#1c6a1e]"
            >
              <ClipboardList className="w-4 h-4" />
            </Link>
            {onRefresh && (
              <button
                type="button"
                className="pos-icon-btn !w-8 !h-8 shrink-0 text-slate-600 dark:text-slate-400 disabled:opacity-40"
                onClick={onRefresh}
                disabled={refreshing}
                title="Refresh products"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              className="pos-icon-btn !w-8 !h-8 shrink-0 text-slate-600 dark:text-slate-400"
              onClick={onLogout}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="[grid-area:search] flex items-stretch gap-2 min-w-0">
          <form onSubmit={onSearchSubmit} className="relative flex-1 min-w-0">
            <div className="relative group/dinput">
              <div className="absolute left-3.5 z-10 top-1/2 -translate-y-1/2 pointer-events-none">
                {isSearchPending ? (
                  <Loader2 className="w-5 h-5 text-[#1c6a1e] animate-spin" />
                ) : (
                  <Search className="w-5 h-5 text-slate-400 group-focus-within/dinput:text-[#1c6a1e] transition-colors" />
                )}
              </div>
              <Input
                ref={searchInputRef}
                type="search"
                enterKeyHint="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="relative w-full h-11 md:h-12 pl-11 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-base font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-[#1c6a1e]/25 focus-visible:border-[#1c6a1e]/30 focus-visible:bg-white dark:focus-visible:bg-slate-900"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 pos-icon-btn !w-8 !h-8 z-10"
                  onClick={onClearSearch}
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
