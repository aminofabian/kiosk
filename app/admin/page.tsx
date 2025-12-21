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
  DollarSign,
  AlertCircle,
  Loader2,
  Percent,
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
  const [stats, setStats] = useState<{
    totalProducts: number;
    totalSales: number;
    salesCount: number;
    totalCost: number;
    totalProfit: number;
    profitMargin: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use a wide date range for all-time stats
        const startTimestamp = 1; // From beginning (use 1 to avoid falsy check)
        const endTimestamp = Math.floor(Date.now() / 1000); // Now
        
        // Fetch profit data (all-time)
        const profitResponse = await fetch(`/api/profit?start=${startTimestamp}&end=${endTimestamp}`);
        const profitResult = await profitResponse.json();
        
        // Fetch total products count
        const itemsResponse = await fetch('/api/items?all=true');
        const itemsResult = await itemsResponse.json();
        const totalProducts = itemsResult.success ? itemsResult.data?.length || 0 : 0;
        
        if (profitResult.success && profitResult.data) {
          const data = profitResult.data;
          setStats({
            totalProducts,
            totalSales: data.totalSales || 0,
            salesCount: data.totalTransactions || 0,
            totalCost: data.totalCost || 0,
            totalProfit: data.totalProfit || 0,
            profitMargin: data.profitMargin || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

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
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 pt-2 sm:pt-4 pb-20 sm:pb-4">
        {/* POS Quick Access - Prominent at top */}
        <div className="mb-2 sm:mb-6 w-full max-w-5xl mt-0 sm:mt-0">
          <Link href="/pos">
            <div className="group relative w-full bg-gradient-to-r from-[#259783] to-[#3bd522] rounded-lg sm:rounded-xl px-3 py-2 sm:px-6 sm:py-6 text-center transition-all duration-200 hover:shadow-lg hover:shadow-[#259783]/30 active:scale-98 cursor-pointer">
              <div className="flex flex-row items-center justify-center gap-2 sm:gap-4">
                <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <ShoppingCart className="w-4 h-4 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h3 className="text-sm sm:text-xl font-bold text-white">
                    Open POS
                  </h3>
                  <p className="hidden sm:block text-sm text-white/90 mt-1">
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-3 max-w-5xl w-full">
          {visibleButtons.map((button, index) => {
            const Icon = button.icon;
            const isPOS = button.href === '/pos';
            
            // Skip POS button in grid since it's shown prominently above
            if (isPOS) return null;
            
            const ButtonContent = (
              <button
                onClick={button.onClick}
                className="group relative w-full bg-[#259783] rounded-lg px-2 py-2 sm:px-4 sm:py-5 text-center transition-all duration-200 hover:bg-[#3bd522] hover:shadow-md active:scale-95"
              >
                <div className="flex flex-col items-center gap-0.5 sm:gap-2">
                  <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-white/20 flex items-center justify-center">
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[11px] sm:text-sm font-semibold text-white leading-tight">
                      {button.label}
                    </h3>
                    <p className="text-[9px] sm:text-xs text-white/80 leading-tight">
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

        {/* Stats Section */}
        <div className="w-full max-w-5xl mt-4 sm:mt-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600 dark:text-slate-400" />
            </div>
          ) : stats ? (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
              <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
                <Link href="/admin/items">
                  <div className="p-3 sm:p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-center mb-1.5">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Products</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {stats.totalProducts}
                    </p>
                  </div>
                </Link>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Sales</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    KES {Math.round(stats.totalSales).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Orders</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {stats.salesCount}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Cost</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    KES {Math.round(stats.totalCost).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Profit</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    KES {Math.round(stats.totalProfit).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Margin</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {(stats.profitMargin * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ) : null}
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
