'use client';

import { ReactNode, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { InstallApp } from '@/components/InstallApp';
import { storeUserRole, clearUserRole } from '@/lib/utils/user-role-storage';
import Link from 'next/link';

interface AdminLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

export function AdminLayout({ children, sidebar }: AdminLayoutProps) {
  const { user } = useCurrentUser();

  useEffect(() => {
    if (user?.role) {
      storeUserRole(user.role);
    } else {
      clearUserRole();
    }
  }, [user?.role]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-[#0f1a0d]">
      {/* Desktop Sidebar — Agentic layout, theme colors */}
      <aside className="hidden md:flex md:w-[220px] lg:w-[232px] flex-col shrink-0 bg-white dark:bg-[#1c2e18] border-r border-slate-200 dark:border-slate-800/80">
        {/* Brand header */}
        <div className="h-14 flex items-center px-4 shrink-0 border-b border-slate-100 dark:border-slate-800/60">
          <Link href="/admin" className="flex items-center gap-3 group min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shrink-0 shadow-sm shadow-[#1c6a1e]/20">
              <span className="text-sm font-bold text-white">P</span>
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                POS Admin
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-500 truncate">
                Management
              </span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {sidebar || <AdminSidebar />}
        </div>

        {/* User + footer */}
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-800/60">
          <div className="p-4 flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#1c6a1e]/15 dark:bg-[#2a8a30]/20 flex items-center justify-center shrink-0 text-[#1c6a1e] dark:text-[#2a8a30] text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate capitalize">
                {user?.role || 'Loading...'}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-4 pb-4 pt-0">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              POS Admin
            </p>
            <p className="text-[9px] text-slate-400/80 dark:text-slate-500/80">
              © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <AdminBottomNav />
      
      {/* Install App Popup */}
      <InstallApp />
    </div>
  );
}
