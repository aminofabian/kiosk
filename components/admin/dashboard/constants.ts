import type { LucideIcon } from "lucide-react";
import {
  Package,
  ShoppingBag,
  PackageCheck,
  TrendingUp,
  CreditCard,
  FileText,
  Users,
  FolderTree,
  Scale,
  ClipboardList,
  ShoppingCart,
  DollarSign,
  Banknote,
  Wallet,
  Image,
  Receipt,
  BarChart3,
  Truck,
} from "lucide-react";

export type ButtonTheme = "brand" | "blue" | "amber" | "rose" | "violet" | "slate";

export const THEME_STYLES: Record<
  ButtonTheme,
  { iconBg: string; iconText: string }
> = {
  brand: {
    iconBg: "bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20",
    iconText: "text-[#1c6a1e] dark:text-[#2a8a30]",
  },
  blue: {
    iconBg: "bg-blue-50 dark:bg-blue-900/30",
    iconText: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    iconBg: "bg-amber-50 dark:bg-amber-900/30",
    iconText: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    iconBg: "bg-rose-50 dark:bg-rose-900/30",
    iconText: "text-rose-500 dark:text-rose-400",
  },
  violet: {
    iconBg: "bg-violet-50 dark:bg-violet-900/30",
    iconText: "text-violet-600 dark:text-violet-400",
  },
  slate: {
    iconBg: "bg-slate-100 dark:bg-slate-800/60",
    iconText: "text-slate-500 dark:text-slate-400",
  },
};

export type ActionSection =
  | "pos"
  | "catalog"
  | "inventory"
  | "money"
  | "reports"
  | "settings";

export interface ActionButton {
  href?: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles?: string[];
  onClick?: () => void;
  theme: ButtonTheme;
  group: "action" | "navigate";
  section: ActionSection;
}

export const ACTION_BUTTONS: ActionButton[] = [
  {
    href: "/pos",
    label: "Open POS",
    description: "Start selling",
    icon: ShoppingCart,
    theme: "brand",
    group: "action",
    section: "pos",
  },
  {
    label: "Open Shift",
    description: "Record opening balance",
    icon: Banknote,
    roles: ["cashier", "admin", "owner"],
    theme: "brand",
    group: "action",
    section: "pos",
  },
  {
    label: "Close Shift",
    description: "Record closing balance",
    icon: Receipt,
    roles: ["cashier", "admin", "owner"],
    theme: "brand",
    group: "action",
    section: "pos",
  },
  {
    label: "Create Category",
    description: "Add new product category",
    icon: FolderTree,
    theme: "blue",
    group: "action",
    section: "catalog",
  },
  {
    label: "Add Item",
    description: "Create new product",
    icon: Package,
    theme: "blue",
    group: "action",
    section: "catalog",
  },
  {
    label: "Add Stock",
    description: "Adjust inventory levels",
    icon: Scale,
    theme: "amber",
    group: "action",
    section: "inventory",
  },
  {
    label: "Stock Take",
    description: "Physical inventory count",
    icon: ClipboardList,
    theme: "amber",
    group: "action",
    section: "inventory",
  },
  {
    href: "/admin/items",
    label: "View Items",
    description: "Browse product catalog",
    icon: Package,
    theme: "blue",
    group: "navigate",
    section: "catalog",
  },
  {
    href: "/admin/stock",
    label: "View Stock",
    description: "Check inventory levels",
    icon: PackageCheck,
    theme: "amber",
    group: "navigate",
    section: "inventory",
  },
  {
    href: "/admin/purchases",
    label: "View Purchases",
    description: "Purchase history",
    icon: ShoppingBag,
    theme: "amber",
    group: "navigate",
    section: "inventory",
  },
  {
    href: "/admin/categories",
    label: "View Categories",
    description: "Manage categories",
    icon: FolderTree,
    theme: "blue",
    group: "navigate",
    section: "catalog",
  },
  {
    href: "/admin/sales",
    label: "Sales Analytics",
    description: "Product sales & stock",
    icon: BarChart3,
    theme: "violet",
    group: "navigate",
    section: "reports",
  },
  {
    href: "/admin/profit",
    label: "View Profit",
    description: "Profit analytics",
    icon: TrendingUp,
    theme: "violet",
    group: "navigate",
    section: "reports",
  },
  {
    href: "/admin/credits",
    label: "View Credits",
    description: "Outstanding debts",
    icon: CreditCard,
    theme: "rose",
    group: "navigate",
    section: "money",
  },
  {
    href: "/admin/expenses",
    label: "Record Expenses",
    description: "Daily operating costs",
    icon: Receipt,
    theme: "rose",
    group: "action",
    section: "money",
  },
  {
    label: "Record Withdrawal",
    description: "Cash taken from drawer",
    icon: Wallet,
    roles: ["cashier", "admin", "owner"],
    theme: "rose",
    group: "action",
    section: "money",
  },
  {
    href: "/admin/supplier-bills/new",
    label: "Record Supplier Bill",
    description: "Pending payments",
    icon: Receipt,
    theme: "rose",
    group: "action",
    section: "money",
  },
  {
    href: "/admin/stock/approvals",
    label: "Stock Approvals",
    description: "Pending approvals",
    icon: Scale,
    roles: ["admin", "owner"],
    theme: "amber",
    group: "navigate",
    section: "inventory",
  },
  {
    label: "Balance Approvals",
    description: "Cash balance requests",
    icon: DollarSign,
    roles: ["admin", "owner"],
    theme: "slate",
    group: "action",
    section: "money",
  },
  {
    href: "/admin/reports/sales",
    label: "View Reports",
    description: "Sales reports",
    icon: FileText,
    theme: "violet",
    group: "navigate",
    section: "reports",
  },
  {
    href: "/admin/department-activity",
    label: "Department Activity",
    description: "Staff inventory actions",
    icon: Users,
    roles: ["admin", "owner"],
    theme: "slate",
    group: "navigate",
    section: "inventory",
  },
  {
    href: "/admin/department-supply",
    label: "Department Suppliers",
    description: "Assign suppliers to departments",
    icon: Truck,
    roles: ["admin", "owner"],
    theme: "blue",
    group: "navigate",
    section: "catalog",
  },
  {
    href: "/admin/users",
    label: "Manage Users",
    description: "Team management",
    icon: Users,
    roles: ["owner"],
    theme: "slate",
    group: "navigate",
    section: "settings",
  },
  {
    href: "/admin/banners",
    label: "Manage Banners",
    description: "Storefront banners",
    icon: Image,
    roles: ["owner"],
    theme: "slate",
    group: "navigate",
    section: "settings",
  },
];

export const SECTION_ORDER: ActionSection[] = [
  "pos",
  "catalog",
  "inventory",
  "money",
  "reports",
  "settings",
];

export const SECTION_LABELS: Record<ActionSection, string> = {
  pos: "Shift & register",
  catalog: "Catalog",
  inventory: "Inventory",
  money: "Money & expenses",
  reports: "Reports & analytics",
  settings: "Settings",
};
