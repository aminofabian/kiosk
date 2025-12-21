'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import type { Category } from '@/lib/db/types';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { ItemForm } from '@/components/admin/ItemForm';
import { StockAdjustForm } from '@/components/admin/StockAdjustForm';
import { StockTakeForm } from '@/components/admin/StockTakeForm';
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
  ShoppingCart,
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
    href: '/pos',
    label: 'Open POS',
    description: 'Start selling',
    icon: ShoppingCart,
  },
  {
    label: 'Create Category',
    description: 'Add new product category',
    icon: FolderTree,
  },
  {
    label: 'Add Item',
    description: 'Create new product',
    icon: Package,
  },
  {
    label: 'Stock Adjustment',
    description: 'Adjust inventory levels',
    icon: Scale,
  },
  {
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
  const router = useRouter();
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [stockAdjustDrawerOpen, setStockAdjustDrawerOpen] = useState(false);
  const [stockTakeDrawerOpen, setStockTakeDrawerOpen] = useState(false);
  const [existingCategories, setExistingCategories] = useState<Category[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (categoryDrawerOpen) {
      fetch('/api/categories')
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setExistingCategories(result.data);
          }
        })
        .catch(() => {
          setExistingCategories([]);
        });
    }
  }, [categoryDrawerOpen]);

  const visibleButtons = ACTION_BUTTONS.filter((button) => {
    if (!button.roles) return true;
    return user && button.roles.includes(user.role);
  }).map((button) => {
    if (button.label === 'Create Category' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/categories?new=true');
          } else {
            setCategoryDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'Add Item' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/items/new');
          } else {
            setItemDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'Stock Adjustment' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/stock/adjust');
          } else {
            setStockAdjustDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'Stock Take' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/stock/take');
          } else {
            setStockTakeDrawerOpen(true);
          }
        },
      };
    }
    return button;
  });

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] flex flex-col items-center justify-center p-4">
        {/* POS Quick Access - Prominent at top */}
        <div className="mb-6 w-full max-w-5xl">
          <Link href="/pos">
            <div className="group relative w-full bg-gradient-to-r from-[#259783] to-[#3bd522] rounded-xl px-6 py-6 text-center transition-all duration-200 hover:shadow-lg hover:shadow-[#259783]/30 active:scale-98 cursor-pointer">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <ShoppingCart className="w-7 h-7 text-white" />
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Open POS
                  </h3>
                  <p className="text-sm text-white/90">
                    Start selling and processing transactions
                  </p>
                </div>
                <div className="hidden sm:block ml-auto">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-5xl w-full">
          {visibleButtons.map((button, index) => {
            const Icon = button.icon;
            const isPOS = button.href === '/pos';
            
            // Skip POS button in grid since it's shown prominently above
            if (isPOS) return null;
            
            const ButtonContent = (
              <button
                onClick={button.onClick}
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

      <Drawer open={categoryDrawerOpen && !isMobile} onOpenChange={setCategoryDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-[#259783]/10 dark:from-blue-950/20 dark:to-[#259783]/20 px-6 py-5">
            <DrawerTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-[#259783] flex items-center justify-center shadow-sm">
                <FolderTree className="w-5 h-5 text-white" />
              </div>
              Add New Category
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Create a new category to organize your products
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
            <div className="max-w-2xl mx-auto">
              <CategoryForm
                category={null}
                existingCategories={existingCategories}
                onClose={() => setCategoryDrawerOpen(false)}
                onSuccess={() => setCategoryDrawerOpen(false)}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={itemDrawerOpen && !isMobile} onOpenChange={setItemDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20 px-6 py-5">
            <DrawerTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-sm">
                <Package className="w-5 h-5 text-white" />
              </div>
              Add New Item
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Create a new product item for your inventory
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
            <ItemForm
              onSuccess={() => setItemDrawerOpen(false)}
              onCancel={() => setItemDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={stockAdjustDrawerOpen && !isMobile} onOpenChange={setStockAdjustDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-orange-50 dark:from-[#259783]/20 dark:to-orange-950/20 px-6 py-5">
            <DrawerTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-orange-500 flex items-center justify-center shadow-sm">
                <Scale className="w-5 h-5 text-white" />
              </div>
              Stock Adjustment
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Update inventory levels for damaged, spoiled, or miscounted items
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
            <StockAdjustForm
              onSuccess={() => setStockAdjustDrawerOpen(false)}
              onCancel={() => setStockAdjustDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={stockTakeDrawerOpen && !isMobile} onOpenChange={setStockTakeDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-indigo-50 dark:from-[#259783]/20 dark:to-indigo-950/20 px-6 py-5">
            <DrawerTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#259783] to-indigo-500 flex items-center justify-center shadow-sm">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              Stock Take
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Count physical inventory and record actual stock levels
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
            <StockTakeForm
              onSuccess={() => setStockTakeDrawerOpen(false)}
              onCancel={() => setStockTakeDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </AdminLayout>
  );
}
