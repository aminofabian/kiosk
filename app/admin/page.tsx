'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { ShopTypeSelector } from '@/components/pos/ShopTypeSelector';
import { getShopType } from '@/lib/utils/shop-type';
import { useItemTypes } from '@/lib/hooks/use-item-types';
import type { Category } from '@/lib/db/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ShiftOpenForm } from '@/components/pos/ShiftOpenForm';
import { ShiftCloseForm } from '@/components/pos/ShiftCloseForm';
import { BalanceApprovals } from '@/components/admin/BalanceApprovals';
import { ItemsManager } from '@/app/admin/items/page';
import type { Shift } from '@/lib/db/types';
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
  Banknote,
  Wallet,
  Image,
  HelpCircle,
  ArrowRight,
  X,
  Layers,
  Receipt,
  BarChart3,
  Clock,
} from 'lucide-react';

type ButtonTheme = 'brand' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate';

const THEME_STYLES: Record<ButtonTheme, { iconBg: string; iconText: string }> = {
  brand: { iconBg: 'bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20', iconText: 'text-[#1c6a1e] dark:text-[#2a8a30]' },
  blue: { iconBg: 'bg-blue-50 dark:bg-blue-900/30', iconText: 'text-blue-600 dark:text-blue-400' },
  amber: { iconBg: 'bg-amber-50 dark:bg-amber-900/30', iconText: 'text-amber-600 dark:text-amber-400' },
  rose: { iconBg: 'bg-rose-50 dark:bg-rose-900/30', iconText: 'text-rose-500 dark:text-rose-400' },
  violet: { iconBg: 'bg-violet-50 dark:bg-violet-900/30', iconText: 'text-violet-600 dark:text-violet-400' },
  slate: { iconBg: 'bg-slate-100 dark:bg-slate-800/60', iconText: 'text-slate-500 dark:text-slate-400' },
};

interface ActionButton {
  href?: string;
  label: string;
  description: string;
  icon: typeof Plus;
  roles?: string[];
  onClick?: () => void;
  theme: ButtonTheme;
  group: 'action' | 'navigate';
}

const ACTION_BUTTONS: ActionButton[] = [
  {
    href: '/pos',
    label: 'Open POS',
    description: 'Start selling',
    icon: ShoppingCart,
    theme: 'brand',
    group: 'action',
  },
  {
    label: 'Open Shift',
    description: 'Record opening balance',
    icon: Banknote,
    roles: ['cashier', 'admin', 'owner'],
    theme: 'brand',
    group: 'action',
  },
  {
    label: 'Close Shift',
    description: 'Record closing balance',
    icon: Receipt,
    roles: ['cashier', 'admin', 'owner'],
    theme: 'brand',
    group: 'action',
  },
  {
    label: 'Create Category',
    description: 'Add new product category',
    icon: FolderTree,
    theme: 'blue',
    group: 'action',
  },
  {
    label: 'Add Item',
    description: 'Create new product',
    icon: Package,
    theme: 'blue',
    group: 'action',
  },
  {
    label: 'Add Stock',
    description: 'Adjust inventory levels',
    icon: Scale,
    theme: 'amber',
    group: 'action',
  },
  {
    label: 'Stock Take',
    description: 'Physical inventory count',
    icon: ClipboardList,
    theme: 'amber',
    group: 'action',
  },
  {
    href: '/admin/items',
    label: 'View Items',
    description: 'Browse product catalog',
    icon: Package,
    theme: 'blue',
    group: 'navigate',
  },
  {
    href: '/admin/stock',
    label: 'View Stock',
    description: 'Check inventory levels',
    icon: PackageCheck,
    theme: 'amber',
    group: 'navigate',
  },
  {
    href: '/admin/purchases',
    label: 'View Purchases',
    description: 'Purchase history',
    icon: ShoppingBag,
    theme: 'amber',
    group: 'navigate',
  },
  {
    href: '/admin/categories',
    label: 'View Categories',
    description: 'Manage categories',
    icon: FolderTree,
    theme: 'blue',
    group: 'navigate',
  },
  {
    href: '/admin/sales',
    label: 'Sales Analytics',
    description: 'Product sales & stock',
    icon: BarChart3,
    theme: 'violet',
    group: 'navigate',
  },
  {
    href: '/admin/profit',
    label: 'View Profit',
    description: 'Profit analytics',
    icon: TrendingUp,
    theme: 'violet',
    group: 'navigate',
  },
  {
    href: '/admin/credits',
    label: 'View Credits',
    description: 'Outstanding debts',
    icon: CreditCard,
    theme: 'rose',
    group: 'navigate',
  },
  {
    href: '/admin/expenses',
    label: 'Record Expenses',
    description: 'Daily operating costs',
    icon: Receipt,
    theme: 'rose',
    group: 'action',
  },
  {
    label: 'Record Withdrawal',
    description: 'Cash taken from drawer',
    icon: Wallet,
    roles: ['cashier', 'admin', 'owner'],
    theme: 'rose',
    group: 'action',
  },
  {
    href: '/admin/supplier-bills/new',
    label: 'Record Supplier Bill',
    description: 'Pending payments',
    icon: Receipt,
    theme: 'rose',
    group: 'action',
  },
  {
    href: '/admin/stock/approvals',
    label: 'Stock Approvals',
    description: 'Pending approvals',
    icon: Scale,
    roles: ['admin', 'owner'],
    theme: 'amber',
    group: 'navigate',
  },
  {
    label: 'Balance Approvals',
    description: 'Cash balance requests',
    icon: DollarSign,
    roles: ['admin', 'owner'],
    theme: 'slate',
    group: 'action',
  },
  {
    href: '/admin/reports/sales',
    label: 'View Reports',
    description: 'Sales reports',
    icon: FileText,
    theme: 'violet',
    group: 'navigate',
  },
  {
    href: '/admin/users',
    label: 'Manage Users',
    description: 'Team management',
    icon: Users,
    roles: ['owner'],
    theme: 'slate',
    group: 'navigate',
  },
  {
    href: '/admin/banners',
    label: 'Manage Banners',
    description: 'Storefront banners',
    icon: Image,
    roles: ['owner'],
    theme: 'slate',
    group: 'navigate',
  },
];

