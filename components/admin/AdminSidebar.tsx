'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { apiGet } from '@/lib/utils/api-client';
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
  ChevronDown,
  Users,
  FolderTree,
  Receipt,
  UserCheck,
  Scale,
  BarChart3,
  Leaf,
  Store,
  ListOrdered,
  PackageX,
} from 'lucide-react';

interface SubItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface MenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  matchPath?: string;
  roles?: UserRole[];
  subItems?: SubItem[];
}

interface MenuSection {
  label: string | null;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    label: null,
    items: [
      { href: '/pos', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        href: '/admin/sales',
        label: 'Sales',
        icon: BarChart3,
        subItems: [
          { href: '/admin/sales/grocery', label: 'Grocery', icon: Leaf },
          { href: '/admin/sales/retail', label: 'Retail', icon: Store },
        ],
      },
      { href: '/admin/transactions', label: 'Transactions', icon: ListOrdered },
      {
        href: '/admin/profit',
        label: 'Profit',
        icon: TrendingUp,
        subItems: [
          { href: '/admin/profit/grocery', label: 'Grocery', icon: Leaf },
          { href: '/admin/profit/retail', label: 'Retail', icon: Store },
        ],
      },
      { href: '/admin/customers', label: 'Customers', icon: UserCheck },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/admin/purchases', label: 'Purchases', icon: ShoppingBag },
      { href: '/admin/categories', label: 'Categories', icon: FolderTree },
      { href: '/admin/items', label: 'Items', icon: Package },
      { href: '/admin/stock', label: 'Stock', icon: PackageCheck },
      { href: '/admin/out-of-stock-requests', label: 'Requested (Not Sold)', icon: PackageX },
      { href: '/admin/stock/approvals', label: 'Approvals', icon: Scale, roles: ['admin', 'owner'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/expenses', label: 'Expenses', icon: Receipt },
      { href: '/admin/supplier-bills', label: 'Supplier Bills', icon: Receipt },
      { href: '/admin/credits', label: 'Credits', icon: CreditCard },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/shifts', label: 'Shifts', icon: Clock },
      { href: '/admin/reports/daily', label: 'Daily Report', icon: FileText, matchPath: '/admin/reports' },
      { href: '/admin/users', label: 'Users', icon: Users, roles: ['owner'] },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const [billNotificationCount, setBillNotificationCount] = useState(0);

  // Fetch bill notifications for admin/owner
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'owner')) {
      apiGet<{
        pending: { count: number; total: number; bills: unknown[] };
        overdue: { count: number; total: number; bills: unknown[] };
        upcoming: { count: number; total: number; bills: unknown[] };
      }>('/api/supplier-bills/notifications')
        .then((result) => {
          if (result.success && result.data) {
            const count = (result.data.overdue?.count || 0) + (result.data.upcoming?.count || 0);
            setBillNotificationCount(count);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const isActive = (href: string, matchPath?: string) => {
    const pathToMatch = matchPath || href;
    if (pathToMatch === '/admin') return pathname === '/admin';
    return pathname.startsWith(pathToMatch);
  };

  const isSubActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const isExpanded = (href: string) => pathname.startsWith(href);

  // Filter sections by user role
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.roles) return user && item.roles.includes(user.role);
      if (user?.role === 'cashier') {
        const allowed = [
          '/admin',
          '/admin/categories',
          '/admin/items',
          '/admin/credits',
          '/admin/expenses',
          '/admin/supplier-bills',
          '/admin/out-of-stock-requests',
        ];
        return (
          allowed.includes(item.href) ||
          (item.matchPath && allowed.some((a) => item.href.startsWith(a)))
        );
      }
      return true;
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <nav className="py-3 px-2 select-none">
      {visibleSections.map((section, sIdx) => (
        <div key={sIdx} className={sIdx > 0 ? 'mt-5' : ''}>
          {/* Section label */}
          {section.label && (
            <div className="flex items-center gap-2 px-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400/70 dark:text-slate-600">
                {section.label}
              </span>
              <div className="flex-1 h-px bg-slate-200/60 dark:bg-slate-700/40" />
            </div>
          )}

          {/* Menu items */}
          <div className="space-y-[2px]">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.matchPath);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const expanded = hasSubItems && isExpanded(item.href);
              const showBadge =
                item.href === '/admin/supplier-bills' && billNotificationCount > 0;

              return (
                <div key={item.href}>
                  {/* Main item row */}
                  <Link href={item.href}>
                    <div className="relative group flex items-center">
                      {/* Active glow bar */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-[#1c6a1e] to-[#2a8a30] shadow-[0_0_8px_rgba(28,106,30,0.4)]" />
                      )}

                      <div
                        className={`flex items-center gap-2.5 w-full px-3 py-[7px] rounded-lg transition-all duration-150 ${
                          active
                            ? 'bg-[#1c6a1e]/[0.07] dark:bg-[#1c6a1e]/[0.12]'
                            : 'hover:bg-slate-100/80 dark:hover:bg-white/[0.04] active:scale-[0.98]'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 ${
                            active
                              ? 'bg-[#1c6a1e]/[0.12] dark:bg-[#1c6a1e]/[0.18]'
                              : 'bg-transparent group-hover:bg-slate-200/60 dark:group-hover:bg-white/[0.06]'
                          }`}
                        >
                          <Icon
                            className={`w-[16px] h-[16px] transition-colors duration-150 ${
                              active
                                ? 'text-[#1c6a1e] dark:text-[#2a8a30]'
                                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'
                            }`}
                          />
                        </div>

                        <span
                          className={`text-[13px] flex-1 truncate transition-colors duration-150 ${
                            active
                              ? 'font-semibold text-[#1c6a1e] dark:text-[#2a8a30]'
                              : 'font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-300'
                          }`}
                        >
                          {item.label}
                        </span>

                        {showBadge && (
                          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none animate-pulse">
                            {billNotificationCount > 99 ? '99+' : billNotificationCount}
                          </span>
                        )}

                        {hasSubItems && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              expanded ? 'rotate-0' : '-rotate-90'
                            } ${
                              active
                                ? 'text-[#1c6a1e]/50 dark:text-[#2a8a30]/50'
                                : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Sub-items with smooth expand */}
                  {hasSubItems && (
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        expanded
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-[22px] pl-3 mt-0.5 mb-1 space-y-[1px] border-l-[1.5px] border-slate-200/80 dark:border-slate-700/40">
                          {item.subItems!.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = isSubActive(sub.href);

                            return (
                              <Link key={sub.href} href={sub.href}>
                                <div
                                  className={`group/sub relative flex items-center gap-2 px-2.5 py-[5px] rounded-md transition-all duration-150 ${
                                    subActive
                                      ? 'bg-[#1c6a1e]/[0.07] dark:bg-[#1c6a1e]/[0.12]'
                                      : 'hover:bg-slate-100/60 dark:hover:bg-white/[0.03]'
                                  }`}
                                >
                                  {/* Connector dot */}
                                  <div
                                    className={`absolute -left-[calc(0.75rem+1px)] top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full border-[1.5px] transition-colors ${
                                      subActive
                                        ? 'bg-[#1c6a1e] border-[#1c6a1e]'
                                        : 'bg-white dark:bg-[#1c2e18] border-slate-300 dark:border-slate-600 group-hover/sub:border-slate-400'
                                    }`}
                                  />

                                  <SubIcon
                                    className={`w-3.5 h-3.5 ${
                                      subActive
                                        ? 'text-[#1c6a1e] dark:text-[#2a8a30]'
                                        : 'text-slate-400 dark:text-slate-600 group-hover/sub:text-slate-500'
                                    }`}
                                  />
                                  <span
                                    className={`text-[12px] ${
                                      subActive
                                        ? 'font-semibold text-[#1c6a1e] dark:text-[#2a8a30]'
                                        : 'font-medium text-slate-500 dark:text-slate-500 group-hover/sub:text-slate-700 dark:group-hover/sub:text-slate-400'
                                    }`}
                                  >
                                    {sub.label}
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
