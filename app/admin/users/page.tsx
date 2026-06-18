'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { UserList } from '@/components/admin/UserList';
import { UserForm } from '@/components/admin/UserForm';
import type { UserRole } from '@/lib/constants';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  department?: string | null;
  created_at: number;
}

export default function UsersPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
    setRefreshKey((k) => k + 1);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="px-4 md:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1c6a1e] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  Users
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Team members, roles & access levels
                </p>
              </div>
            </div>
            <Button
              onClick={handleAddUser}
              className="bg-[#1c6a1e] hover:bg-[#238b26] text-white shrink-0 h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add User
            </Button>
          </div>
        </div>

        <div className="px-4 md:px-6 py-4 pb-24 md:pb-6 max-w-6xl">
          <UserList
            key={refreshKey}
            onEditUser={handleEditUser}
            onAddUser={handleAddUser}
          />
        </div>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
          <DrawerContent className="!w-full sm:!w-[600px] md:!w-[700px] !max-w-none h-full max-h-screen">
            <DrawerHeader className="border-b bg-[#1c6a1e]/10 dark:bg-[#1c6a1e]/20">
              <DrawerTitle className="text-2xl flex items-center gap-2 text-slate-900 dark:text-white">
                <Users className="w-6 h-6 text-[#1c6a1e]" />
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
