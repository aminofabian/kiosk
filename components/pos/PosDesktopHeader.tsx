'use client';

import Link from 'next/link';
import {
  BarChart2,
  Camera,
  ImagePlus,
  Loader2,
  LogOut,
  PackageX,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  X,
} from 'lucide-react';
import type { ButtonHTMLAttributes, RefObject } from 'react';
import { Input } from '@/components/ui/input';
import { PosClearCacheButton } from '@/components/pos/PosClearCacheButton';
import { PosShiftStatusBar } from '@/components/pos/PosCashierOperations';

interface PosDesktopHeaderProps {
  businessName?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSearchFocus?: () => void;
  onClearSearch: () => void;
  onOpenCamera: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchContainerRef: RefObject<HTMLDivElement | null>;
  isSearchPending?: boolean;
  isScanning?: boolean;
  isValidBarcode: (value: string) => boolean;
  showSuggestions: boolean;
  loadingSuggestions?: boolean;
  suggestions?: React.ReactNode;
  isOwnerOrAdmin?: boolean;
  statsMenuOpen: boolean;
  onStatsMenuToggle: () => void;
  statsMenuRef: RefObject<HTMLDivElement | null>;
  posStockFilter: 'all' | 'out' | 'low';
  posStockStats: { popular: number; out: number; low: number };
  onStockFilterChange: (filter: 'all' | 'out' | 'low') => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onOutOfStock: () => void;
  canProcessReturn?: boolean;
  onReturns: () => void;
  canAccessAdmin?: boolean;
  onLogout: () => void;
  editQuickSellPhotos?: boolean;
  onEditQuickSellPhotosToggle?: () => void;
  cartItemCount: number;
  cartTotal: number;
  cartsCount: number;
  orphanedCount: number;
  onClearCart: () => void;
}

function ToolbarBtn({
  className = '',
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`pos-icon-btn !w-8 !h-8 shrink-0 text-slate-600 dark:text-slate-400 disabled:opacity-40 ${
        active ? 'ring-2 ring-amber-400/80 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-900' : ''
      } ${className}`}
      {...props}
    />
  );
}

