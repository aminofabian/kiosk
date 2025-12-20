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
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return null;
  }

  return {
    userId: session.user.id,
    businessId: session.user.businessId,
    role: session.user.role,
    email: session.user.email,
    name: session.user.name,
  };
}

export async function requireAuth(): Promise<AuthContext | Response> {
  const auth = await getAuthContext();
  
  if (!auth) {
    return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
  }

  return auth;
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

export function isAuthResponse(value: AuthContext | Response): value is Response {
  return value instanceof Response;
}
