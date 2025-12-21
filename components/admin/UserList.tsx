'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, User, Loader2 } from 'lucide-react';
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

interface UserListProps {
  onAddUser: () => void;
  onEditUser: (user: UserData) => void;
}

export function UserList({ onAddUser, onEditUser }: UserListProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();

      if (result.success) {
        setUsers(result.data);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    setDeletingId(userId);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        fetchUsers();
      } else {
        alert(result.message || 'Failed to deactivate user');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'cashier':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto border-4 border-[#259783]/20 border-t-[#259783] rounded-full animate-spin"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-block p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-destructive font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Team Members</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage access and permissions</p>
        </div>
        <Button 
          onClick={onAddUser}
          className="bg-[#259783] hover:bg-[#45d827] text-white font-semibold shadow-md shadow-[#259783]/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card 
            key={user.id} 
            className={`border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18] ${user.active === 0 ? 'opacity-60' : ''}`}
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-[#259783] dark:text-[#259783]" />
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                    {user.name}
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                    {user.active === 0 && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {user.email}
                    {user.pin && (
                      <span className="ml-2">• PIN: ****</span>
                    )}
                  </div>
                </div>
              </div>

              {user.role !== 'owner' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditUser(user)}
                    className="hover:bg-[#259783]/10 hover:border-[#259783] hover:text-[#259783]"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(user.id)}
                    disabled={deletingId === user.id}
                    className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-800 dark:hover:text-red-400"
                  >
                    {deletingId === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {users.length === 0 && (
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1c2e18]">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#259783]/10 dark:bg-[#259783]/20 flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-[#259783]" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">No users found. Add your first team member!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
