'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SuperAdminLayout } from '@/components/layouts/superadmin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Building2,
  Users,
  DollarSign,
  ShoppingCart,
  Package,
  FolderTree,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Mail,
  Shield,
  Globe,
  KeyRound,
  LogIn,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Star,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Truck,
  Receipt,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  pin: string | null;
  department: string | null;
  active: number;
  created_at: number;
}

interface Domain {
  id: string;
  domain: string;
  business_id: string;
  is_primary: number;
  active: number;
  created_at: number;
}

interface BusinessDetails {
  business: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    active: number;
    created_at: number;
    user_count: number;
    total_sales: number;
    sales_count: number;
    items_count: number;
    categories_count: number;
  };
  users: User[];
  domains: Domain[];
  period: string;
  periodLabel: string;
  periodStats: {
    sales_count: number;
    revenue: number;
  };
  recentStats: {
    recent_sales: number;
    recent_revenue: number;
  };
  todayStats: {
    sales_count: number;
    revenue: number;
  };
  recentSales: Array<{
    id: string;
    total_amount: number;
    payment_method: string;
    status: string;
    sale_date: number | null;
    created_at: number;
    cashier_name: string;
    item_count: number;
  }>;
  topItems: Array<{
    id: string;
    name: string;
    category_name: string;
    current_stock: number;
    current_sell_price: number;
    total_quantity_sold: number;
    total_revenue: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    active: number;
    items_count: number;
  }>;
  inventoryStats: {
    active_items: number;
    out_of_stock: number;
    low_stock: number;
    suppliers_count: number;
    expenses_count: number;
  };
  paymentBreakdown: Array<{
    payment_method: string;
    count: number;
    total: number;
  }>;
}

type SalesPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month';

const SALES_PERIOD_OPTIONS: { value: SalesPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'all', label: 'All time' },
];

