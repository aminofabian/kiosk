'use client';

import { LayoutGrid, MoreHorizontal, Search, ShoppingCart } from 'lucide-react';

export type PosMobileTab = 'sell' | 'search' | 'cart';

interface PosBottomNavProps {
  activeTab: PosMobileTab;
  onTabChange: (tab: PosMobileTab) => void;
  onMorePress: () => void;
  cartItemCount: number;
  orphanedCount?: number;
}

const TABS: { id: PosMobileTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'sell', label: 'Sell', icon: LayoutGrid },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
];

export function PosBottomNav({
  activeTab,
  onTabChange,
  onMorePress,
  cartItemCount,
  orphanedCount = 0,
}: PosBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl backdrop-saturate-150 border-t border-slate-200/90 dark:border-slate-800/90 shadow-[0_-4px_24px_-2px_rgba(15,23,42,0.1)] dark:shadow-black/40 safe-area-bottom md:hidden"
      aria-label="POS navigation"
    >
      <div className="flex h-[3.25rem] items-stretch px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const showCartBadge = tab.id === 'cart' && (cartItemCount > 0 || orphanedCount > 0);
          const badgeCount = tab.id === 'cart' ? Math.max(cartItemCount, orphanedCount) : 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative touch-manipulation active:scale-[0.97] transition-transform"
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#1c6a1e] rounded-b-full" />
              )}
              <div
                className={`relative flex items-center justify-center w-10 h-8 rounded-xl transition-colors ${
                  active ? 'bg-[#1c6a1e]/12' : ''
                }`}
              >
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${
                    active ? 'text-[#1c6a1e]' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                {showCartBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#1c6a1e] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold leading-none ${
                  active ? 'text-[#1c6a1e]' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onMorePress}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 relative touch-manipulation active:scale-[0.97] transition-transform"
          aria-label="More options"
        >
          <div className="flex items-center justify-center w-10 h-8 rounded-xl">
            <MoreHorizontal className="w-[22px] h-[22px] text-slate-400 dark:text-slate-500" />
          </div>
          <span className="text-[10px] font-semibold leading-none text-slate-400 dark:text-slate-500">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
