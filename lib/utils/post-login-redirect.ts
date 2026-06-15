import type { UserRole } from '@/lib/constants';

/** Where to send the user immediately after a successful login. */
export function getPostLoginPath(role?: UserRole | string | null): string {
  if (role === 'cashier') return '/pos';
  return '/admin';
}
