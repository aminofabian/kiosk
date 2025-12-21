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
  DrawerClose,
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
  Image,
  HelpCircle,
  ArrowRight,
  X,
  Layers,
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
  {
    href: '/admin/banners',
    label: 'Manage Banners',
    description: 'Storefront banners',
    icon: Image,
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
  const [guideDrawerOpen, setGuideDrawerOpen] = useState(false);
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

        {/* Guide Link */}
        <div className="mb-4 sm:mb-6 w-full max-w-5xl">
          <button
            onClick={() => setGuideDrawerOpen(true)}
            className="w-full bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#259783]/20 dark:group-hover:bg-[#259783]/30 transition-colors">
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#259783]" />
              </div>
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
                  How to Use This System
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Click here to see a simple guide on how to get started
                </p>
              </div>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-[#259783] group-hover:translate-x-1 transition-all" />
            </div>
          </button>
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
              <Loader2 className="w-4 h-4 animate-spin text-[#259783]" />
            </div>
          ) : stats ? (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18] border-t-2 border-t-[#259783]">
              <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
                <Link href="/admin/items">
                  <div className="p-3 sm:p-4 text-center hover:bg-[#259783]/5 dark:hover:bg-[#259783]/10 transition-colors cursor-pointer">
                    <div className="flex items-center justify-center mb-1.5">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-[#259783]" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Products</p>
                    <p className="text-xs sm:text-sm font-bold text-[#259783]">
                      {stats.totalProducts}
                    </p>
                  </div>
                </Link>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#259783]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Sales</p>
                  <p className="text-xs sm:text-sm font-bold text-[#259783]">
                    KES {Math.round(stats.totalSales).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-[#259783]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Orders</p>
                  <p className="text-xs sm:text-sm font-bold text-[#259783]">
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
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#259783]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Profit</p>
                  <p className="text-xs sm:text-sm font-bold text-[#259783]">
                    KES {Math.round(stats.totalProfit).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-[#259783]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Margin</p>
                  <p className="text-xs sm:text-sm font-bold text-[#259783]">
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

      <Drawer open={guideDrawerOpen} onOpenChange={setGuideDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="relative border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#259783]/10 to-blue-50 dark:from-[#259783]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
            <DrawerTitle className="flex items-center gap-3 pr-12 sm:pr-14 text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-[#259783] to-blue-500 flex items-center justify-center shadow-sm flex-shrink-0">
                <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="leading-tight">How to Use This System</span>
            </DrawerTitle>
            <DrawerDescription className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 pr-12 sm:pr-14">
              Follow these simple steps to get started
            </DrawerDescription>
            <DrawerClose asChild>
              <button
                className="absolute top-4 right-4 sm:top-5 sm:right-6 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm touch-target"
                aria-label="Close guide"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </button>
            </DrawerClose>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-6 py-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
            <div className="space-y-6 max-w-2xl">
              {/* Getting Started Section */}
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Getting Started
                </h2>
              </div>

              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783] text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderTree className="w-5 h-5 text-[#259783]" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Create Categories (Group Your Products!)
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Categories are broad groups that help organize what you sell! Think of them like sections in a store - "Fruits" is a category for all fruit items, "Vegetables" is a category for all vegetable items, and "Snacks" is a category for all snack items. This helps organize your products and makes them easier to find!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                    Example: Fruits (apples, mangoes, bananas), Vegetables (tomatoes, onions, cabbages), Dairy, Snacks, Drinks
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783] text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-[#259783]" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Add Your Products
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Now add the things you want to sell! Give each item a name (like "Mangoes"), set a price (how much money it costs), and tell the system how many you have (like "50 pieces" or "20 kg").
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                    Example: Mangoes - KES 100 per kg - You have 50 kg
                  </p>
                </div>
              </div>

              {/* Variants & Parents Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Parent Items & Variants (Like a Supermarket Aisle!)
                </h2>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      What are Parent Items and Variants?
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                      Think of a supermarket aisle! The <strong>Parent Item</strong> is like the aisle sign that says "Tomatoes" - it's the main category. The <strong>Variants</strong> are like all the different ways you can buy tomatoes in that aisle - by the kilogram, by the piece, in different sizes, etc.!
                    </p>
                    <div className="bg-white dark:bg-slate-800 rounded p-3 text-xs text-blue-900 dark:text-blue-100">
                      <p className="font-semibold mb-1">Example: Tomatoes Aisle (Parent)</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Tomatoes - Per Kg (KES 150 per kg)</li>
                        <li>Tomatoes - Per Piece (KES 10 per piece)</li>
                        <li>Tomatoes - Big Size (KES 15 per piece)</li>
                      </ul>
                      <p className="mt-2 text-blue-700 dark:text-blue-300">
                        When you tap "Tomatoes" on the POS screen (the checkout counter), you'll see all the different ways to sell tomatoes and pick the right one!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                  A
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                    How to Create Parent Items
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    When adding a new item, choose "Parent Item" mode. Give it a name like "Tomatoes" or "Eggs". Parent items don't have prices or stock - they're just containers!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                  B
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                    How to Add Variants
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    After creating a parent, add variants! Click "Add Item" and choose "Variant" mode. Select the parent (like "Tomatoes") and give it a variant name (like "Per Kg" or "Big Size"). Each variant has its own price and stock!
                  </p>
                </div>
              </div>

              {/* Selling Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Using the POS (Point of Sale - Your Checkout Counter!)
                </h2>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#259783] text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-5 h-5 text-[#259783]" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Open POS - Your Cashier Screen
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Click the big green "Open POS" button at the top! This opens your checkout screen - like the cashier's computer at a supermarket. When a customer brings items to you, you tap on the products on the screen to add them to their bill, then take their payment. It's your digital cash register!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                    Tip: If a product has variants (like different sizes), you'll see a menu to pick which one the customer wants!
                  </p>
                </div>
              </div>

              {/* Stock Management Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Managing Your Stock (Keeping Track of Things!)
                </h2>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <PackageCheck className="w-5 h-5 text-orange-500" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Check Your Stock
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Click "View Stock" to see how many of each product you have. The system automatically reduces stock when you sell something, so you always know what's left!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-orange-500" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Stock Adjustment (Fixing Mistakes!)
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Did something break? Spoil? Or did you count wrong? Use "Stock Adjustment" to fix the numbers. Tell the system what happened and how many items to add or remove.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                    Example: "5 tomatoes spoiled" → reduces stock by 5
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                  6
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="w-5 h-5 text-orange-500" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Stock Take (Counting Everything!)
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Sometimes you need to count everything you have in your shop! Use "Stock Take" to count all your products and update the numbers in the system. This helps keep everything accurate!
                  </p>
                </div>
              </div>

              {/* Profit Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Understanding Your Money (Profit Page!)
                </h2>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                      What is the Profit Page?
                    </h3>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-3">
                      The Profit page is like a magic calculator that tells you if you're making money! It shows you three important numbers:
                    </p>
                    <div className="bg-white dark:bg-slate-800 rounded p-3 text-xs space-y-2">
                      <div>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">💰 Total Sales</p>
                        <p className="text-emerald-700 dark:text-emerald-300">This is all the money customers gave you when they bought things!</p>
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">💸 Total Cost</p>
                        <p className="text-emerald-700 dark:text-emerald-300">This is all the money you spent to buy those things from suppliers!</p>
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-100">🎉 Profit</p>
                        <p className="text-emerald-700 dark:text-emerald-300">This is what's left! Sales minus Costs = Your Profit (the money you actually made!)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                  7
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
                    How to Use the Profit Page
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Click "View Profit" to see your money! You can choose to see profits for "Today", "This Week", "This Month", or pick your own dates. The page shows you which products made the most money, so you know what to sell more of!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                    Example: If you see "Mangoes" made KES 5000 profit, that means selling mangoes was really good for your business!
                  </p>
                </div>
              </div>

              {/* Tips Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  Quick Tips! 💡
                </h2>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                <ul className="space-y-2 text-sm text-yellow-900 dark:text-yellow-100">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>Always update stock when you get new products from suppliers!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>Check the Profit page regularly to see which products customers love!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>Use parent items and variants when one product has different sizes or ways to sell it!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>If stock numbers seem wrong, use Stock Adjustment or Stock Take to fix them!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>Remember: The system counts stock automatically when you sell, but you need to add stock when you buy new items!</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </AdminLayout>
  );
}
