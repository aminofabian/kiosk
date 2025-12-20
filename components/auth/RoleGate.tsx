'use client';

import { useCurrentUser } from '@/lib/hooks/use-current-user';
import type { UserRole } from '@/lib/constants';
import type { ReactNode } from 'react';

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function OwnerOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate allowedRoles={['owner']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export function AdminOrOwner({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate allowedRoles={['owner', 'admin']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}
