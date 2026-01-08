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
  Activity,
  UserCheck,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils';

interface Admin {
  id: string;
  email: string;
  name: string;
  active: number;
  created_at: number;
}

type DrawerMode = 'create' | 'edit';

const StatCard = ({
  title,
  value,
  icon: Icon,
  color = 'violet'
}: {
  title: string;
  value: string | number;
  icon: any;
  color?: 'violet' | 'emerald' | 'red';
}) => (
  <Card className="relative overflow-hidden bg-slate-900/40 backdrop-blur-md border border-white/5 hover:bg-slate-800/60 transition-all duration-500 hover:scale-[1.02] group">
    {/* Highlight Top Border */}
    <div className={cn(
      "absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500",
      color === 'emerald' ? "bg-emerald-500/50" :
        color === 'red' ? "bg-red-500/50" :
          "bg-violet-500/50"
    )} />

    <CardContent className="p-3 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 relative z-10">
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 leading-none">{title}</p>
          <h3 className={cn(
            "text-base sm:text-xl font-bold leading-none drop-shadow-sm",
            color === 'emerald' ? "text-emerald-400" :
              color === 'red' ? "text-red-400" : "text-slate-200"
          )}>{value}</h3>
        </div>
        <div className={cn(
          "p-2 sm:p-3 rounded-lg sm:rounded-2xl transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 shadow-lg w-fit",
          color === 'emerald' ? "bg-emerald-500/10 border border-emerald-500/20 shadow-emerald-900/10" :
            color === 'red' ? "bg-red-500/10 border border-red-500/20 shadow-red-900/10" :
              "bg-violet-500/10 border border-violet-500/20 shadow-violet-900/10"
        )}>
          <Icon className={cn(
            "w-4 h-4 sm:w-5 sm:h-5",
            color === 'emerald' ? "text-emerald-500" :
              color === 'red' ? "text-red-500" : "text-violet-400"
          )} />
        </div>
      </div>

      {/* Ambient Glow */}
      <div className={cn(
        "absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-2xl opacity-10 transition-opacity duration-500 group-hover:opacity-30",
        color === 'emerald' ? "bg-emerald-500" :
          color === 'red' ? "bg-red-500" : "bg-violet-600"
      )} />
    </CardContent>
  </Card>
);

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
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Platform <span className="text-violet-500">Admins</span></h1>
            <p className="text-slate-400 font-medium">Manage super admin accounts with full platform control.</p>
          </div>
          <Button
            size="lg"
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-600/20 active:scale-95 transition-all"
            onClick={openCreateDrawer}
          >
            <Plus className="w-5 h-5 mr-2" />
            New Admin
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <StatCard title="Total Admins" value={admins.length} icon={Users} />
          <StatCard title="Active" value={activeCount} icon={CheckCircle} color="emerald" />
          <StatCard title="Inactive" value={inactiveCount} icon={XCircle} color="red" />
        </div>

        {/* Search */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
          </div>
          <Input
            type="text"
            placeholder="Search by name or email address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 bg-slate-900/50 backdrop-blur-sm border-slate-800/80 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all rounded-2xl text-lg"
          />
        </div>

        {/* Admins List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em] text-xs">Accessing Records</p>
          </div>
        ) : error ? (
          <Card className="bg-red-500/5 border-red-500/20 py-12 text-center rounded-3xl">
            <XCircle className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
            <p className="text-red-400 font-bold mb-4">{error}</p>
            <Button variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl" onClick={fetchAdmins}>
              Try Again
            </Button>
          </Card>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800 text-slate-500 font-medium">
            <Users className="w-16 h-16 text-slate-700 mx-auto mb-4 opacity-50" />
            <p>{searchQuery ? 'No admins found matching your search' : 'No admins registered yet'}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAdmins.map((admin) => {
              const isCurrentUser = admin.id === currentUserId;
              return (
                <Card
                  key={admin.id}
                  className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 hover:border-violet-500/30 transition-all duration-300 rounded-2xl group overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div className="flex items-center gap-6 p-5">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-black text-2xl shadow-lg ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2">
                        {admin.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-black text-white text-lg truncate group-hover:text-violet-400 transition-colors">
                            {admin.name}
                          </h3>
                          <div className="flex gap-2">
                            {isCurrentUser && (
                              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 font-black">
                                YOU
                              </Badge>
                            )}
                            {admin.active === 1 ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold rounded-lg flex items-center gap-1.5 px-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 font-bold rounded-lg flex items-center gap-1.5 px-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 mt-2 text-slate-500 font-medium text-sm">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-slate-600" />
                            {admin.email}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-slate-600" />
                            Joined {formatDate(admin.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                          onClick={() => setMenuOpenId(menuOpenId === admin.id ? null : admin.id)}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                        {menuOpenId === admin.id && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-200">
                            <button
                              className="w-full px-4 py-3 text-left text-sm font-bold text-slate-300 hover:bg-slate-800 flex items-center gap-3 transition-colors"
                              onClick={() => openEditDrawer(admin)}
                            >
                              <Pencil className="w-4 h-4 text-violet-400" />
                              Edit Profile
                            </button>
                            {!isCurrentUser && (
                              <>
                                <button
                                  className="w-full px-4 py-3 text-left text-sm font-bold text-slate-300 hover:bg-slate-800 flex items-center gap-3 transition-colors"
                                  onClick={() => handleToggleActive(admin)}
                                >
                                  <UserCog className="w-4 h-4 text-amber-400" />
                                  {admin.active === 1 ? 'Deactivate Account' : 'Activate Account'}
                                </button>
                                <div className="mx-2 my-1 border-t border-slate-800" />
                                <button
                                  className="w-full px-4 py-3 text-left text-sm font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                  onClick={() => handleDelete(admin)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Permanently
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
          <DrawerContent className="!w-full sm:!w-[500px] !max-w-none h-full max-h-screen bg-slate-950 border-slate-800 border-l p-0 outline-none">
            <div className="flex flex-col h-full bg-slate-950">
              <DrawerHeader className="p-8 border-b border-white/5 bg-slate-900/50">
                <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-violet-500" />
                </div>
                <DrawerTitle className="text-3xl font-black text-white">
                  {drawerMode === 'create' ? 'Add New Admin' : 'Edit Admin'}
                </DrawerTitle>
                <DrawerDescription className="text-slate-400 font-medium text-lg">
                  {drawerMode === 'create'
                    ? 'Create a new super admin account with full access.'
                    : 'Update existing admin account details.'}
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto p-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase text-slate-500 tracking-wider">Full Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., John Smith"
                      required
                      className="h-14 bg-slate-900 border-slate-800 text-white text-lg focus:border-violet-500 rounded-xl px-4"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase text-slate-500 tracking-wider">Email Address</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="admin@platform.com"
                      required
                      className="h-14 bg-slate-900 border-slate-800 text-white text-lg focus:border-violet-500 rounded-xl px-4"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase text-slate-500 tracking-wider">
                      Access Password {drawerMode === 'edit' && '(Optional)'}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={drawerMode === 'create' ? 'Min. 8 characters' : 'Leave blank to keep same'}
                        required={drawerMode === 'create'}
                        minLength={drawerMode === 'create' ? 8 : undefined}
                        className="h-14 bg-slate-900 border-slate-800 text-white text-lg focus:border-violet-500 rounded-xl px-4 pr-12"
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
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 rounded-xl font-black"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : drawerMode === 'create' ? (
                        'Register Admin'
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Click outside to close menu backdrop */}
        {menuOpenId && (
          <div
            className="fixed inset-0 z-10 bg-black/5 cursor-default"
            onClick={() => setMenuOpenId(null)}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
