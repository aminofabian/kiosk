'use client';

import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/layouts/superadmin-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Building2,
  Plus,
  Search,
  Users,
  DollarSign,
  ShoppingCart,
  Loader2,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Activity,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Business {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  active: number;
  created_at: number;
  user_count: number;
  total_sales: number;
  sales_count: number;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  variant = 'default',
  color = 'violet'
}: {
  title: string;
  value: string | number;
  icon: any;
  variant?: 'default' | 'primary';
  color?: 'violet' | 'emerald' | 'red';
}) => (
  <Card className={cn(
    "relative overflow-hidden transition-all duration-500 hover:scale-[1.02] group border-white/5",
    variant === 'primary'
      ? "bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 border-0 text-white shadow-xl shadow-violet-500/20"
      : "bg-slate-900/40 backdrop-blur-md border-white/5 hover:bg-slate-800/60"
  )}>
    {/* Highlight Top Border */}
    <div className={cn(
      "absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500",
      variant === 'primary' ? "bg-white/30" :
        color === 'emerald' ? "bg-emerald-500/50" :
          color === 'red' ? "bg-red-500/50" :
            "bg-violet-500/50"
    )} />

    <CardContent className="p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 relative z-10">
        <div className="space-y-0.5 sm:space-y-1">
          <p className={cn(
            "text-[10px] sm:text-xs font-black uppercase tracking-wider leading-none",
            variant === 'primary' ? "text-violet-200" : "text-slate-500"
          )}>{title}</p>
          <h3 className={cn(
            "text-base sm:text-xl font-bold leading-none drop-shadow-sm",
            variant === 'primary' ? "text-white" :
              color === 'emerald' ? "text-emerald-400" :
                color === 'red' ? "text-red-400" : "text-slate-200"
          )}>{value}</h3>
        </div>
        <div className={cn(
          "p-2 sm:p-3 rounded-lg sm:rounded-2xl transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 shadow-lg w-fit",
          variant === 'primary' ? "bg-white/10 ring-1 ring-white/20 shadow-violet-900/20" :
            color === 'emerald' ? "bg-emerald-500/10 border border-emerald-500/20 shadow-emerald-900/10" :
              color === 'red' ? "bg-red-500/10 border border-red-500/20 shadow-red-900/10" :
                "bg-violet-500/10 border border-violet-500/20 shadow-violet-900/10"
        )}>
          <Icon className={cn(
            "w-4 h-4 sm:w-5 sm:h-5",
            variant === 'primary' ? "text-white" :
              color === 'emerald' ? "text-emerald-500" :
                color === 'red' ? "text-red-500" : "text-violet-400"
          )} />
        </div>
      </div>

      {/* Ambient Glow */}
      <div className={cn(
        "absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-2xl opacity-10 transition-opacity duration-500 group-hover:opacity-30",
        variant === 'primary' ? "bg-white" :
          color === 'emerald' ? "bg-emerald-500" :
            color === 'red' ? "bg-red-500" : "bg-violet-600"
      )} />
    </CardContent>
  </Card>
);

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
  });

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superadmin/businesses');
      const result = await response.json();
      if (result.success) {
        setBusinesses(result.data);
      } else {
        setError(result.message || 'Failed to load businesses');
      }
    } catch {
      setError('Failed to load businesses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setCreating(true);

    try {
      const response = await fetch('/api/superadmin/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setDrawerOpen(false);
        setFormData({
          name: '',
          ownerName: '',
          ownerEmail: '',
          ownerPassword: '',
          currency: 'KES',
          timezone: 'Africa/Nairobi',
        });
        fetchBusinesses();
      } else {
        setFormError(result.message || 'Failed to create business');
      }
    } catch {
      setFormError('An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredBusinesses = businesses.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = businesses.filter((b) => b.active === 1).length;
  const suspendedCount = businesses.filter((b) => b.active === 0).length;

  return (
    <SuperAdminLayout>
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Kiosks <span className="text-violet-500">Management</span></h1>
            <p className="text-slate-400 font-medium">Manage and monitor all point-of-sale kiosks on your platform.</p>
          </div>
          <Button
            size="lg"
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-600/20 active:scale-95 transition-all"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            New Kiosk
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <StatCard
            title="Total Kiosks"
            value={businesses.length}
            icon={Building2}
          />
          <StatCard
            title="Active"
            value={activeCount}
            icon={CheckCircle}
            color="emerald"
          />
          <StatCard
            title="Suspended"
            value={suspendedCount}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Search & Actions */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
          </div>
          <Input
            type="text"
            placeholder="Search kiosks by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 bg-slate-900/50 backdrop-blur-sm border-slate-800/80 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all rounded-2xl text-lg"
          />
        </div>

        {/* Businesses List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em] text-xs">Syncing Kiosks</p>
          </div>
        ) : error ? (
          <Card className="bg-red-500/5 border-red-500/20 py-12 text-center rounded-3xl">
            <XCircle className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
            <p className="text-red-400 font-bold mb-4">{error}</p>
            <Button variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl" onClick={fetchBusinesses}>
              Try Again
            </Button>
          </Card>
        ) : filteredBusinesses.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
            <Activity className="w-16 h-16 text-slate-700 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-slate-400">{searchQuery ? 'No kiosks found' : 'No kiosks yet'}</h3>
            <p className="text-slate-500 mt-2">Try adjusting your search or add a new kiosk to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            {filteredBusinesses.map((business) => (
              <Link key={business.id} href={`/superadmin/businesses/${business.id}`}>
                <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 hover:border-violet-500/30 transition-all duration-300 cursor-pointer group shadow-sm hover:shadow-violet-500/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-6">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-black text-3xl shadow-lg ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 shrink-0">
                        {business.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                          <h3 className="font-black text-white text-xl truncate group-hover:text-violet-400 transition-colors">
                            {business.name}
                          </h3>
                          <div className="flex items-center justify-center sm:justify-start gap-2">
                            {business.active === 1 ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                Suspended
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-4 text-slate-500 font-medium text-sm">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-500" />
                            Joined {formatDate(business.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 px-8 py-3 bg-slate-800/20 rounded-2xl border border-slate-700/30">
                        <div className="text-center group-hover:scale-105 transition-transform">
                          <p className="text-xs font-black uppercase text-slate-500 tracking-wider mb-1">Users</p>
                          <p className="text-lg font-black text-white">{business.user_count}</p>
                        </div>
                        <div className="w-px h-8 bg-slate-700/50" />
                        <div className="text-center group-hover:scale-105 transition-transform">
                          <p className="text-xs font-black uppercase text-slate-500 tracking-wider mb-1">Sales</p>
                          <p className="text-lg font-black text-white">{business.sales_count}</p>
                        </div>
                        <div className="w-px h-8 bg-slate-700/50" />
                        <div className="text-right group-hover:scale-110 transition-transform">
                          <p className="text-xs font-black uppercase text-emerald-500/60 tracking-wider mb-1">Revenue</p>
                          <p className="text-lg font-black text-emerald-400">
                            {formatCurrency(business.total_sales)}
                          </p>
                        </div>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 hidden lg:block">
                        <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-600/20">
                          <ArrowUpRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Create Business Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen bg-slate-950 border-slate-800 border-l p-0 outline-none">
            <div className="flex flex-col h-full bg-slate-950">
              <DrawerHeader className="p-8 border-b border-white/5 bg-slate-900/50">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <Building2 className="w-7 h-7 text-violet-500" />
                </div>
                <DrawerTitle className="text-3xl font-black text-white">Create New Kiosk</DrawerTitle>
                <DrawerDescription className="text-slate-400 font-medium text-lg">
                  Register a new business entity on the platform.
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto p-8">
                <form onSubmit={handleCreateBusiness} className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase text-slate-500 tracking-wider">Kiosk Identity</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Starline Grocery"
                      required
                      className="h-14 bg-slate-900 border-slate-800 text-white text-lg focus:border-violet-500 rounded-xl px-4"
                    />
                    <p className="text-xs text-slate-500 font-medium">This is the name customers will see on receipts.</p>
                  </div>

                  <div className="pt-4 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-800" />
                      <span className="text-[10px] font-black tracking-[0.2em] text-slate-600 uppercase">Owner Credentials</span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>

                    <div className="grid gap-6">
                      <div className="space-y-3">
                        <Label className="text-slate-400 font-bold">Owner Full Name</Label>
                        <Input
                          value={formData.ownerName}
                          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                          placeholder="Admin account name"
                          required
                          className="h-12 bg-slate-900 border-slate-800 text-white rounded-xl"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-slate-400 font-bold">Primary Email</Label>
                        <Input
                          type="email"
                          value={formData.ownerEmail}
                          onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                          placeholder="owner@kiosk.com"
                          required
                          className="h-12 bg-slate-900 border-slate-800 text-white rounded-xl"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-slate-400 font-bold">Access Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.ownerPassword}
                            onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                            placeholder="Min. 8 characters"
                            required
                            minLength={8}
                            className="h-12 bg-slate-900 border-slate-800 text-white pr-12 rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold animate-in slide-in-from-top-2">
                      {formError}
                    </div>
                  )}

                  <div className="flex gap-4 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="flex-1 border-slate-800 text-slate-400 hover:bg-slate-900 rounded-xl font-bold"
                      onClick={() => setDrawerOpen(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 rounded-xl font-black"
                      disabled={creating}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Initialize Kiosk'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </SuperAdminLayout>
  );
}