export default function BusinessDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<BusinessDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('today');
  
  // Domain management state
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [showPasswordFor, setShowPasswordFor] = useState<Record<string, boolean>>({});
  const [resettingPasswordFor, setResettingPasswordFor] = useState<string | null>(null);
  const [openingSiteFor, setOpeningSiteFor] = useState<string | null>(null);

  const businessId = params.id as string;
  const hasLoadedRef = useRef(false);

  const fetchBusiness = useCallback(
    async (period: SalesPeriod, options?: { salesOnly?: boolean }) => {
      const salesOnly = options?.salesOnly ?? false;
      if (salesOnly) {
        setSalesLoading(true);
      } else {
        setLoading(true);
      }
      try {
        const response = await fetch(
          `/api/superadmin/businesses/${businessId}?period=${period}`,
        );
        const result = await response.json();
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.message || 'Failed to load business');
        }
      } catch {
        setError('Failed to load business');
      } finally {
        if (salesOnly) {
          setSalesLoading(false);
        } else {
          setLoading(false);
        }
      }
    },
    [businessId],
  );

  useEffect(() => {
    fetchBusiness(salesPeriod, { salesOnly: hasLoadedRef.current });
    hasLoadedRef.current = true;
  }, [fetchBusiness, salesPeriod]);

  const handleToggleStatus = async () => {
    if (!data) return;
    
    setUpdating(true);
    try {
      const response = await fetch(`/api/superadmin/businesses/${businessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: data.business.active === 1 ? 0 : 1 }),
      });

      const result = await response.json();
      if (result.success) {
        setData({
          ...data,
          business: {
            ...data.business,
            active: data.business.active === 1 ? 0 : 1,
          },
        });
      }
    } catch {
      // Handle error silently
    } finally {
      setUpdating(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    
    setAddingDomain(true);
    setDomainError(null);
    
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain.toLowerCase().trim(),
          businessId,
          isPrimary: data?.domains?.length === 0,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setNewDomain('');
        setDomainDrawerOpen(false);
        // Refresh business data
        const refreshResponse = await fetch(
          `/api/superadmin/businesses/${businessId}?period=${salesPeriod}`,
        );
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success) {
          setData(refreshResult.data);
        }
      } else {
        setDomainError(result.message || 'Failed to add domain');
      }
    } catch {
      setDomainError('Failed to add domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleDeleteDomain = (domainId: string) => {
    toast('Are you sure you want to delete this domain?', {
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingDomainId(domainId);
          try {
            const response = await fetch(`/api/domains/${domainId}`, {
              method: 'DELETE',
            });

            const result = await response.json();

            if (result.success && data) {
              setData({
                ...data,
                domains: data.domains.filter((d) => d.id !== domainId),
              });
              toast.success('Domain deleted');
            } else {
              toast.error(result.message || 'Failed to delete domain');
            }
          } catch {
            toast.error('Failed to delete domain');
          } finally {
            setDeletingDomainId(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleSetPrimary = async (domainId: string) => {
    try {
      const response = await fetch(`/api/domains/${domainId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      });
      
      const result = await response.json();
      
      if (result.success && data) {
        setData({
          ...data,
          domains: data.domains.map((d) => ({
            ...d,
            is_primary: d.id === domainId ? 1 : 0,
          })),
        });
      }
    } catch {
      // Handle error silently
    }
  };

  const handleToggleDomainStatus = async (domain: Domain) => {
    try {
      const response = await fetch(`/api/domains/${domain.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: domain.active === 1 ? false : true }),
      });
      
      const result = await response.json();
      
      if (result.success && data) {
        setData({
          ...data,
          domains: data.domains.map((d) =>
            d.id === domain.id ? { ...d, active: domain.active === 1 ? 0 : 1 } : d
          ),
        });
      }
    } catch {
      // Handle error silently
    }
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };
  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'mpesa':
        return 'M-Pesa';
      case 'cash':
        return 'Cash';
      case 'credit':
        return 'Credit';
      case 'split':
        return 'Split';
      case 'unpaid':
        return 'Unpaid';
      default:
        return method;
    }
  };

  const getSaleStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Completed</Badge>;
      case 'voided':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Voided</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge>;
      case 'discarded':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Discarded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">Owner</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Admin</Badge>;
      case 'cashier':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Cashier</Badge>;
      case 'department_staff':
        return <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Dept Staff</Badge>;
      case 'department_stock_manager':
        return <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">Stock Manager</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const primaryDomain = data?.domains?.find((d) => d.is_primary === 1 && d.active === 1)
    ?? data?.domains?.find((d) => d.active === 1);

  const staffLoginUrl = primaryDomain
    ? `https://${primaryDomain.domain}/login`
    : 'https://kiosk.co.ke/login';
  const posLoginUrl = primaryDomain
    ? `https://${primaryDomain.domain}/pos/login`
    : null;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const getUserLoginLabel = (user: User) => {
    if (user.role === 'cashier') {
      return user.pin ? 'Email or PIN' : 'Email login (no PIN set)';
    }
    if (user.role === 'department_staff' || user.role === 'department_stock_manager') {
      return 'Email login';
    }
    return 'Email login';
  };

  const handleOpenSite = async (userId?: string) => {
    setOpeningSiteFor(userId ?? 'owner');
    try {
      const response = await fetch(
        `/api/superadmin/businesses/${businessId}/impersonate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userId ? { userId } : {}),
        },
      );
      const result = await response.json();
      if (result.success && result.data?.loginUrl) {
        window.open(result.data.loginUrl, '_blank', 'noopener,noreferrer');
        toast.success(
          `Opening ${result.data.business.name} as ${result.data.user.name}`,
        );
      } else {
        toast.error(result.message || 'Failed to open site');
      }
    } catch {
      toast.error('Failed to open site');
    } finally {
      setOpeningSiteFor(null);
    }
  };

  const handleResetPassword = (user: User) => {
    toast(`Generate a new password for ${user.name}?`, {
      description: 'The current password cannot be recovered. A new one will be shown once.',
      action: {
        label: 'Reset',
        onClick: async () => {
          setResettingPasswordFor(user.id);
          try {
            const response = await fetch(
              `/api/superadmin/businesses/${businessId}/users/${user.id}/reset-password`,
              { method: 'POST' },
            );
            const result = await response.json();
            if (result.success && result.data?.password) {
              setRevealedPasswords((prev) => ({
                ...prev,
                [user.id]: result.data.password,
              }));
              setShowPasswordFor((prev) => ({ ...prev, [user.id]: true }));
              toast.success(`New password set for ${user.email}`);
            } else {
              toast.error(result.message || 'Failed to reset password');
            }
          } catch {
            toast.error('Failed to reset password');
          } finally {
            setResettingPasswordFor(null);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  return (
    <SuperAdminLayout>
      <div className="p-6 lg:p-8">
        {/* Back Button */}
        <Link
          href="/superadmin/businesses"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Kiosks
        </Link>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : data && (
          <>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-violet-500/20">
                  {data.business.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-white">{data.business.name}</h1>
                    {data.business.active === 1 ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                        Suspended
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-400 flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4" />
                    Created {formatDate(data.business.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleOpenSite()}
                  disabled={openingSiteFor !== null || data.users.length === 0}
                  className="bg-violet-600 hover:bg-violet-500"
                >
                  {openingSiteFor === 'owner' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Open site
                </Button>
                <Button
                  onClick={handleToggleStatus}
                  disabled={updating}
                  variant={data.business.active === 1 ? 'destructive' : 'default'}
                  className={data.business.active === 1 
                    ? 'bg-red-600 hover:bg-red-500' 
                    : 'bg-emerald-600 hover:bg-emerald-500'}
                >
                  {updating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : data.business.active === 1 ? (
                    <XCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {data.business.active === 1 ? 'Suspend Kiosk' : 'Activate Kiosk'}
                </Button>
              </div>
            </div>

            {/* Login Access */}
            <Card className="bg-slate-800 border-slate-700 mb-8">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-violet-400" />
                  Login Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">Staff login URL</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={staffLoginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-white hover:text-violet-400 transition-colors flex items-center gap-1 truncate"
                      >
                        {staffLoginUrl}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(staffLoginUrl, 'Staff login URL')}
                        className="shrink-0 border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {!primaryDomain && (
                      <p className="text-xs text-slate-500 mt-2">
                        No custom domain — sign in on kiosk.co.ke with email below
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-slate-700/50">
                    <p className="text-slate-400 text-sm mb-1">POS login URL (cashier PIN)</p>
                    {posLoginUrl ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={posLoginUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-white hover:text-violet-400 transition-colors flex items-center gap-1 truncate"
                        >
                          {posLoginUrl}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(posLoginUrl, 'POS login URL')}
                          className="shrink-0 border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-amber-400/90 text-sm">
                        Add a domain to enable PIN login at a kiosk URL
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-300 mb-3">User credentials</p>
                  {data.users.length === 0 ? (
                    <p className="text-slate-500 text-sm">No users yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.users.map((user) => {
                        const password = revealedPasswords[user.id];
                        const passwordVisible = showPasswordFor[user.id];
                        const credentialLine = [
                          `URL: ${staffLoginUrl}`,
                          `Email: ${user.email}`,
                          password ? `Password: ${password}` : null,
                          user.pin ? `PIN: ${user.pin}` : null,
                        ]
                          .filter(Boolean)
                          .join('\n');

                        return (
                          <div
                            key={user.id}
                            className="p-4 rounded-xl bg-slate-700/50 border border-slate-600/40"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-white">{user.name}</p>
                                  {getRoleBadge(user.role)}
                                  {user.active === 0 && (
                                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-slate-500 shrink-0 w-16">Email</span>
                                    <span className="text-white font-mono truncate">{user.email}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(user.email, 'Email')}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-white shrink-0"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-slate-500 shrink-0 w-16">Password</span>
                                    {password ? (
                                      <>
                                        <span className="text-violet-300 font-mono truncate">
                                          {passwordVisible ? password : '••••••••'}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            setShowPasswordFor((prev) => ({
                                              ...prev,
                                              [user.id]: !prev[user.id],
                                            }))
                                          }
                                          className="h-7 w-7 p-0 text-slate-400 hover:text-white shrink-0"
                                        >
                                          {passwordVisible ? (
                                            <EyeOff className="w-3 h-3" />
                                          ) : (
                                            <Eye className="w-3 h-3" />
                                          )}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => copyToClipboard(password, 'Password')}
                                          className="h-7 w-7 p-0 text-slate-400 hover:text-white shrink-0"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </Button>
                                      </>
                                    ) : (
                                      <span className="text-slate-500 text-xs">
                                        Encrypted — reset to generate a new one
                                      </span>
                                    )}
                                  </div>

                                  {user.pin && (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-slate-500 shrink-0 w-16">PIN</span>
                                      <span className="text-violet-300 font-mono">{user.pin}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard(user.pin!, 'PIN')}
                                        className="h-7 w-7 p-0 text-slate-400 hover:text-white shrink-0"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 sm:col-span-2">
                                    <span className="text-slate-500 shrink-0 w-16">Method</span>
                                    <span className="text-slate-400 text-xs">{getUserLoginLabel(user)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenSite(user.id)}
                                  disabled={openingSiteFor !== null || user.active === 0}
                                  className="bg-violet-600 hover:bg-violet-500 text-white"
                                >
                                  {openingSiteFor === user.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                  )}
                                  Open as user
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResetPassword(user)}
                                  disabled={resettingPasswordFor === user.id}
                                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                >
                                  {resettingPasswordFor === user.id ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                  )}
                                  Reset password
                                </Button>
                                {credentialLine && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(credentialLine, 'Credentials')}
                                    className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy all
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Users className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{data.business.user_count}</p>
                  <p className="text-xs text-slate-400">Users</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Package className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{data.business.items_count}</p>
                  <p className="text-xs text-slate-400">Items</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <FolderTree className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{data.business.categories_count}</p>
                  <p className="text-xs text-slate-400">Categories</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <ShoppingCart className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{data.business.sales_count}</p>
                  <p className="text-xs text-slate-400">Total Sales</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-emerald-400">
                    {formatCurrency(data.business.total_sales)}
                  </p>
                  <p className="text-xs text-slate-400">Total Revenue</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{data.todayStats.sales_count}</p>
                  <p className="text-xs text-slate-400">Today&apos;s Sales</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <DollarSign className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-violet-400">
                    {formatCurrency(data.todayStats.revenue)}
                  </p>
                  <p className="text-xs text-slate-400">Today&apos;s Revenue</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{data.recentStats.recent_sales}</p>
                  <p className="text-xs text-slate-400">30-Day Sales</p>
                </CardContent>
              </Card>
            </div>

            {/* Inventory & Operations Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Package className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">{data.inventoryStats.active_items}</p>
                  <p className="text-xs text-slate-400">Active Items</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-amber-400">{data.inventoryStats.low_stock}</p>
                  <p className="text-xs text-slate-400">Low Stock</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <XCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-red-400">{data.inventoryStats.out_of_stock}</p>
                  <p className="text-xs text-slate-400">Out of Stock</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Truck className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">{data.inventoryStats.suppliers_count}</p>
                  <p className="text-xs text-slate-400">Suppliers</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Receipt className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">{data.inventoryStats.expenses_count}</p>
                  <p className="text-xs text-slate-400">Expenses</p>
                </CardContent>
              </Card>
            </div>

            {/* Sales period filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-300">Sales period</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filters sales list, top items, and payment breakdown
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {SALES_PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={salesPeriod === option.value ? 'default' : 'outline'}
                    onClick={() => setSalesPeriod(option.value)}
                    disabled={salesLoading}
                    className={
                      salesPeriod === option.value
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="sm:text-right">
                {salesLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-violet-400 sm:ml-auto" />
                ) : (
                  <>
                    <p className="text-lg font-bold text-white">
                      {data.periodStats.sales_count.toLocaleString()} sales
                    </p>
                    <p className="text-sm text-emerald-400 font-semibold">
                      {formatCurrency(data.periodStats.revenue)}
                    </p>
                    <p className="text-xs text-slate-500">{data.periodLabel}</p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {/* Recent Sales */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-emerald-400" />
                    Sales ({data.recentSales.length})
                    <span className="text-sm font-normal text-slate-400">
                      · {data.periodLabel}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                    </div>
                  ) : data.recentSales.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      No sales for {data.periodLabel.toLowerCase()}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {data.recentSales.map((sale) => (
                        <div
                          key={sale.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-white">
                                {formatCurrency(sale.total_amount)}
                              </p>
                              {getSaleStatusBadge(sale.status)}
                              <Badge className="bg-slate-600/50 text-slate-300 border-slate-500/30">
                                {getPaymentLabel(sale.payment_method)}
                              </Badge>
                            </div>
                            <p className="text-slate-400 text-sm mt-1">
                              {sale.cashier_name} · {sale.item_count} item{sale.item_count !== 1 ? 's' : ''}
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {formatDateTime(sale.sale_date ?? sale.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Items */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Top Selling Items
                    <span className="text-sm font-normal text-slate-400">
                      · {data.periodLabel}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                    </div>
                  ) : data.topItems.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      No sales for {data.periodLabel.toLowerCase()}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {data.topItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{item.name}</p>
                            <p className="text-slate-400 text-sm">{item.category_name}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              Stock: {item.current_stock} · Price: {formatCurrency(item.current_sell_price)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-emerald-400 font-semibold">
                              {formatCurrency(item.total_revenue)}
                            </p>
                            <p className="text-slate-500 text-xs">
                              {item.total_quantity_sold} sold
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {/* Categories */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-amber-400" />
                    Categories ({data.categories.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.categories.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No categories yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {data.categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-700/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium text-white truncate">{category.name}</p>
                            {category.active === 0 && (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm shrink-0 ml-3">
                            {category.items_count} item{category.items_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Breakdown */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-violet-400" />
                    Payment Methods
                    <span className="text-sm font-normal text-slate-400">
                      · {data.periodLabel}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                    </div>
                  ) : data.paymentBreakdown.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      No payment data for {data.periodLabel.toLowerCase()}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.paymentBreakdown.map((payment) => (
                        <div
                          key={payment.payment_method}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-700/50"
                        >
                          <div>
                            <p className="font-medium text-white">
                              {getPaymentLabel(payment.payment_method)}
                            </p>
                            <p className="text-slate-500 text-sm">
                              {payment.count} transaction{payment.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <p className="text-emerald-400 font-semibold">
                            {formatCurrency(payment.total)}
                          </p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 mt-3">
                        <p className="font-medium text-violet-300">
                          {data.periodLabel} revenue
                        </p>
                        <p className="text-violet-400 font-bold">
                          {formatCurrency(data.periodStats.revenue)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Users Section */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-violet-400" />
                  Users ({data.users.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.users.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No users yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50"
                      >
                        <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold">
                          {user.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-white truncate">{user.name}</p>
                            {getRoleBadge(user.role)}
                            {user.department && (
                              <Badge className="bg-slate-600/50 text-slate-300 border-slate-500/30">
                                {user.department}
                              </Badge>
                            )}
                            {user.active === 0 && (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <p className="text-slate-500 text-xs flex items-center gap-1">
                              <KeyRound className="w-3 h-3 shrink-0" />
                              {getUserLoginLabel(user)}
                            </p>
                            {user.pin && (
                              <p className="text-violet-300 text-sm font-mono flex items-center gap-1">
                                PIN: {user.pin}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(user.pin!, 'PIN')}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right hidden md:block shrink-0">
                          <p className="text-xs text-slate-500">Joined</p>
                          <p className="text-sm text-slate-300">{formatDate(user.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card className="bg-slate-800 border-slate-700 mt-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-violet-400" />
                  Kiosk Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-slate-700/50">
                    <p className="text-slate-400 text-sm">Currency</p>
                    <p className="text-white font-medium">{data.business.currency}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-700/50">
                    <p className="text-slate-400 text-sm">Timezone</p>
                    <p className="text-white font-medium">{data.business.timezone}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-700/50">
                    <p className="text-slate-400 text-sm">Business ID</p>
                    <p className="text-white font-mono text-sm truncate">{data.business.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Domains Card */}
            <Card className="bg-slate-800 border-slate-700 mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-violet-400" />
                    Domains ({data.domains?.length || 0})
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setDomainDrawerOpen(true)}
                    className="bg-violet-600 hover:bg-violet-500"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Domain
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!data.domains || data.domains.length === 0 ? (
                  <div className="text-center py-8">
                    <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 mb-4">No domains configured</p>
                    <p className="text-slate-600 text-sm mb-4">
                      Add a domain to allow customers to access this kiosk via a custom URL
                    </p>
                    <Button
                      onClick={() => setDomainDrawerOpen(true)}
                      className="bg-violet-600 hover:bg-violet-500"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Domain
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.domains.map((domain) => (
                      <div
                        key={domain.id}
                        className={`flex items-center gap-4 p-4 rounded-xl ${
                          domain.active === 1 ? 'bg-slate-700/50' : 'bg-slate-700/30 opacity-60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`https://${domain.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-white hover:text-violet-400 transition-colors flex items-center gap-1"
                            >
                              {domain.domain}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {domain.is_primary === 1 && (
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                                <Star className="w-3 h-3 mr-1" />
                                Primary
                              </Badge>
                            )}
                            {domain.active === 0 && (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                Suspended
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs mt-1">
                            Added {formatDate(domain.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {domain.is_primary === 0 && domain.active === 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetPrimary(domain.id)}
                              className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                            >
                              <Star className="w-3 h-3 mr-1" />
                              Set Primary
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleDomainStatus(domain)}
                            className={domain.active === 1 
                              ? 'text-red-400 border-red-500/30 hover:bg-red-500/10'
                              : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                            }
                          >
                            {domain.active === 1 ? (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteDomain(domain.id)}
                            disabled={deletingDomainId === domain.id}
                            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            {deletingDomainId === domain.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Add Domain Drawer */}
        <Drawer open={domainDrawerOpen} onOpenChange={setDomainDrawerOpen}>
          <DrawerContent className="bg-slate-900 border-slate-700">
            <DrawerHeader>
              <DrawerTitle className="text-white">Add Domain</DrawerTitle>
              <DrawerDescription className="text-slate-400">
                Map a domain or subdomain to this kiosk. Make sure DNS is configured to point to your server.
              </DrawerDescription>
            </DrawerHeader>
            <form onSubmit={handleAddDomain} className="p-4 space-y-4">
              <div>
                <Label htmlFor="domain" className="text-white">Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="e.g., shop.example.com or example.co.ke"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter the full domain without https://
                </p>
              </div>
              
              {domainError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{domainError}</p>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={addingDomain || !newDomain.trim()}
                  className="flex-1 bg-violet-600 hover:bg-violet-500"
                >
                  {addingDomain ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Domain
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDomainDrawerOpen(false);
                    setNewDomain('');
                    setDomainError(null);
                  }}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DrawerContent>
        </Drawer>
      </div>
    </SuperAdminLayout>
  );
}
