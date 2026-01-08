'use client';

import { useEffect, useState } from 'react';
import { SuperAdminLayout } from '@/components/layouts/superadmin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Building2,
  Globe,
  Database,
  Shield,
  Loader2,
  CheckCircle,
  Copy,
  RefreshCw,
  Server,
  HardDrive,
  Clock,
  Users,
  ShoppingCart,
  Package,
  Layers,
  Cpu,
  Fingerprint,
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils';

interface PlatformStats {
  businesses: number;
  users: number;
  sales: number;
  items: number;
  categories: number;
  domains: number;
  superAdmins: number;
}

interface SystemInfo {
  nodeVersion: string;
  platform: string;
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
  };
}

export default function SettingsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Default settings state (these would typically be stored in a database)
  const [defaultSettings, setDefaultSettings] = useState({
    defaultCurrency: 'KES',
    defaultTimezone: 'Africa/Nairobi',
    platformName: 'Kiosk POS Platform',
    supportEmail: 'support@kiosk.co.ke',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiGet<{ stats: PlatformStats; system: SystemInfo }>('/api/superadmin/settings');
      if (result.success && result.data) {
        setStats(result.data.stats);
        setSystemInfo(result.data.system);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '< 1m';
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <SuperAdminLayout>
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Platform <span className="text-violet-500">Settings</span></h1>
          <p className="text-slate-400 font-medium">Fine-tune your POS platform and monitor core system health.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em] text-xs">Fetching configuration</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Left Column - Forms */}
            <div className="xl:col-span-7 space-y-8">
              {/* Platform Info */}
              <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
                <CardHeader className="bg-slate-800/20 border-b border-slate-800 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black text-white">Platform Identity</CardTitle>
                      <CardDescription className="text-slate-500 font-medium">Core branding and support details.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Platform Public Name</Label>
                      <Input
                        value={defaultSettings.platformName}
                        onChange={(e) => setDefaultSettings({ ...defaultSettings, platformName: e.target.value })}
                        className="h-12 bg-slate-950 border-slate-800 text-white focus:border-violet-500 rounded-xl px-4"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Support Contact Email</Label>
                      <Input
                        type="email"
                        value={defaultSettings.supportEmail}
                        onChange={(e) => setDefaultSettings({ ...defaultSettings, supportEmail: e.target.value })}
                        className="h-12 bg-slate-950 border-slate-800 text-white focus:border-violet-500 rounded-xl px-4"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Default Business Settings */}
              <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
                <CardHeader className="bg-slate-800/20 border-b border-slate-800 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600/10 flex items-center justify-center">
                      <Settings className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black text-white">Provisioning Defaults</CardTitle>
                      <CardDescription className="text-slate-500 font-medium">Automatic settings for newly registered kiosks.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Default Currency</Label>
                      <Input
                        value={defaultSettings.defaultCurrency}
                        onChange={(e) => setDefaultSettings({ ...defaultSettings, defaultCurrency: e.target.value })}
                        className="h-12 bg-slate-950 border-slate-800 text-white focus:border-violet-500 rounded-xl px-4"
                      />
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">ISO-4217 Code (e.g. KES, USD)</p>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">System Timezone</Label>
                      <Input
                        value={defaultSettings.defaultTimezone}
                        onChange={(e) => setDefaultSettings({ ...defaultSettings, defaultTimezone: e.target.value })}
                        className="h-12 bg-slate-950 border-slate-800 text-white focus:border-violet-500 rounded-xl px-4"
                      />
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">IANA Identifier (e.g. Africa/Nairobi)</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500 font-medium italic">Changes will take effect for new registrations only.</p>
                    <Button className="bg-violet-600 hover:bg-violet-500 font-black px-6 rounded-xl shadow-lg shadow-violet-600/20" disabled>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Save Defaults
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* API and Integration */}
              <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
                <CardHeader className="bg-slate-800/20 border-b border-slate-800 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-600/10 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black text-white">API Configuration</CardTitle>
                      <CardDescription className="text-slate-500 font-medium">Manage access and integration endpoints.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/50 group">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Base API Endpoint</Label>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px] font-black tracking-widest uppercase">Stable v1</Badge>
                    </div>
                    <div className="flex gap-3">
                      <code className="flex-1 bg-slate-900 border border-slate-800/50 rounded-lg px-4 py-2 font-mono text-sm text-violet-300 overflow-x-auto whitespace-nowrap scrollbar-hide">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/api
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/api`, 'api')}
                        className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg hover:text-white"
                      >
                        {copied === 'api' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center py-8 bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                    <Fingerprint className="w-12 h-12 text-slate-700 mb-3 opacity-50" />
                    <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Security Infrastructure</p>
                    <p className="text-slate-600 text-sm mt-1">API Key Management coming in v1.1</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Stats & Info */}
            <div className="xl:col-span-5 space-y-8">
              {/* Platform Statistics */}
              <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
                <CardHeader className="bg-slate-800/20 border-b border-slate-800 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-violet-400" />
                      Platform Footprint
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={fetchData}
                    className="text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  {stats ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Businesses', value: stats.businesses, icon: Building2, color: 'text-violet-400' },
                        { label: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-400' },
                        { label: 'Super Admins', value: stats.superAdmins, icon: Shield, color: 'text-purple-400' },
                        { label: 'Live Domains', value: stats.domains, icon: Globe, color: 'text-emerald-400' },
                        { label: 'Total Items', value: stats.items.toLocaleString(), icon: Package, color: 'text-amber-400' },
                        { label: 'Processed Sales', value: stats.sales.toLocaleString(), icon: ShoppingCart, color: 'text-rose-400' },
                      ].map((s, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/50 transition-all hover:border-slate-700/50 hover:bg-slate-950">
                          <s.icon className={cn("w-5 h-5 mb-3", s.color)} />
                          <p className="text-2xl font-black text-white leading-none">{s.value}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">{s.label}</p>
                        </div>
                      ))}
                      <div className="col-span-2 p-4 rounded-2xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">Inventory Distribution</p>
                          <p className="text-xl font-black text-white">{stats.categories} Categories</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">Failed to sync statistics</p>
                  )}
                </CardContent>
              </Card>

              {/* System Health */}
              <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800/50 rounded-2xl overflow-hidden shadow-2xl">
                <CardHeader className="bg-slate-800/20 border-b border-slate-800 p-6">
                  <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-emerald-400" />
                    System Runtime
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800/50 group">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                        <span className="text-slate-400 font-bold text-sm">Service Uptime</span>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black px-3 rounded-lg">
                        {systemInfo ? formatUptime(systemInfo.uptime) : 'SYNCING...'}
                      </Badge>
                    </div>

                    <div className="flex flex-col p-4 rounded-2xl bg-slate-950 border border-slate-800/50 group space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <HardDrive className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                          <span className="text-slate-400 font-bold text-sm">Memory Index</span>
                        </div>
                        <span className="text-xs font-black text-slate-500">
                          {systemInfo ? `${formatBytes(systemInfo.memoryUsage.used)} / ${formatBytes(systemInfo.memoryUsage.total)}` : '-- / --'}
                        </span>
                      </div>
                      {systemInfo && (
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-1000"
                            style={{ width: `${(systemInfo.memoryUsage.used / systemInfo.memoryUsage.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/50">
                        <p className="text-[10px] font-black uppercase tracking-tighter text-slate-600 mb-1">Architecture</p>
                        <p className="text-sm font-black text-slate-300 font-mono">{systemInfo?.platform || 'Unknown'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/50">
                        <p className="text-[10px] font-black uppercase tracking-tighter text-slate-600 mb-1">Node Runtime</p>
                        <p className="text-sm font-black text-slate-300 font-mono">{systemInfo?.nodeVersion || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Engine Credits */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500">
                  <Server className="w-24 h-24" />
                </div>
                <div className="flex items-center gap-4 relative z-10 transition-transform duration-300 group-hover:scale-[1.02]">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-600/20">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-lg leading-tight">Antigravity Kiosk <span className="text-violet-500">POS</span></h3>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-1">Multi-Tenant Engine v1.0.1</p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-800/50 flex items-center justify-between relative z-10">
                  <Badge className="bg-slate-800 text-slate-400 border-0 font-bold px-3">Stable Core</Badge>
                  <p className="text-[10px] font-black text-slate-600 italic">Built for performance & scale</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
