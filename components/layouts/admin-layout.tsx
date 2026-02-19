'use client';

import { ReactNode, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { signOut } from 'next-auth/react';
import { LogOut, ChevronRight } from 'lucide-react';
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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-[232px] lg:w-[256px] flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#1c2e18] transition-all duration-300">
        {/* Brand header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1c6a1e] to-[#2a8a30] flex items-center justify-center shadow-md shadow-[#1c6a1e]/20 transition-transform duration-200 group-hover:scale-105">
              <span className="text-sm font-black text-white leading-none">P</span>
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-900 dark:text-white leading-none tracking-tight">
                POS Admin
              </h1>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium tracking-wide uppercase">
                Management
              </p>
            </div>
          </Link>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {sidebar || <AdminSidebar />}
        </div>

        {/* User footer */}
        <div className="p-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1c6a1e]/20 to-[#2a8a30]/20 dark:from-[#1c6a1e]/30 dark:to-[#2a8a30]/30 flex items-center justify-center flex-shrink-0 ring-1 ring-[#1c6a1e]/20">
              <span className="text-xs font-semibold text-[#1c6a1e] dark:text-[#2a8a30]">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 truncate leading-none">
                {user?.name || 'User'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate capitalize mt-0.5 leading-none">
                {user?.role || 'Loading...'}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-150 flex-shrink-0 opacity-0 group-hover:opacity-100"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
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
