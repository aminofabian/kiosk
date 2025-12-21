'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { UserList } from '@/components/admin/UserList';
import { UserForm } from '@/components/admin/UserForm';
import type { UserRole } from '@/lib/constants';
import { Users } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string | null;
  active: number;
  created_at: number;
}

export default function UsersPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const handleAddUser = () => {
    setEditingUser(null);
    setDrawerOpen(true);
  };

  const handleEditUser = (user: UserData) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const handleClose = () => {
    setDrawerOpen(false);
    setEditingUser(null);
  };

  const handleSuccess = () => {
    setDrawerOpen(false);
    setEditingUser(null);
    // Force re-render of list by refreshing page
    window.location.reload();
  };

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0f1a0d]/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#259783] flex items-center justify-center shadow-lg shadow-[#259783]/20">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage your team members and their access levels</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 pb-24 md:pb-6">
          <UserList onAddUser={handleAddUser} onEditUser={handleEditUser} />
        </div>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b bg-[#259783]/10 dark:bg-[#259783]/20">
              <DrawerTitle className="text-2xl flex items-center gap-2 text-slate-900 dark:text-white">
                <Users className="w-6 h-6 text-[#259783]" />
                {editingUser ? 'Edit User' : 'Add New User'}
              </DrawerTitle>
              <DrawerDescription>
                {editingUser 
                  ? 'Update user details and permissions' 
                  : 'Create a new team member and set their access level'}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 sm:px-6 pb-6 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
              <UserForm
                user={editingUser}
                onClose={handleClose}
                onSuccess={handleSuccess}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AdminLayout>
  );
}
