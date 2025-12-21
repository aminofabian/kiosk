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
} from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';

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
    supportEmail: 'support@kiosk.ke',
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
      <div className="p-6 lg:p-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Platform Settings</h1>
          <p className="text-slate-400">Configure platform-wide settings and view system information</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Platform Info */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-violet-400" />
                  Platform Information
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Basic information about your POS platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Platform Name</Label>
                    <Input
                      value={defaultSettings.platformName}
                      onChange={(e) => setDefaultSettings({ ...defaultSettings, platformName: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Support Email</Label>
                    <Input
                      type="email"
                      value={defaultSettings.supportEmail}
                      onChange={(e) => setDefaultSettings({ ...defaultSettings, supportEmail: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Default Business Settings */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-violet-400" />
                  Default Business Settings
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Default values applied when creating new businesses/kiosks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Default Currency</Label>
                    <Input
                      value={defaultSettings.defaultCurrency}
                      onChange={(e) => setDefaultSettings({ ...defaultSettings, defaultCurrency: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                    <p className="text-xs text-slate-500">ISO currency code (e.g., KES, USD, EUR)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Default Timezone</Label>
                    <Input
                      value={defaultSettings.defaultTimezone}
                      onChange={(e) => setDefaultSettings({ ...defaultSettings, defaultTimezone: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                    <p className="text-xs text-slate-500">IANA timezone identifier</p>
                  </div>
                </div>

                <Separator className="bg-slate-700 my-4" />

                <div className="flex justify-end">
                  <Button className="bg-violet-600 hover:bg-violet-500" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
                <p className="text-xs text-slate-500 text-right">
                  Settings persistence coming soon
                </p>
              </CardContent>
            </Card>

            {/* Platform Statistics */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-violet-400" />
                      Platform Statistics
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Overview of all data in the platform
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {stats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center">
                      <Building2 className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{stats.businesses}</p>
                      <p className="text-xs text-slate-400">Businesses</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center">
                      <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{stats.users}</p>
                      <p className="text-xs text-slate-400">Users</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center">
                      <Shield className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{stats.superAdmins}</p>
                      <p className="text-xs text-slate-400">Super Admins</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center">
                      <Globe className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{stats.domains}</p>
                      <p className="text-xs text-slate-400">Domains</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center">
                      <Package className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{stats.items.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">Items</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center">
                      <ShoppingCart className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{stats.sales.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">Sales</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-700/50 text-center col-span-2">
                      <p className="text-slate-400 text-sm mb-1">Total Categories</p>
                      <p className="text-xl font-bold text-white">{stats.categories}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">Failed to load statistics</p>
                )}
              </CardContent>
            </Card>

            {/* System Information */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-violet-400" />
                  System Information
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Technical details about the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Environment */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      Environment
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-slate-400">Node.js Version</span>
                        <Badge variant="outline" className="font-mono text-slate-300 border-slate-600">
                          {systemInfo?.nodeVersion || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-slate-400">Platform</span>
                        <Badge variant="outline" className="font-mono text-slate-300 border-slate-600">
                          {systemInfo?.platform || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-slate-400">Database</span>
                        <Badge variant="outline" className="font-mono text-slate-300 border-slate-600">
                          SQLite (Turso)
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Runtime */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Runtime
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-slate-400">Uptime</span>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {systemInfo ? formatUptime(systemInfo.uptime) : 'Unknown'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-slate-400">Memory Usage</span>
                        <Badge variant="outline" className="text-slate-300 border-slate-600">
                          {systemInfo 
                            ? `${formatBytes(systemInfo.memoryUsage.used)} / ${formatBytes(systemInfo.memoryUsage.total)}`
                            : 'Unknown'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
                        <span className="text-slate-400">Framework</span>
                        <Badge variant="outline" className="font-mono text-slate-300 border-slate-600">
                          Next.js 15
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Keys / Tokens (Placeholder for future) */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-violet-400" />
                  API Configuration
                </CardTitle>
                <CardDescription className="text-slate-400">
                  API keys and integration settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-700/30 border border-dashed border-slate-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-300 font-medium">Platform API Endpoint</p>
                        <code className="text-xs text-slate-400 font-mono mt-1 block">
                          {typeof window !== 'undefined' ? window.location.origin : ''}/api
                        </code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/api`, 'api')}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        {copied === 'api' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="text-center py-6 text-slate-500">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">API key management coming soon</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Generate and manage API keys for external integrations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Version Info */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Kiosk POS Platform</h3>
                      <p className="text-sm text-slate-400">Multi-tenant Point of Sale System</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                      v1.0.0
                    </Badge>
                    <p className="text-xs text-slate-500 mt-1">
                      Built with Next.js & Turso
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
