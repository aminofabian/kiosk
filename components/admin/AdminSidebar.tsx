'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useItemTypes } from '@/lib/hooks/use-item-types';
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
  ListOrdered,
  PackageX,
  Settings,
  ScanBarcode,
  LayoutGrid,
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

const BASE_SECTIONS: MenuSection[] = [
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
        subItems: [], // filled from product types
      },
      { href: '/admin/transactions', label: 'Transactions', icon: ListOrdered },
      {
        href: '/admin/profit',
        label: 'Profit',
        icon: TrendingUp,
        subItems: [], // filled from product types
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
      { href: '/admin/items/no-barcode', label: 'Barcode Audit', icon: ScanBarcode },
      { href: '/admin/items/price-stickers', label: 'Price Stickers', icon: LayoutGrid },
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
      { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] },
      { href: '/admin/shifts', label: 'Shifts', icon: Clock },
      { href: '/admin/reports/daily', label: 'Daily Report', icon: FileText, matchPath: '/admin/reports' },
      { href: '/admin/users', label: 'Users', icon: Users, roles: ['owner'] },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { productTypes } = useItemTypes();
  const [billNotificationCount, setBillNotificationCount] = useState(0);

  const SECTIONS: MenuSection[] = useMemo(() => {
    const subItemsFromTypes: SubItem[] = productTypes.map((t) => ({
      href: `/admin/sales/${t.key}`,
      label: `${t.emoji} ${t.label}`,
      icon: BarChart3,
    }));
    const profitSubItems: SubItem[] = productTypes.map((t) => ({
      href: `/admin/profit/${t.key}`,
      label: `${t.emoji} ${t.label}`,
      icon: BarChart3,
    }));
    return BASE_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.href === '/admin/sales') return { ...item, subItems: subItemsFromTypes };
        if (item.href === '/admin/profit') return { ...item, subItems: profitSubItems };
        return item;
      }),
    }));
  }, [productTypes]);

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
          '/admin/items/no-barcode',
          '/admin/items/price-stickers',
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
    <nav className="px-3 select-none" aria-label="Admin navigation">
      {visibleSections.map((section, sIdx) => (
        <div key={sIdx} className={sIdx > 0 ? 'mt-8' : ''}>
          {/* Section label — uppercase, bold (Agentic structure) */}
          {section.label && (
            <div className="flex items-center gap-2 px-3 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
                {section.label}
              </span>
            </div>
          )}

          {/* Menu items — subtle left pill for active, plain text (Agentic layout) */}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.matchPath);
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const expanded = hasSubItems && isExpanded(item.href);
              const showBadge =
                item.href === '/admin/supplier-bills' && billNotificationCount > 0;

              return (
                <div key={item.href}>
                  <Link href={item.href}>
                    <div className="relative group flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors duration-150 hover:bg-slate-100/80 dark:hover:bg-white/[0.04]">
                      {/* Active indicator — small pill left of text (Agentic-style) */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-[#1c6a1e] dark:bg-[#2a8a30]" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active
                            ? 'text-[#1c6a1e] dark:text-[#2a8a30]'
                            : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                        }`}
                        strokeWidth={1.5}
                      />
                      <span
                        className={`flex-1 text-[12px] truncate font-medium ${
                          active
                            ? 'text-[#1c6a1e] dark:text-[#2a8a30]'
                            : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </span>

                      {showBadge && (
                        <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {billNotificationCount > 99 ? '99+' : billNotificationCount}
                        </span>
                      )}

                      {hasSubItems && (
                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                            expanded ? 'rotate-0' : '-rotate-90'
                          } text-slate-400 dark:text-slate-500`}
                          strokeWidth={1.5}
                        />
                      )}
                    </div>
                  </Link>

                  {/* Sub-items — indented, left pill for active */}
                  {hasSubItems && (
                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-4 pl-3 mt-1 mb-2 space-y-0.5 border-l border-slate-200 dark:border-slate-700">
                          {item.subItems!.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = isSubActive(sub.href);

                            return (
                              <Link key={sub.href} href={sub.href}>
                                <div className="relative flex items-center gap-2.5 pl-3 pr-2.5 py-1.5 -ml-px rounded-r-md transition-colors hover:bg-slate-100/60 dark:hover:bg-white/[0.03]">
                                  {subActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 rounded-r-full bg-[#1c6a1e] dark:bg-[#2a8a30]" />
                                  )}
                                  <SubIcon
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      subActive
                                        ? 'text-[#1c6a1e] dark:text-[#2a8a30]'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                    strokeWidth={1.5}
                                  />
                                  <span
                                    className={`text-[11px] truncate font-medium ${
                                      subActive
                                        ? 'text-[#1c6a1e] dark:text-[#2a8a30]'
                                        : 'text-slate-500 dark:text-slate-400'
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
