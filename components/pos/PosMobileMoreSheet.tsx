'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  Banknote,
  LogOut,
  PackageX,
  Receipt,
  RefreshCw,
  RotateCcw,
  Settings,
  Wallet,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { PosClearCacheButton } from '@/components/pos/PosClearCacheButton';
import { ShopTypeSelector } from '@/components/pos/ShopTypeSelector';
import { usePosCashierOps } from '@/components/pos/PosCashierOperations';

interface PosMobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName?: string;
  canAccessAdmin?: boolean;
  canProcessReturn?: boolean;
  isOwnerOrAdmin?: boolean;
  posStockFilter?: 'all' | 'out' | 'low';
  posStockStats?: { popular: number; out: number; low: number };
  refreshing?: boolean;
  onShopTypeChange?: (shopType: string) => void;
  onRefresh?: () => void;
  onStockFilterChange?: (filter: 'all' | 'out' | 'low') => void;
  onOutOfStock?: () => void;
  onReturns?: () => void;
  onLogout?: () => void;
}

function ActionRow({
  icon,
  label,
  description,
  onClick,
  href,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = `w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-colors active:scale-[0.99] ${
    danger
      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
      : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80'
  }`;

  const content = (
    <>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          danger ? 'bg-red-100 dark:bg-red-950/40' : 'bg-slate-100 dark:bg-slate-800'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

export function PosMobileMoreSheet({
  open,
  onOpenChange,
  businessName,
  canAccessAdmin,
  canProcessReturn,
  isOwnerOrAdmin,
  posStockFilter = 'all',
  posStockStats,
  refreshing,
  onShopTypeChange,
  onRefresh,
  onStockFilterChange,
  onOutOfStock,
  onReturns,
  onLogout,
}: PosMobileMoreSheetProps) {
  const { hasOpenShift, openDrawer } = usePosCashierOps();
  const closeThen = (fn?: () => void) => {
    onOpenChange(false);
    fn?.();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-2xl max-h-[88dvh] pb-[env(safe-area-inset-bottom,0px)]">
        <DrawerHeader className="text-left px-4 pt-2 pb-1">
          <DrawerTitle className="text-base">{businessName || 'POS'}</DrawerTitle>
          <DrawerDescription>Settings &amp; tools</DrawerDescription>
        </DrawerHeader>

        <div className="px-3 pb-4 space-y-4 overflow-y-auto">
          <div className="px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Department
            </p>
            <ShopTypeSelector onShopTypeChange={onShopTypeChange} compact />
          </div>

          {isOwnerOrAdmin && posStockStats && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
                Stock view
              </p>
              <div className="flex flex-wrap gap-2 px-1">
                {(
                  [
                    { id: 'all' as const, label: 'Quick Sell', count: posStockStats.popular },
                    { id: 'out' as const, label: 'Out', count: posStockStats.out },
                    { id: 'low' as const, label: 'Low', count: posStockStats.low },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onStockFilterChange?.(opt.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      posStockFilter === opt.id
                        ? 'bg-[#1c6a1e] text-white border-[#1c6a1e]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                    <span className="ml-1 opacity-70 tabular-nums">{opt.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 divide-y divide-slate-200/80 dark:divide-slate-800">
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Shift &amp; cash
            </p>
            {hasOpenShift ? (
              <>
                <ActionRow
                  icon={<BarChart2 className="w-5 h-5 text-violet-600" />}
                  label="Shift summary"
                  description="Sales and drawer activity"
                  onClick={() => closeThen(() => openDrawer('summary'))}
                />
                <ActionRow
                  icon={<Wallet className="w-5 h-5 text-rose-500" />}
                  label="Record expense"
                  description="Cash taken from drawer"
                  onClick={() => closeThen(() => openDrawer('expense'))}
                />
                <ActionRow
                  icon={<Receipt className="w-5 h-5 text-amber-600" />}
                  label="Close shift"
                  onClick={() => closeThen(() => openDrawer('close'))}
                />
              </>
            ) : (
              <ActionRow
                icon={<Banknote className="w-5 h-5 text-[#1c6a1e]" />}
                label="Open shift"
                description="Count opening cash"
                onClick={() => closeThen(() => openDrawer('open'))}
              />
            )}
            <ActionRow
              icon={<RefreshCw className={`w-5 h-5 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />}
              label="Refresh products"
              description="Reload catalog from server"
              onClick={() => closeThen(onRefresh)}
            />
            <div className="px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Clear offline cache</p>
                <PosClearCacheButton disabled={refreshing} variant="labeled" className="mt-2 h-9" />
              </div>
            </div>
            <ActionRow
              icon={<PackageX className="w-5 h-5 text-slate-600" />}
              label="Customer request log"
              description="Item asked for but not in stock"
              onClick={() => closeThen(onOutOfStock)}
            />
            {canProcessReturn && (
              <ActionRow
                icon={<RotateCcw className="w-5 h-5 text-violet-600" />}
                label="Returns & refunds"
                onClick={() => closeThen(onReturns)}
              />
            )}
            {canAccessAdmin && (
              <ActionRow
                icon={<Settings className="w-5 h-5 text-[#1c6a1e]" />}
                label="Admin dashboard"
                href="/admin"
                onClick={() => onOpenChange(false)}
              />
            )}
            <ActionRow
              icon={<LogOut className="w-5 h-5 text-red-600" />}
              label="Sign out"
              onClick={() => closeThen(onLogout)}
              danger
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
