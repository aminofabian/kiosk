'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { UserList } from '@/components/admin/UserList';
import { UserForm } from '@/components/admin/UserForm';
import type { UserRole } from '@/lib/constants';
import { Users } from 'lucide-react';

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
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const handleAddUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEditUser = (user: UserData) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleSuccess = () => {
    setShowForm(false);
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
          {showForm ? (
            <UserForm
              user={editingUser}
              onClose={handleClose}
              onSuccess={handleSuccess}
            />
          ) : (
            <UserList onAddUser={handleAddUser} onEditUser={handleEditUser} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
