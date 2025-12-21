'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { CategoryForm } from '@/components/admin/CategoryForm';
import {
  Plus,
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
} from 'lucide-react';

interface ActionButton {
  href?: string;
  label: string;
  description: string;
  icon: typeof Plus;
  roles?: string[];
  onClick?: () => void;
}

const ACTION_BUTTONS: ActionButton[] = [
  {
    label: 'Create Category',
    description: 'Add new product category',
    icon: FolderTree,
  },
  {
    href: '/admin/items/new',
    label: 'Add Item',
    description: 'Create new product',
    icon: Package,
  },
  {
    href: '/admin/stock/adjust',
    label: 'Stock Adjustment',
    description: 'Adjust inventory levels',
    icon: Scale,
  },
  {
    href: '/admin/stock/take',
    label: 'Stock Take',
    description: 'Physical inventory count',
    icon: ClipboardList,
  },
  {
    href: '/admin/items',
    label: 'View Items',
    description: 'Browse product catalog',
    icon: Package,
  },
  {
    href: '/admin/stock',
    label: 'View Stock',
    description: 'Check inventory levels',
    icon: PackageCheck,
  },
  {
    href: '/admin/purchases',
    label: 'View Purchases',
    description: 'Purchase history',
    icon: ShoppingBag,
  },
  {
    href: '/admin/categories',
    label: 'View Categories',
    description: 'Manage categories',
    icon: FolderTree,
  },
  {
    href: '/admin/profit',
    label: 'View Profit',
    description: 'Profit analytics',
    icon: TrendingUp,
  },
  {
    href: '/admin/credits',
    label: 'View Credits',
    description: 'Outstanding debts',
    icon: CreditCard,
  },
  {
    href: '/admin/reports/sales',
    label: 'View Reports',
    description: 'Sales reports',
    icon: FileText,
  },
  {
    href: '/admin/users',
    label: 'Manage Users',
    description: 'Team management',
    icon: Users,
    roles: ['owner'],
  },
];

export default function AdminDashboardPage() {
  const { user } = useCurrentUser();
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);

  const visibleButtons = ACTION_BUTTONS.filter((button) => {
    if (!button.roles) return true;
    return user && button.roles.includes(user.role);
  });

  const handleButtonClick = (button: ActionButton) => {
    if (button.onClick) {
      button.onClick();
    }
  };

  const createCategoryButton = visibleButtons.find((b) => b.label === 'Create Category');
  if (createCategoryButton && !createCategoryButton.onClick) {
    createCategoryButton.onClick = () => setCategoryDrawerOpen(true);
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] flex items-center justify-center p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-5xl w-full">
          {visibleButtons.map((button, index) => {
            const Icon = button.icon;
            const ButtonContent = (
              <button
                onClick={() => handleButtonClick(button)}
                className="group relative w-full bg-[#259783] rounded-lg px-4 py-5 text-center transition-all duration-200 hover:bg-[#3bd522] hover:shadow-md active:scale-95"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                      {button.label}
                    </h3>
                    <p className="text-xs text-white/80">
                      {button.description}
                    </p>
                  </div>
                </div>
              </button>
            );

            if (button.href) {
              return (
                <Link key={button.href || index} href={button.href}>
                  {ButtonContent}
                </Link>
              );
            }

            return <div key={index}>{ButtonContent}</div>;
          })}
        </div>
      </div>

      <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen">
          <DrawerHeader className="border-b bg-gradient-to-r from-blue-500/10 to-[#259783]/10">
            <DrawerTitle className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-blue-500" />
              Add New Category
            </DrawerTitle>
            <DrawerDescription>
              Create a new category to organize your products
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
            <CategoryForm
              category={null}
              onClose={() => setCategoryDrawerOpen(false)}
              onSuccess={() => setCategoryDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </AdminLayout>
  );
}
