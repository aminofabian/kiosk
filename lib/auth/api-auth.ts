import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { jsonResponse } from '@/lib/utils/api-response';
import { hasPermission } from './permissions';
import type { UserRole } from '@/lib/constants';

type Permission =
  | 'sell'
  | 'view_own_sales'
  | 'void_own_sale'
  | 'record_purchase'
  | 'breakdown_purchase'
  | 'adjust_stock'
  | 'view_all_sales'
  | 'view_profit'
  | 'manage_items'
  | 'manage_users'
  | 'business_settings';

export interface AuthContext {
  userId: string;
  businessId: string;
  role: UserRole;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

export interface SuperAdminContext {
  userId: string;
  email: string;
  name: string;
  isSuperAdmin: true;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return null;
  }

  // Super admins don't have a businessId
  if (session.user.isSuperAdmin) {
    return null;
  }

  return {
    userId: session.user.id,
    businessId: session.user.businessId!,
    role: session.user.role as UserRole,
    email: session.user.email,
    name: session.user.name,
    isSuperAdmin: false,
  };
}

export async function getSuperAdminContext(): Promise<SuperAdminContext | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !session.user.isSuperAdmin) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isSuperAdmin: true,
  };
}

export async function requireAuth(): Promise<AuthContext | Response> {
  const auth = await getAuthContext();
  
  if (!auth) {
    return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
  }

  return auth;
}

export async function requireSuperAdmin(): Promise<SuperAdminContext | Response> {
  const admin = await getSuperAdminContext();
  
  if (!admin) {
    return jsonResponse({ success: false, message: 'Super admin access required' }, 403);
  }

  return admin;
}

export async function requirePermission(permission: Permission): Promise<AuthContext | Response> {
  const auth = await requireAuth();
  
  if (auth instanceof Response) {
    return auth;
  }

  if (!hasPermission(auth.role, permission)) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  return auth;
}

export async function requireRole(roles: UserRole[]): Promise<AuthContext | Response> {
  const auth = await requireAuth();
  
  if (auth instanceof Response) {
    return auth;
  }

  if (!roles.includes(auth.role)) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  return auth;
}

export function isAuthResponse(value: AuthContext | SuperAdminContext | Response): value is Response {
  return value instanceof Response;
}
