'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  LayoutGrid,
  MoreHorizontal,
  PackageMinus,
  Receipt,
  ShoppingCart,
} from 'lucide-react';
import { useDepartmentApp } from '@/components/department/DepartmentAppProvider';

type NavRoute =
  | '/department'
  | '/department/cart'
  | '/department/stock'
  | '/department/records'
  | '/department/analysis';

const ROUTES: {
  href: NavRoute;
  desktopHref?: NavRoute;
  label: string;
  icon: typeof LayoutGrid;
  match: (path: string, isDesktop: boolean) => boolean;
}[] = [
  {
    href: '/department',
    label: 'Sell',
    icon: LayoutGrid,
    match: (path) => path === '/department',
  },
  {
    href: '/department/cart',
    desktopHref: '/department',
    label: 'Cart',
    icon: ShoppingCart,
    match: (path, isDesktop) =>
      isDesktop ? false : path === '/department/cart',
  },
  {
    href: '/department/stock',
    label: 'Stock',
    icon: PackageMinus,
    match: (path) => path.startsWith('/department/stock'),
  },
  {
    href: '/department/records',
    label: 'Records',
    icon: Receipt,
    match: (path) => path.startsWith('/department/records'),
  },
  {
    href: '/department/analysis',
    label: 'Analysis',
    icon: BarChart3,
    match: (path) => path.startsWith('/department/analysis'),
  },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

export function DepartmentBottomNav() {
  const pathname = usePathname();
  const { cartItemCount, setMoreSheetOpen } = useDepartmentApp();
  const isDesktop = useIsDesktop();

  return (
    <nav
      className="shrink-0 z-50 bg-white/95 dark:bg-[#1a2c17]/95 backdrop-blur-xl backdrop-saturate-150 border-t border-slate-200/90 dark:border-slate-800/90 shadow-[0_-4px_24px_-2px_rgba(15,23,42,0.08)] dark:shadow-black/30 safe-area-bottom"
      aria-label="Department navigation"
    >
      <div className="flex h-[3.25rem] items-stretch px-0.5 max-w-3xl mx-auto">
        {ROUTES.map((tab) => {
          const Icon = tab.icon;
          const href = isDesktop && tab.desktopHref ? tab.desktopHref : tab.href;
          const active = tab.match(pathname, isDesktop);
          const showCartBadge = tab.href === '/department/cart' && cartItemCount > 0;

          return (
            <Link
              key={tab.href}
              href={href}
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
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-semibold leading-none ${
                  active ? 'text-[#1c6a1e]' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
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