type PendingOpeningItem = { id: string; amount: number; user_name?: string; balance_type: string };

function CloseShiftDrawerContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [pendingOpening, setPendingOpening] = useState<PendingOpeningItem[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/shifts/current?scope=business');
      const result = await response.json();

      if (result.success && result.data) {
        setShift(result.data);
        setPendingOpening([]);
        return;
      }

      setShift(null);
      // No open shift: fetch pending opening requests so user can withdraw
      const approvalsRes = await fetch('/api/balance/approvals?status=pending');
      const approvalsData = await approvalsRes.json();
      if (approvalsData.success && Array.isArray(approvalsData.data)) {
        const opening = approvalsData.data.filter(
          (r: { balance_type: string }) => r.balance_type === 'opening'
        );
        setPendingOpening(opening);
      } else {
        setPendingOpening([]);
      }
    } catch (err) {
      setError('Failed to load shift');
      console.error('Error fetching shift:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdraw = async (requestId: string) => {
    try {
      setWithdrawingId(requestId);
      const res = await fetch(`/api/balance/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.message || 'Failed to withdraw');
      }
    } catch (err) {
      setError('Failed to withdraw');
      console.error('Error withdrawing:', err);
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setApprovingId(requestId);
      const res = await fetch(`/api/balance/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.message || 'Failed to approve');
      }
    } catch (err) {
      setError('Failed to approve');
      console.error('Error approving:', err);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading shift...</p>
        </div>
      </div>
    );
  }

  if (shift) {
    return <ShiftCloseForm shift={shift} />;
  }

  // No open shift: show pending opening requests so they can withdraw (close a pending one)
  if (pendingOpening.length > 0) {
    const formatPrice = (n: number) => `KES ${n.toLocaleString('en-US')}`;
    return (
      <div className="p-4 space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              No open shift yet
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              There are pending opening request(s). Approve one to open the shift and then close it, or withdraw to cancel.
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {pendingOpening.map((req) => (
            <li
              key={req.id}
              className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <div>
                <span className="font-medium">{formatPrice(req.amount)}</span>
                {req.user_name && (
                  <span className="text-muted-foreground text-sm ml-2">— {req.user_name}</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={approvingId === req.id}
                  onClick={() => handleApprove(req.id)}
                  className="bg-[#1c6a1e] hover:bg-[#1a7a69]"
                >
                  {approvingId === req.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Approve & close'
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withdrawingId === req.id}
                  onClick={() => handleWithdraw(req.id)}
                >
                  {withdrawingId === req.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Withdraw'
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button onClick={() => router.push('/pos')} size="touch" variant="secondary" className="w-full">
          Go to POS
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-destructive text-sm">{error || 'No open shift found'}</p>
      <Button onClick={() => router.push('/pos')} size="touch">
        Go to POS
      </Button>
    </div>
  );
}

function BalanceApprovalsDrawerContent() {
  return (
    <div className="p-4">
      <BalanceApprovals />
    </div>
  );
}

interface WithdrawalFormProps {
  onSuccess: () => void;
}

function WithdrawalForm({ onSuccess }: WithdrawalFormProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: reason || 'Cash Withdrawal',
          category: 'variable',
          amount: numericAmount,
          frequency: 'one-time',
          startDate: today,
          notes: reason || 'Cash taken from drawer',
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAmount('');
        setReason('');
        onSuccess();
      } else {
        setError(result.message || 'Failed to record withdrawal');
      }
    } catch (err) {
      console.error('Error recording withdrawal:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Amount to Withdraw (KES)
        </Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g., 5000"
          className="h-11"
          required
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Reason / Notes (optional)
        </Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Owner withdrawal, petty cash, etc."
          className="h-11"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This will be recorded as a one-time variable expense and deducted from the expected cash in drawer.
        </p>
      </div>
      {error && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      <Button
        type="submit"
        className="w-full bg-[#1c6a1e] hover:bg-[#1a7a69] text-white font-semibold"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Recording...
          </>
        ) : (
          <>Record Withdrawal</>
        )}
      </Button>
    </form>
  );
}

export default function AdminDashboardPage() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [stockAdjustDrawerOpen, setStockAdjustDrawerOpen] = useState(false);
  const [stockTakeDrawerOpen, setStockTakeDrawerOpen] = useState(false);
  const [openShiftDrawerOpen, setOpenShiftDrawerOpen] = useState(false);
  const [closeShiftDrawerOpen, setCloseShiftDrawerOpen] = useState(false);
  const [balanceApprovalsDrawerOpen, setBalanceApprovalsDrawerOpen] = useState(false);
  const [withdrawalDrawerOpen, setWithdrawalDrawerOpen] = useState(false);
  const [guideDrawerOpen, setGuideDrawerOpen] = useState(false);
  const [itemsDrawerOpen, setItemsDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
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
  const [salesByItemType, setSalesByItemType] = useState<{ item_type: string; revenue: number; profit: number }[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const { productTypes, itemTypeKeys } = useItemTypes();
  const [shopType, setShopType] = useState<string>(() => getShopType());

  useEffect(() => {
    if (itemTypeKeys.length > 0) {
      setShopType(getShopType(itemTypeKeys));
    } else {
      setShopType(getShopType());
    }
  }, [itemTypeKeys]);

  const handleShopTypeChange = (newShopType: string) => {
    setShopType(newShopType);
    window.location.reload();
  };

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

  const fetchStats = async () => {
    try {
      const itemsResponse = await fetch('/api/items?all=true');
      const itemsResult = await itemsResponse.json();
      const totalProducts = itemsResult.success ? itemsResult.data?.length || 0 : 0;

      // Only fetch profit and sales analytics for users with view_profit (avoids 403 for cashiers)
      const canViewProfit = user?.role !== 'cashier';
      if (canViewProfit) {
        const startTimestamp = 1;
        const endTimestamp = Math.floor(Date.now() / 1000);
        const [profitResponse, analyticsResponse] = await Promise.all([
          fetch(`/api/profit?start=${startTimestamp}&end=${endTimestamp}`),
          fetch('/api/sales/analytics?period=all'),
        ]);
        const profitResult = await profitResponse.json();
        const analyticsResult = await analyticsResponse.json();
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
        } else {
          setStats({ totalProducts, totalSales: 0, salesCount: 0, totalCost: 0, totalProfit: 0, profitMargin: 0 });
        }
        if (analyticsResult.success && analyticsResult.data?.salesByItemType) {
          setSalesByItemType(analyticsResult.data.salesByItemType);
        }
      } else {
        setStats({ totalProducts, totalSales: 0, salesCount: 0, totalCost: 0, totalProfit: 0, profitMargin: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user?.role]);

  const visibleButtons = ACTION_BUTTONS.filter((button) => {
    // If button has specific roles, check if user role is included
    if (button.roles) {
      return user && button.roles.includes(user.role);
    }
    
    // For cashiers, only show allowed buttons
    if (user?.role === 'cashier') {
      const allowedCashierButtons = [
        'Open Shift',
        'Close Shift',
        'Create Category',
        'Add Item',
        'Add Stock',
        'View Items',
        'View Categories',
        'View Credits',
        'Record Expenses',
        'Record Supplier Bill',
      ];
      return allowedCashierButtons.includes(button.label);
    }
    
    // For other roles, show all buttons without role restrictions
    return true;
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
    if (button.label === 'Add Stock' && !button.onClick) {
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
    if (button.label === 'Open Shift' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/pos/shift/open');
          } else {
            setOpenShiftDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'Close Shift' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/pos/shift/close');
          } else {
            setCloseShiftDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'Balance Approvals' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/balance/approvals');
          } else {
            setBalanceApprovalsDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'View Items' && !button.onClick) {
      return {
        ...button,
        href: isMobile ? '/admin/items' : undefined,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/items');
          } else {
            setItemsDrawerOpen(true);
          }
        },
      };
    }
    if (button.label === 'Record Supplier Bill' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/supplier-bills/new');
          } else {
            router.push('/admin/supplier-bills?new=true');
          }
        },
      };
    }
    if (button.label === 'Record Withdrawal' && !button.onClick) {
      return {
        ...button,
        onClick: () => {
          if (isMobile) {
            router.push('/admin/expenses');
          } else {
            setWithdrawalDrawerOpen(true);
          }
        },
      };
    }
    return button;
  });

  const quickActions = visibleButtons.filter((b) => b.group === 'action' && b.label !== 'Open POS');
  const browseLinks = visibleButtons.filter((b) => b.group === 'navigate');

  const renderButtonCard = (button: (typeof visibleButtons)[number], index: number) => {
    const Icon = button.icon;
    const style = THEME_STYLES[button.theme];
    const isNav = button.group === 'navigate';

    const Card = (
      <button
        onClick={button.onClick}
        className="group relative w-full bg-white dark:bg-[#1c2e18] rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-3 sm:p-3.5 text-left transition-all duration-300 ease-out hover:shadow-xl hover:shadow-slate-900/[0.04] dark:hover:shadow-black/20 hover:-translate-y-1 hover:border-slate-300/80 dark:hover:border-slate-600/60 active:translate-y-0 active:shadow-md cursor-pointer overflow-hidden"
      >
        {/* Subtle hover glow */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${style.iconBg}`} style={{ opacity: 0 }} />
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 rounded-2xl bg-gradient-to-br from-current via-transparent to-transparent ${style.iconText}`} />

        <div className="relative flex items-center gap-3">
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]`}
          >
            <Icon className={`w-[18px] h-[18px] sm:w-5 sm:h-5 ${style.iconText} transition-transform duration-300 group-hover:scale-110`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
              {button.label}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
              {button.description}
            </p>
          </div>
          {isNav && (
            <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0 transition-all duration-300 group-hover:text-slate-400 dark:group-hover:text-slate-500 group-hover:translate-x-0.5" />
          )}
        </div>
      </button>
    );

    if (button.href && !button.onClick) {
      return (
        <Link key={button.href} href={button.href}>
          {Card}
        </Link>
      );
    }
    return <div key={button.label + index}>{Card}</div>;
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f1a0d] flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 pt-2 sm:pt-4 pb-20 sm:pb-4">
        {/* Shop Type Selector and POS Quick Access */}
        <div className="mb-2 sm:mb-6 w-full max-w-5xl mt-0 sm:mt-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <ShopTypeSelector 
                key={shopType}
                onShopTypeChange={handleShopTypeChange}
                className="w-full sm:w-auto"
              />
            </div>
          </div>
          <Link href="/pos">
            {/* Solid bg fallback for older browsers (e.g. Win7) that don't support CSS gradients */}
            <div
              className="group relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-[#1c6a1e] bg-gradient-to-r from-[#1c6a1e] to-[#1fa87a] px-4 py-3 sm:px-6 sm:py-5 transition-all duration-200 hover:shadow-xl hover:shadow-[#1c6a1e]/25 active:scale-[0.99] cursor-pointer"
              style={{ backgroundColor: '#1c6a1e' }}
            >
              {/* Subtle decorative circles - rgba fallback for older browsers */}
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/[0.06]" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/[0.04]" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
              <div className="relative flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ring-1 ring-white/20 bg-white/15 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" style={{ color: '#ffffff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-lg font-bold text-white leading-tight" style={{ color: '#ffffff' }}>
                    Open POS
                  </h3>
                  <p className="text-[11px] sm:text-sm text-white/70 mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    Start selling and processing transactions
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors flex-shrink-0 bg-white/10" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 group-hover:translate-x-0.5 transition-transform" style={{ color: 'rgba(255,255,255,0.9)' }} />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Guide Link - hidden from cashiers */}
        {user?.role !== 'cashier' && (
          <div className="mb-4 sm:mb-6 w-full max-w-5xl">
            <button
              onClick={() => setGuideDrawerOpen(true)}
              className="w-full bg-white dark:bg-[#1c2e18] border border-slate-200 dark:border-slate-800 rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1c6a1e]/20 dark:group-hover:bg-[#1c6a1e]/30 transition-colors">
                  <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#1c6a1e]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
                    How to Use This System
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    Click here to see a simple guide on how to get started
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-[#1c6a1e] group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          </div>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="max-w-5xl w-full">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 px-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-slate-400/80 dark:text-slate-600">
                Quick Actions
              </span>
              <div className="flex-1 h-px bg-slate-200/60 dark:bg-slate-700/40" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
              {quickActions.map(renderButtonCard)}
            </div>
          </div>
        )}

        {/* Browse & Reports */}
        {browseLinks.length > 0 && (
          <div className="max-w-5xl w-full mt-4 sm:mt-5">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 px-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-slate-400/80 dark:text-slate-600">
                Browse & Reports
              </span>
              <div className="flex-1 h-px bg-slate-200/60 dark:bg-slate-700/40" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
              {browseLinks.map(renderButtonCard)}
            </div>
          </div>
        )}

        {/* Stats Section */}
        <div className="w-full max-w-5xl mt-4 sm:mt-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#1c6a1e]" />
            </div>
          ) : stats ? (
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18] border-t-2 border-t-[#1c6a1e]">
              <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
                <Link href="/admin/items">
                  <div className="p-3 sm:p-4 text-center hover:bg-[#1c6a1e]/5 dark:hover:bg-[#1c6a1e]/10 transition-colors cursor-pointer">
                    <div className="flex items-center justify-center mb-1.5">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-[#1c6a1e]" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Products</p>
                    <p className="text-xs sm:text-sm font-bold text-[#1c6a1e]">
                      {stats.totalProducts}
                    </p>
                  </div>
                </Link>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#1c6a1e]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Sales</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1c6a1e]">
                    KES {Math.round(stats.totalSales).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-[#1c6a1e]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Orders</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1c6a1e]">
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
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#1c6a1e]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Profit</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1c6a1e]">
                    KES {Math.round(stats.totalProfit).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1.5">
                    <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-[#1c6a1e]" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mb-1">Margin</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1c6a1e]">
                    {(stats.profitMargin * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Grocery vs Retail Sales Split */}
          {!statsLoading && salesByItemType.length > 0 && (
            <Link href="/admin/sales" className="block mt-3 sm:mt-4">
              <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18] rounded-lg sm:rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#1c6a1e]" />
                    Sales by Type
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">View details</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {salesByItemType.map((row) => {
                    const typeConfig = productTypes.find((t) => t.key === row.item_type);
                    const typeLabel = typeConfig
                      ? `${typeConfig.emoji} ${typeConfig.label}`
                      : row.item_type;
                    const totalRev = salesByItemType.reduce((s, r) => s + r.revenue, 0);
                    const pct = totalRev > 0 ? (row.revenue / totalRev) * 100 : 0;
                    return (
                      <div
                        key={row.item_type}
                        className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-700"
                      >
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{typeLabel}</p>
                        <p className="text-sm font-bold text-[#1c6a1e]">
                          KES {Math.round(row.revenue).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          {pct.toFixed(0)}% of revenue · KES {Math.round(row.profit).toLocaleString()} profit
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>

      <Drawer open={categoryDrawerOpen && !isMobile} onOpenChange={setCategoryDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[500px] md:!w-[600px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <FolderTree className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Add New Category
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Organize your products into groups
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-5 py-5 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
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
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-[#1c6a1e] dark:text-[#2a8a30]" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Add New Item
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Create a new product for your inventory
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-5 py-5 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
            <ItemForm
              onSuccess={() => setItemDrawerOpen(false)}
              onCancel={() => setItemDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={stockAdjustDrawerOpen && !isMobile} onOpenChange={setStockAdjustDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Add Stock
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Adjust inventory levels
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="px-4 sm:px-5 py-5">
              <StockAdjustForm
                onCancel={() => setStockAdjustDrawerOpen(false)}
                onSuccess={() => fetchStats()}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={stockTakeDrawerOpen && !isMobile} onOpenChange={setStockTakeDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[800px] md:!w-[900px] lg:!w-[1000px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Stock Take
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Count physical inventory and record actual stock levels
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-5 py-5 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
            <StockTakeForm
              onCancel={() => setStockTakeDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Open Shift Drawer */}
      <Drawer open={openShiftDrawerOpen && !isMobile} onOpenChange={setOpenShiftDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[480px] md:!w-[520px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5 text-[#1c6a1e] dark:text-[#2a8a30]" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Open Shift
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Record the opening cash balance
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="max-w-md mx-auto">
              <ShiftOpenForm />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Close Shift Drawer */}
      <Drawer open={closeShiftDrawerOpen && !isMobile} onOpenChange={setCloseShiftDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[520px] md:!w-[560px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Close Shift
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Record the closing cash balance
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="max-w-2xl mx-auto">
              <CloseShiftDrawerContent />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Balance Approvals Drawer */}
      <Drawer open={balanceApprovalsDrawerOpen && !isMobile} onOpenChange={setBalanceApprovalsDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[720px] md:!w-[840px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Balance Approvals
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Review cash balance requests from cashiers
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30 px-4 sm:px-5 py-4">
            <div className="max-w-4xl mx-auto">
              <BalanceApprovalsDrawerContent />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Record Withdrawal Drawer */}
      <Drawer open={withdrawalDrawerOpen && !isMobile} onOpenChange={setWithdrawalDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[420px] md:!w-[460px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Record Withdrawal
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Log cash taken from the drawer
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30 px-4 sm:px-5 py-4">
            <div className="max-w-md mx-auto">
              <WithdrawalForm onSuccess={() => setWithdrawalDrawerOpen(false)} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Items Drawer */}
      <Drawer open={itemsDrawerOpen && !isMobile} onOpenChange={setItemsDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[900px] md:!w-[1100px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-4 sm:px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <DrawerTitle className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Items
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage your product catalog
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/30">
            <ItemsManager />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={guideDrawerOpen} onOpenChange={setGuideDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen bg-white dark:bg-slate-900">
          <DrawerHeader className="relative border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-[#1c6a1e]/10 to-blue-50 dark:from-[#1c6a1e]/20 dark:to-blue-950/20 px-4 sm:px-6 py-4 sm:py-5">
            <DrawerTitle className="flex items-center gap-3 pr-12 sm:pr-14 text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-[#1c6a1e] to-blue-500 flex items-center justify-center shadow-sm flex-shrink-0">
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderTree className="w-5 h-5 text-[#1c6a1e]" />
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-[#1c6a1e]" />
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1c6a1e] text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="w-5 h-5 text-[#1c6a1e]" />
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
                      Add Stock (Fixing Mistakes!)
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
                    <span>If stock numbers seem wrong, use Add Stock or Stock Take to fix them!</span>
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

      {/* Mobile FAB Menu */}
      <div className="md:hidden fixed bottom-20 right-4 z-30 flex flex-col-reverse items-end gap-3">
        {/* FAB Actions - Show when open */}
        {fabOpen && (
          <>
            <button
              onClick={() => { 
                setFabOpen(false);
                if (isMobile) {
                  router.push('/admin/stock/adjust');
                } else {
                  setStockAdjustDrawerOpen(true);
                }
              }}
              className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Add Stock</span>
            </button>
            <Link
              href="/admin/stock/take"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-150"
            >
              <div className="w-8 h-8 rounded-full bg-[#1c6a1e] flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Stock Take</span>
            </Link>
            <Link
              href="/admin/stock"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in duration-100"
            >
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                <PackageCheck className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">View Stock</span>
            </Link>
          </>
        )}
        
        {/* Main FAB Button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 ${
            fabOpen
              ? 'bg-slate-800 dark:bg-slate-200 rotate-45'
              : 'bg-[#1c6a1e] bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] shadow-[#1c6a1e]/30'
          }`}
          style={fabOpen ? {} : { backgroundColor: '#1c6a1e', color: '#ffffff' }}
        >
          {fabOpen ? (
            <X className="w-6 h-6 text-white dark:text-slate-900" style={{ color: '#ffffff' }} />
          ) : (
            <Plus className="w-7 h-7 text-white" style={{ color: '#ffffff' }} />
          )}
        </button>
      </div>

      {/* FAB Backdrop */}
      {fabOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 dark:bg-black/40 z-20 animate-in fade-in duration-200"
          onClick={() => setFabOpen(false)}
        />
      )}
    </AdminLayout>
  );
}
