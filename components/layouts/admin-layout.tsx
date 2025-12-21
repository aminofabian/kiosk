'use client';

import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { DownloadButton } from '@/components/DownloadButton';

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
        <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#259783] to-[#3bd522] flex items-center justify-center shadow-lg shadow-[#259783]/20 flex-shrink-0">
              <span className="text-lg font-black text-[#101b0d]">P</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base text-slate-900 dark:text-white leading-none truncate">POS Admin</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Management Portal</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sidebar || <AdminSidebar />}
        </div>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="px-2">
            <DownloadButton
              variant="outline"
              size="sm"
              className="w-full justify-center border-slate-300 dark:border-slate-700"
            />
          </div>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
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
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors flex-shrink-0"
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
      
      {/* Mobile Download Button - Above bottom nav */}
      <div className="fixed bottom-25 right-4 z-40 md:hidden">
        <DownloadButton
          variant="outline"
          size="sm"
          className="border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"
        />
      </div>
    </div>
  );
}
