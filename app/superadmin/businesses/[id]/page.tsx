'use client';

import { useEffect, useState } from 'react';
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
  Plus,
  Trash2,
  Star,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
  recentStats: {
    recent_sales: number;
    recent_revenue: number;
  };
}

export default function BusinessDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<BusinessDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  
  // Domain management state
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);

  const businessId = params.id as string;

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const response = await fetch(`/api/superadmin/businesses/${businessId}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load business');
        }
      } catch {
        setError('Failed to load business');
      } finally {
        setLoading(false);
      }
    }
    fetchBusiness();
  }, [businessId]);

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
        const refreshResponse = await fetch(`/api/superadmin/businesses/${businessId}`);
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

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;
    
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
      }
    } catch {
      // Handle error silently
    } finally {
      setDeletingDomainId(null);
    }
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">Owner</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Admin</Badge>;
      case 'cashier':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">Cashier</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
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

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
                  <DollarSign className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-violet-400">
                    {formatCurrency(data.recentStats.recent_revenue)}
                  </p>
                  <p className="text-xs text-slate-400">30-Day Revenue</p>
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{user.name}</p>
                            {getRoleBadge(user.role)}
                            {user.active === 0 && (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                        <div className="text-right hidden md:block">
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
