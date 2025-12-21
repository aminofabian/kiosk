'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { SuperAdminLayout } from '@/components/layouts/superadmin-layout';
import { Card, CardContent } from '@/components/ui/card';
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
  Users,
  Plus,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Shield,
  Mail,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  UserCog,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/utils/api-client';

interface Admin {
  id: string;
  email: string;
  name: string;
  active: number;
  created_at: number;
}

type DrawerMode = 'create' | 'edit';

export default function AdminsPage() {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create');
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const result = await apiGet<Admin[]>('/api/superadmin/admins');
      if (result.success) {
        setAdmins(result.data ?? []);
      } else {
        setError(result.message || 'Failed to load admins');
      }
    } catch {
      setError('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setSelectedAdmin(null);
    setFormData({ name: '', email: '', password: '' });
    setFormError('');
    setShowPassword(false);
    setDrawerOpen(true);
  };

  const openEditDrawer = (admin: Admin) => {
    setDrawerMode('edit');
    setSelectedAdmin(admin);
    setFormData({ name: admin.name, email: admin.email, password: '' });
    setFormError('');
    setShowPassword(false);
    setMenuOpenId(null);
    setDrawerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (drawerMode === 'create') {
        const result = await apiPost('/api/superadmin/admins', formData);
        if (result.success) {
          setDrawerOpen(false);
          fetchAdmins();
        } else {
          setFormError(result.message || 'Failed to create admin');
        }
      } else if (selectedAdmin) {
        const updateData: Record<string, string | number> = {
          name: formData.name,
          email: formData.email,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        const result = await apiPut(`/api/superadmin/admins/${selectedAdmin.id}`, updateData);
        if (result.success) {
          setDrawerOpen(false);
          fetchAdmins();
        } else {
          setFormError(result.message || 'Failed to update admin');
        }
      }
    } catch {
      setFormError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (admin: Admin) => {
    setMenuOpenId(null);
    try {
      const result = await apiPut(`/api/superadmin/admins/${admin.id}`, {
        active: admin.active === 1 ? 0 : 1,
      });
      if (result.success) {
        fetchAdmins();
      } else {
        alert(result.message || 'Failed to update admin');
      }
    } catch {
      alert('Failed to update admin');
    }
  };

  const handleDelete = async (admin: Admin) => {
    setMenuOpenId(null);
    if (!confirm(`Are you sure you want to delete ${admin.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await apiDelete(`/api/superadmin/admins/${admin.id}`);
      if (result.success) {
        fetchAdmins();
      } else {
        alert(result.message || 'Failed to delete admin');
      }
    } catch {
      alert('Failed to delete admin');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredAdmins = admins.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = admins.filter((a) => a.active === 1).length;
  const inactiveCount = admins.filter((a) => a.active === 0).length;
  const currentUserId = session?.user?.id;

  return (
    <SuperAdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Platform Admins</h1>
            <p className="text-slate-400">Manage super admin accounts with full platform access</p>
          </div>
          <Button
            className="bg-violet-600 hover:bg-violet-500 text-white"
            onClick={openCreateDrawer}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Admin
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Admins</p>
                <p className="text-2xl font-bold text-white">{admins.length}</p>
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
                <p className="text-slate-400 text-sm">Inactive</p>
                <p className="text-2xl font-bold text-red-400">{inactiveCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500"
          />
        </div>

        {/* Admins List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {searchQuery ? 'No admins found matching your search' : 'No admins yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAdmins.map((admin) => {
              const isCurrentUser = admin.id === currentUserId;
              return (
                <Card
                  key={admin.id}
                  className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        {admin.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white text-lg truncate">
                            {admin.name}
                          </h3>
                          {isCurrentUser && (
                            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">
                              You
                            </Badge>
                          )}
                          {admin.active === 1 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" />
                            {admin.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Joined {formatDate(admin.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white hover:bg-slate-700"
                          onClick={() => setMenuOpenId(menuOpenId === admin.id ? null : admin.id)}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                        {menuOpenId === admin.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-10 py-1">
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                              onClick={() => openEditDrawer(admin)}
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                            {!isCurrentUser && (
                              <>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                                  onClick={() => handleToggleActive(admin)}
                                >
                                  <UserCog className="w-4 h-4" />
                                  {admin.active === 1 ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2"
                                  onClick={() => handleDelete(admin)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Admin Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen bg-slate-900 border-slate-700">
            <DrawerHeader className="border-b border-slate-700 bg-slate-800">
              <DrawerTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-500" />
                {drawerMode === 'create' ? 'Add New Admin' : 'Edit Admin'}
              </DrawerTitle>
              <DrawerDescription className="text-slate-400">
                {drawerMode === 'create'
                  ? 'Create a new super admin account with full platform access'
                  : 'Update admin account details'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto p-6 flex-1">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., John Doe"
                    required
                    className="h-12 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@example.com"
                    required
                    className="h-12 bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">
                    Password {drawerMode === 'edit' && '(leave blank to keep current)'}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={drawerMode === 'create' ? 'Min 8 characters' : '••••••••'}
                      required={drawerMode === 'create'}
                      minLength={drawerMode === 'create' ? 8 : undefined}
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
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-violet-600 hover:bg-violet-500"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {drawerMode === 'create' ? 'Creating...' : 'Saving...'}
                      </>
                    ) : drawerMode === 'create' ? (
                      'Create Admin'
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Click outside to close menu */}
        {menuOpenId && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setMenuOpenId(null)}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
