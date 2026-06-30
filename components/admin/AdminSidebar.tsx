"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useItemTypes } from "@/lib/hooks/use-item-types";
import { apiGet } from "@/lib/utils/api-client";
import type { UserRole } from "@/lib/constants";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  PackageCheck,
  Layers,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Clock,
  FileText,
  ChevronRight,
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
  MapPin,
  RotateCcw,
  ScrollText,
  Cloud,
  ClipboardCheck,
  ClipboardList,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

interface NavChild {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPath?: string;
  roles?: UserRole[];
  badge?: "bills" | "expiry" | "carts";
  children?: NavChild[];
  dynamicChildren?: "sales-types" | "profit-types";
}

interface NavSection {
  id: string;
  label: string;
  alwaysOpen?: boolean;
  items: NavItem[];
}

const CASHIER_HREFS = new Set([
  "/admin",
  "/admin/aisles",
  "/admin/categories",
  "/admin/items",
  "/admin/items/no-barcode",
  "/admin/items/price-stickers",
  "/admin/credits",
  "/admin/expenses",
  "/admin/supplier-bills",
  "/admin/supplier-price-comparison",
  "/admin/out-of-stock-requests",
  "/admin/pending-carts",
  "/pos",
]);

const BASE_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home",
    alwaysOpen: true,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "Open POS", icon: ShoppingCart },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { href: "/admin/sales", label: "Sales", icon: BarChart3, dynamicChildren: "sales-types" },
      { href: "/admin/transactions", label: "Transactions", icon: ListOrdered },
      { href: "/admin/pending-carts", label: "Open carts", icon: Cloud, badge: "carts" },
      { href: "/admin/returns", label: "Returns", icon: RotateCcw, roles: ["owner", "admin"] },
      { href: "/admin/customers", label: "Customers", icon: UserCheck },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      { href: "/admin/categories", label: "Categories", icon: FolderTree },
      {
        href: "/admin/items",
        label: "Items",
        icon: Package,
        children: [
          { href: "/admin/items/no-barcode", label: "Barcode audit", icon: ScanBarcode },
          { href: "/admin/items/price-stickers", label: "Price stickers", icon: LayoutGrid },
        ],
      },
      { href: "/admin/aisles", label: "Aisles", icon: MapPin },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    items: [
      { href: "/admin/stock", label: "Stock levels", icon: PackageCheck },
      { href: "/admin/batches", label: "Stock lots", icon: Layers, badge: "expiry" },
      { href: "/admin/purchases", label: "Purchases", icon: ShoppingBag },
      {
        href: "/admin/stock-counts",
        label: "Stock counts",
        icon: ClipboardCheck,
        roles: ["admin", "owner"],
      },
      {
        href: "/admin/stock/approvals",
        label: "Approvals",
        icon: Scale,
        roles: ["admin", "owner"],
      },
      {
        href: "/admin/stock/adjustments",
        label: "Adjustments",
        icon: ClipboardList,
        roles: ["admin", "owner"],
      },
      { href: "/admin/out-of-stock-requests", label: "Not sold", icon: PackageX },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/admin/expenses", label: "Expenses", icon: Receipt },
      { href: "/admin/supplier-bills", label: "Supplier bills", icon: Receipt, badge: "bills" },
      { href: "/admin/credits", label: "Credits", icon: CreditCard },
      {
        href: "/admin/supplier-price-comparison",
        label: "Price compare",
        icon: TrendingDown,
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/profit", label: "Profit", icon: TrendingUp, dynamicChildren: "profit-types" },
      {
        href: "/admin/reports/daily",
        label: "Daily report",
        icon: FileText,
        matchPath: "/admin/reports",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { href: "/admin/shifts", label: "Shifts", icon: Clock },
      {
        href: "/admin/logs",
        label: "Activity log",
        icon: ScrollText,
        roles: ["owner", "admin"],
      },
      { href: "/admin/users", label: "Users", icon: Users, roles: ["owner"] },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
        roles: ["owner", "admin"],
      },
    ],
  },
];

const STORAGE_KEY = "admin-sidebar-sections";

