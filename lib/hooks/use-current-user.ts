'use client';

import { useSession } from 'next-auth/react';

export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  };
}

export function useBusinessId() {
  const { user } = useCurrentUser();
  return user?.businessId ?? null;
}

export function useUserRole() {
  const { user } = useCurrentUser();
  return user?.role ?? null;
}
