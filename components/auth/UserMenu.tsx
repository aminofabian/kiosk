'use client';

import { signOut } from 'next-auth/react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export function UserMenu() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <div className="text-sm font-medium">{user.name}</div>
        <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
      </div>
      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
        <User className="h-5 w-5 text-emerald-600" />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