function itemMatchesPath(
  item: NavItem,
  pathname: string,
  isActive: (href: string, matchPath?: string) => boolean,
): boolean {
  if (isActive(item.href, item.matchPath)) return true;
  if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/")))
    return true;
  if (item.dynamicChildren === "sales-types" && pathname.startsWith("/admin/sales/"))
    return true;
  if (item.dynamicChildren === "profit-types" && pathname.startsWith("/admin/profit/"))
    return true;
  return false;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { productTypes } = useItemTypes();
  const [billNotificationCount, setBillNotificationCount] = useState(0);
  const [expiryNotificationCount, setExpiryNotificationCount] = useState(0);
  const [pendingCartCount, setPendingCartCount] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const salesTypeChildren: NavChild[] = useMemo(
    () =>
      productTypes.map((t) => ({
        href: `/admin/sales/${t.key}`,
        label: `${t.emoji} ${t.label}`,
        icon: BarChart3,
      })),
    [productTypes],
  );

  const profitTypeChildren: NavChild[] = useMemo(
    () =>
      productTypes.map((t) => ({
        href: `/admin/profit/${t.key}`,
        label: `${t.emoji} ${t.label}`,
        icon: TrendingUp,
      })),
    [productTypes],
  );

  const isActive = useCallback(
    (href: string, matchPath?: string) => {
      const pathToMatch = matchPath || href;
      if (pathToMatch === "/admin") return pathname === "/admin";
      return pathname.startsWith(pathToMatch);
    },
    [pathname],
  );

  const isSubActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname],
  );

  const visibleSections = useMemo(() => {
    return BASE_SECTIONS.map((section) => ({
      ...section,
      items: section.items
        .filter((item) => {
          if (item.roles) return user && item.roles.includes(user.role);
          if (user?.role === "cashier") return CASHIER_HREFS.has(item.href);
          return true;
        })
        .map((item) => {
          if (user?.role !== "cashier" || !item.children) return item;
          return {
            ...item,
            children: item.children.filter((c) => CASHIER_HREFS.has(c.href)),
          };
        }),
    })).filter((s) => s.items.length > 0);
  }, [user]);

  // Initialise section collapse: open section containing active route
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCollapsed(JSON.parse(stored));
        return;
      }
    } catch {
      /* ignore */
    }

    const initial: Record<string, boolean> = {};
    for (const section of visibleSections) {
      if (section.alwaysOpen) {
        initial[section.id] = false;
        continue;
      }
      const hasActive = section.items.some((item) =>
        itemMatchesPath(item, pathname, isActive),
      );
      initial[section.id] = !hasActive;
    }
    setCollapsed(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand section + parent item when navigating
  useEffect(() => {
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const section of visibleSections) {
        if (section.alwaysOpen) continue;
        const hasActive = section.items.some((item) =>
          itemMatchesPath(item, pathname, isActive),
        );
        if (hasActive) next[section.id] = false;
      }
      return next;
    });

    setExpandedItems((prev) => {
      const next = { ...prev };
      for (const section of visibleSections) {
        for (const item of section.items) {
          const hasChildren =
            item.children?.length ||
            (item.dynamicChildren === "sales-types" && salesTypeChildren.length) ||
            (item.dynamicChildren === "profit-types" && profitTypeChildren.length);
          if (hasChildren && itemMatchesPath(item, pathname, isActive)) {
            next[item.href] = true;
          }
        }
      }
      return next;
    });
  }, [pathname, visibleSections, isActive, salesTypeChildren.length, profitTypeChildren.length]);

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "owner")) {
      apiGet<{
        pending: { count: number };
        overdue: { count: number };
        upcoming: { count: number };
      }>("/api/supplier-bills/notifications")
        .then((result) => {
          if (result.success && result.data) {
            setBillNotificationCount(
              (result.data.overdue?.count || 0) +
                (result.data.upcoming?.count || 0),
            );
          }
        })
        .catch(() => {});

      apiGet<{ totalCount: number }>("/api/batches/expiring")
        .then((result) => {
          if (result.success && result.data) {
            setExpiryNotificationCount(result.data.totalCount || 0);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadPending = () => {
      apiGet<unknown[]>("/api/sales/pending")
        .then((result) => {
          if (result.success && Array.isArray(result.data)) {
            setPendingCartCount(result.data.length);
          }
        })
        .catch(() => {});
    };
    loadPending();
    const timer = setInterval(loadPending, 60_000);
    return () => clearInterval(timer);
  }, [user]);

  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleItem = (href: string) => {
    setExpandedItems((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const getBadgeCount = (badge?: NavItem["badge"]) => {
    if (badge === "bills") return billNotificationCount;
    if (badge === "expiry") return expiryNotificationCount;
    if (badge === "carts") return pendingCartCount;
    return 0;
  };

  const getChildren = (item: NavItem): NavChild[] => {
    if (item.children) return item.children;
    if (item.dynamicChildren === "sales-types") return salesTypeChildren;
    if (item.dynamicChildren === "profit-types") return profitTypeChildren;
    return [];
  };

  return (
    <nav className="px-2 select-none" aria-label="Admin navigation">
      {visibleSections.map((section, sIdx) => {
        const isSectionCollapsed = !section.alwaysOpen && collapsed[section.id];
        const sectionHasActive = section.items.some((item) =>
          itemMatchesPath(item, pathname, isActive),
        );

        return (
          <div key={section.id} className={sIdx > 0 ? "mt-5" : ""}>
            {section.alwaysOpen ? (
              <div className="px-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.label}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 mb-1 rounded-md hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-colors group"
              >
                <ChevronRight
                  className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                    isSectionCollapsed ? "" : "rotate-90"
                  }`}
                  strokeWidth={2}
                />
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    sectionHasActive
                      ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {section.label}
                </span>
              </button>
            )}

            {!isSectionCollapsed && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.matchPath);
                  const children = getChildren(item);
                  const hasChildren = children.length > 0;
                  const itemExpanded = expandedItems[item.href] ?? false;
                  const badgeCount = getBadgeCount(item.badge);

                  return (
                    <div key={item.href}>
                      <div className="flex items-center">
                        <Link href={item.href} className="flex-1 min-w-0">
                          <div
                            className={`relative group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors duration-150 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] ${
                              active && !hasChildren
                                ? "bg-[#1c6a1e]/8 dark:bg-[#1c6a1e]/12"
                                : ""
                            }`}
                          >
                            {active && !hasChildren && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-[#1c6a1e] dark:bg-[#2a8a30]" />
                            )}
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                active
                                  ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                                  : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                              }`}
                              strokeWidth={1.5}
                            />
                            <span
                              className={`flex-1 text-[12px] truncate ${
                                active
                                  ? "font-semibold text-[#1c6a1e] dark:text-[#2a8a30]"
                                  : "font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                              }`}
                            >
                              {item.label}
                            </span>
                            {badgeCount > 0 && (
                              <span
                                className={`min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 ${
                                  item.badge === "bills" ? "bg-red-500" : "bg-amber-500"
                                }`}
                              >
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            )}
                          </div>
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => toggleItem(item.href)}
                            className="p-1.5 mr-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-colors"
                            aria-label={`Toggle ${item.label} sub-menu`}
                          >
                            <ChevronRight
                              className={`w-3 h-3 transition-transform duration-200 ${
                                itemExpanded ? "rotate-90" : ""
                              }`}
                              strokeWidth={2}
                            />
                          </button>
                        )}
                      </div>

                      {hasChildren && itemExpanded && (
                        <div className="ml-3 pl-2 mt-0.5 mb-1 space-y-0.5 border-l border-slate-200/80 dark:border-slate-700/80">
                          {children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isSubActive(child.href);
                            return (
                              <Link key={child.href} href={child.href}>
                                <div
                                  className={`relative flex items-center gap-2 pl-2 pr-2 py-1 rounded-md transition-colors hover:bg-slate-100/60 dark:hover:bg-white/[0.03] ${
                                    childActive
                                      ? "bg-[#1c6a1e]/8 dark:bg-[#1c6a1e]/12"
                                      : ""
                                  }`}
                                >
                                  <ChildIcon
                                    className={`w-3 h-3 shrink-0 ${
                                      childActive
                                        ? "text-[#1c6a1e] dark:text-[#2a8a30]"
                                        : "text-slate-400 dark:text-slate-500"
                                    }`}
                                    strokeWidth={1.5}
                                  />
                                  <span
                                    className={`text-[11px] truncate ${
                                      childActive
                                        ? "font-semibold text-[#1c6a1e] dark:text-[#2a8a30]"
                                        : "font-medium text-slate-500 dark:text-slate-400"
                                    }`}
                                  >
                                    {child.label}
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
