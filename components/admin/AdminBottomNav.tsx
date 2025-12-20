'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Package, TrendingUp, CreditCard, ShoppingCart } from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { href: '/admin', label: 'Home', icon: Home },
  { href: '/admin/purchases', label: 'Purchases', icon: ShoppingBag },
  { href: '/admin/items', label: 'Items', icon: Package },
  { href: '/admin/profit', label: 'Profit', icon: TrendingUp },
  { href: '/admin/credits', label: 'Credits', icon: CreditCard },
] as const;

export function AdminBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1c2e18]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 md:hidden safe-area-inset-bottom">
      <div className="flex items-stretch h-16 px-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#4bee2b] rounded-b-full" />
              )}
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                  active
                    ? 'bg-[#4bee2b]/10'
                    : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-all ${
                    active
                      ? 'text-[#4bee2b] scale-110'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  active
                    ? 'text-[#4bee2b]'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <Link
          href="/pos"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#4bee2b]/10">
            <ShoppingCart
              className="w-5 h-5 text-[#4bee2b]"
            />
          </div>
          <span className="text-[10px] font-medium text-[#4bee2b]">
            POS
          </span>
        </Link>
      </div>
    </nav>
  );
}
