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
} from 'lucide-react';
import Link from 'next/link';

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
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Kiosks</h1>
            <p className="text-slate-400">Manage all registered kiosks on the platform</p>
          </div>
          <Button
            className="bg-violet-600 hover:bg-violet-500 text-white"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Kiosk
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Kiosks</p>
                <p className="text-2xl font-bold text-white">{businesses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Active</p>
                <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Suspended</p>
                <p className="text-2xl font-bold text-red-400">{suspendedCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search kiosks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500"
          />
        </div>

        {/* Businesses List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchQuery ? 'No kiosks found matching your search' : 'No kiosks yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBusinesses.map((business) => (
              <Link key={business.id} href={`/superadmin/businesses/${business.id}`}>
                <Card className="bg-slate-800 border-slate-700 hover:border-violet-500/50 transition-colors cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        {business.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-lg truncate">
                            {business.name}
                          </h3>
                          {business.active === 1 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                              Suspended
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm">
                          Created {formatDate(business.created_at)}
                        </p>
                      </div>
                      <div className="hidden md:flex items-center gap-6">
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-slate-400">
                            <Users className="w-4 h-4" />
                            <span className="text-white font-semibold">{business.user_count}</span>
                          </div>
                          <p className="text-xs text-slate-500">Users</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-slate-400">
                            <ShoppingCart className="w-4 h-4" />
                            <span className="text-white font-semibold">{business.sales_count}</span>
                          </div>
                          <p className="text-xs text-slate-500">Sales</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-slate-400">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-emerald-400 font-semibold">
                              {formatCurrency(business.total_sales)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">Revenue</p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Create Business Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen bg-slate-900 border-slate-700">
            <DrawerHeader className="border-b border-slate-700 bg-slate-800">
              <DrawerTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-500" />
                Create New Kiosk
              </DrawerTitle>
              <DrawerDescription className="text-slate-400">
                Set up a new kiosk with its owner account
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto p-6 flex-1">
              <form onSubmit={handleCreateBusiness} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">Kiosk Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Downtown Grocery"
                    required
                    className="h-12 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="border-t border-slate-700 pt-6">
                  <p className="text-slate-300 font-medium mb-4">Owner Account</p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Owner Name *</Label>
                      <Input
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        placeholder="e.g., John Doe"
                        required
                        className="h-12 bg-slate-800 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Owner Email *</Label>
                      <Input
                        type="email"
                        value={formData.ownerEmail}
                        onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                        placeholder="owner@example.com"
                        required
                        className="h-12 bg-slate-800 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Owner Password *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.ownerPassword}
                          onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                          placeholder="Min 8 characters"
                          required
                          minLength={8}
                          className="h-12 bg-slate-800 border-slate-700 text-white pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {formError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={() => setDrawerOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-violet-600 hover:bg-violet-500"
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Kiosk'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </SuperAdminLayout>
  );
}
