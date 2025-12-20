'use client';

import { useState } from 'react';
import { UserList } from '@/components/admin/UserList';
import { UserForm } from '@/components/admin/UserForm';
import type { UserRole } from '@/lib/constants';

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

  if (showForm) {
    return (
      <div className="p-6">
        <UserForm
          user={editingUser}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage your team members and their access levels
        </p>
      </div>
      
      <UserList onAddUser={handleAddUser} onEditUser={handleEditUser} />
    </div>
  );
}
