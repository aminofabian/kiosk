'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  Shield,
  ChevronRight,
  User,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@/components/ui/drawer';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user?.isSuperAdmin) {
      router.push('/superadmin/login');
    }
  }, [session, status, router]);

  if (status === 'loading' || !session?.user?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/10 flex items-center justify-center animate-pulse">
            <Shield className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Authenticating Session</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/superadmin', icon: LayoutDashboard },
    { label: 'Kiosks', href: '/superadmin/businesses', icon: Building2 },
    { label: 'Admins', href: '/superadmin/admins', icon: Users },
    { label: 'Settings', href: '/superadmin/settings', icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-2xl">
      {/* Logo Section */}
      <div className="p-8">
        <div className="flex items-center gap-4 group cursor-default">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-600/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-none">POS <span className="text-violet-500">Core</span></h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 opacity-60">Super Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1.5 mt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                'flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group',
                isActive
                  ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20 shadow-lg shadow-violet-600/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <div className="flex items-center gap-3.5">
                <item.icon className={cn(
                  'w-5 h-5 transition-transform duration-300',
                  isActive ? 'scale-110 text-violet-400' : 'text-slate-500 group-hover:scale-110 group-hover:text-white'
                )} />
                <span className="font-bold tracking-tight text-sm">{item.label}</span>
              </div>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-6 mt-auto">
        <div className="p-4 rounded-3xl bg-slate-900/40 border border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center border border-white/5 text-slate-300">
              {session.user.name?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white truncate leading-tight">{session.user.name}</p>
              <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">{session.user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: '/superadmin/login' })}
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-2xl h-11 font-black transition-all group"
          >
            <LogOut className="w-4 h-4 mr-3 transition-transform group-hover:-translate-x-1" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-violet-500/30 selection:text-violet-200">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-72 hidden lg:block z-40 border-r border-white/5">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 h-18 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-black text-white tracking-tight">POS <span className="text-violet-500 font-black">CORE</span></h1>
        </div>

        <Drawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5 rounded-xl h-11 w-11">
              <Menu className="w-6 h-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-slate-950 border-white/10 h-[85vh] outline-none">
            <div className="h-full">
              <SidebarContent />
            </div>
          </DrawerContent>
        </Drawer>
      </header>

      {/* Main content */}
      <main className="lg:ml-72 min-h-screen relative">
        {/* Background decorative elements */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto pt-4 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
