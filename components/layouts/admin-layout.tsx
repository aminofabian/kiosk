'use client';

import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { signOut } from 'next-auth/react';
import { LogOut, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
}

export function AdminLayout({ children, sidebar }: AdminLayoutProps) {
  const { user } = useCurrentUser();

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-[#0f1a0d]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4bee2b] to-[#3bd522] flex items-center justify-center shadow-lg shadow-[#4bee2b]/20">
              <span className="text-lg font-black text-[#101b0d]">P</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-900 dark:text-white leading-none">POS Admin</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Management Portal</p>
            </div>
          </div>
          <Link href="/pos">
            <Button
              size="sm"
              className="bg-[#4bee2b] hover:bg-[#3bd522] text-[#101b0d] font-semibold shadow-md shadow-[#4bee2b]/30"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              POS
            </Button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebar || <AdminSidebar />}
        </div>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-300">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">
                {user?.role || 'Loading...'}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
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
    </div>
  );
}
