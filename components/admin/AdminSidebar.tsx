'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import type { UserRole } from '@/lib/constants';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  PackageCheck,
  TrendingUp,
  CreditCard,
  Clock,
  FileText,
  ChevronRight,
  Users,
  FolderTree,
} from 'lucide-react';

interface MenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
  matchPath?: string;
  roles?: UserRole[];
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
  { href: '/admin/purchases', label: 'Purchases', icon: ShoppingBag, description: 'Buy inventory' },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree, description: 'Product categories' },
  { href: '/admin/items', label: 'Items', icon: Package, description: 'Product catalog' },
  { href: '/admin/stock', label: 'Stock', icon: PackageCheck, description: 'Inventory levels' },
  { href: '/admin/profit', label: 'Profit', icon: TrendingUp, description: 'Analytics' },
  { href: '/admin/credits', label: 'Credits', icon: CreditCard, description: 'Outstanding debts' },
  { href: '/admin/shifts', label: 'Shifts', icon: Clock, description: 'Work sessions' },
  { href: '/admin/reports/sales', label: 'Reports', icon: FileText, matchPath: '/admin/reports', description: 'Sales reports' },
  { href: '/admin/users', label: 'Users', icon: Users, description: 'Team management', roles: ['owner'] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const isActive = (href: string, matchPath?: string) => {
    const pathToMatch = matchPath || href;
    if (pathToMatch === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(pathToMatch);
  };

  const visibleItems = MENU_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  return (
    <div className="py-4 px-3 space-y-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.matchPath);
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-[#259783] shadow-md shadow-[#259783]/20 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                  active
                    ? 'bg-[#101b0d]/10'
                    : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${
                    active
                      ? 'text-white'
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`text-[10px] truncate ${
                    active ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {item.description}
                </p>
              </div>
              {active && (
                <ChevronRight className="w-4 h-4 text-white/70" />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
