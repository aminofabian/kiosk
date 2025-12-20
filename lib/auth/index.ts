import { getServerSession } from 'next-auth';
import { authOptions } from './config';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getBusinessId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.businessId ?? null;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

export async function requireRole(allowedRoles: ('owner' | 'admin' | 'cashier')[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden');
  }
  return user;
}

export { authOptions } from './config';
export * from './permissions';