function HeaderToolbar({
  isOwnerOrAdmin,
  statsMenuOpen,
  onStatsMenuToggle,
  statsMenuRef,
  posStockFilter,
  posStockStats,
  onStockFilterChange,
  onRefresh,
  refreshing,
  onOutOfStock,
  canProcessReturn,
  onReturns,
  canAccessAdmin,
  onLogout,
  editQuickSellPhotos,
  onEditQuickSellPhotosToggle,
}: Pick<
  PosDesktopHeaderProps,
  | 'isOwnerOrAdmin'
  | 'statsMenuOpen'
  | 'onStatsMenuToggle'
  | 'statsMenuRef'
  | 'posStockFilter'
  | 'posStockStats'
  | 'onStockFilterChange'
  | 'onRefresh'
  | 'refreshing'
  | 'onOutOfStock'
  | 'canProcessReturn'
  | 'onReturns'
  | 'canAccessAdmin'
  | 'onLogout'
  | 'editQuickSellPhotos'
  | 'onEditQuickSellPhotosToggle'
>) {
  return (
    <div
      className="inline-flex items-center gap-0.5 flex-wrap justify-end rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/90 dark:bg-slate-900/40 p-0.5"
      role="toolbar"
      aria-label="POS actions"
    >
      {isOwnerOrAdmin && (
        <div className="relative" ref={statsMenuRef}>
          <ToolbarBtn
            aria-label="Stock filters"
            aria-expanded={statsMenuOpen}
            onClick={onStatsMenuToggle}
            active={posStockFilter !== 'all'}
            title="Stock filters"
          >
            <BarChart2 className="w-4 h-4" />
          </ToolbarBtn>
          {statsMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-[100] w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-left">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Home screen
              </p>
              {(
                [
                  { id: 'all' as const, label: 'Quick Sell', count: posStockStats.popular },
                  { id: 'out' as const, label: 'Out of stock', count: posStockStats.out },
                  { id: 'low' as const, label: 'Low qty · under 10', count: posStockStats.low },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm ${
                    posStockFilter === opt.id
                      ? 'bg-slate-100 dark:bg-slate-800 text-[#1c6a1e] font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                  }`}
                  onClick={() => onStockFilterChange(opt.id)}
                >
                  {opt.label}
                  <span className="float-right tabular-nums text-slate-400 text-xs">{opt.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOwnerOrAdmin && onEditQuickSellPhotosToggle && (
        <ToolbarBtn
          onClick={onEditQuickSellPhotosToggle}
          active={editQuickSellPhotos}
          title={
            editQuickSellPhotos
              ? 'Photo edit mode on — turn off to sell normally'
              : 'Edit Quick Sell product photos'
          }
          aria-label="Edit Quick Sell product photos"
          aria-pressed={editQuickSellPhotos}
          className={editQuickSellPhotos ? 'text-amber-600 dark:text-amber-400' : ''}
        >
          <ImagePlus className="w-4 h-4" />
        </ToolbarBtn>
      )}

      <ToolbarBtn onClick={onRefresh} disabled={refreshing} title="Refresh products">
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      </ToolbarBtn>

      <PosClearCacheButton disabled={refreshing} variant="compact" className="!w-8 !h-8 !rounded-lg" />

      <ToolbarBtn onClick={onOutOfStock} title="Log customer request">
        <PackageX className="w-4 h-4" />
      </ToolbarBtn>

      {canProcessReturn && (
        <ToolbarBtn onClick={onReturns} title="Returns" className="text-violet-600 dark:text-violet-400">
          <RotateCcw className="w-4 h-4" />
        </ToolbarBtn>
      )}

      {canAccessAdmin && (
        <Link href="/admin" title="Admin">
          <span className="pos-icon-btn !w-8 !h-8 shrink-0 inline-flex bg-[#1c6a1e]/10 text-[#1c6a1e] hover:bg-[#1c6a1e]/20 dark:bg-[#1c6a1e]/20 dark:hover:bg-[#1c6a1e]/30">
            <Settings className="w-4 h-4" />
          </span>
        </Link>
      )}

      <ToolbarBtn onClick={onLogout} title="Sign out">
        <LogOut className="w-4 h-4" />
      </ToolbarBtn>
    </div>
  );
}

export function PosDesktopHeader({
  businessName,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSearchKeyDown,
  onSearchFocus,
  onClearSearch,
  onOpenCamera,
  searchInputRef,
  searchContainerRef,
  isSearchPending,
  isScanning,
  isValidBarcode,
  showSuggestions,
  loadingSuggestions,
  suggestions,
  isOwnerOrAdmin,
  statsMenuOpen,
  onStatsMenuToggle,
  statsMenuRef,
  posStockFilter,
  posStockStats,
  onStockFilterChange,
  onRefresh,
  refreshing,
  onOutOfStock,
  canProcessReturn,
  onReturns,
  canAccessAdmin,
  onLogout,
  editQuickSellPhotos,
  onEditQuickSellPhotosToggle,
}: PosDesktopHeaderProps) {
  const toolbarProps = {
    isOwnerOrAdmin,
    statsMenuOpen,
    onStatsMenuToggle,
    statsMenuRef,
    posStockFilter,
    posStockStats,
    onStockFilterChange,
    onRefresh,
    refreshing,
    onOutOfStock,
    canProcessReturn,
    onReturns,
    canAccessAdmin,
    onLogout,
    editQuickSellPhotos,
    onEditQuickSellPhotosToggle,
  };

  return (
    <div className="px-4 py-2 md:px-4 md:py-2.5 bg-white dark:bg-[#1c2e18]">
      <div className="max-w-[1600px] mx-auto grid gap-2 grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'brand_toolbar'_'search_search'] xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:[grid-template-areas:'brand_search_toolbar'] xl:items-center xl:gap-x-3">
        {/* Brand — top-left on tablet */}
        <div className="[grid-area:brand] flex items-center gap-2 min-w-0 shrink-0 xl:w-[8.5rem]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1c6a1e] to-[#1e8a72] shadow-sm flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-[#1c6a1e] tracking-tight truncate">
            {businessName || 'POS'}
          </h1>
        </div>

        {/* Toolbar — top-right on tablet */}
        <div className="[grid-area:toolbar] flex justify-end shrink-0 min-w-0">
          <HeaderToolbar {...toolbarProps} />
        </div>

        {/* Search + shift — one row */}
        <div className="[grid-area:search] flex items-stretch gap-2 min-w-0">
          <div ref={searchContainerRef} className="relative flex-1 min-w-0">
          <form onSubmit={onSearchSubmit}>
            <div className="relative group/dinput">
              <div className="absolute left-3.5 z-10 top-1/2 -translate-y-1/2 pointer-events-none">
                {isSearchPending || isScanning || loadingSuggestions ? (
                  <Loader2 className="w-5 h-5 text-[#1c6a1e] animate-spin" />
                ) : isValidBarcode(searchQuery) ? (
                  <QrCode className="w-5 h-5 text-[#1c6a1e]" />
                ) : (
                  <Search className="w-5 h-5 text-slate-400 group-focus-within/dinput:text-[#1c6a1e] transition-colors" />
                )}
              </div>
              <Input
                ref={searchInputRef}
                type="search"
                enterKeyHint="search"
                placeholder="Search products or scan barcode..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={onSearchFocus}
                onKeyDown={onSearchKeyDown}
                className="relative w-full h-11 md:h-12 pl-11 pr-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-base font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-[#1c6a1e]/25 focus-visible:border-[#1c6a1e]/30 focus-visible:bg-white dark:focus-visible:bg-slate-900"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-barcode-enabled="true"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                <button
                  type="button"
                  className="pos-icon-btn !w-8 !h-8 text-[#1c6a1e]"
                  onClick={onOpenCamera}
                  aria-label="Scan barcode with camera"
                  title="Scan with camera"
                >
                  <Camera className="w-4 h-4" />
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    className="pos-icon-btn !w-8 !h-8"
                    onClick={onClearSearch}
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="pointer-events-none hidden xl:inline-flex h-6 items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-mono text-[10px] text-slate-400">
                  ⌘K
                </kbd>
              </div>
            </div>
          </form>
          {suggestions}
          {searchQuery && !showSuggestions && !loadingSuggestions && isValidBarcode(searchQuery) && (
            <div className="absolute top-full left-0 right-0 mt-1.5 flex justify-center">
              <span className="inline-flex items-center gap-1.5 bg-[#1c6a1e]/10 px-3 py-1 rounded-lg text-xs text-[#1c6a1e] font-medium">
                <QrCode className="w-3 h-3" />
                Press Enter to scan barcode
              </span>
            </div>
          )}
          </div>
          <PosShiftStatusBar variant="desktop" layout="inline" />
        </div>
      </div>
    </div>
  );
}
