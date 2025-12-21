import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { requireDomainContext, getDomainContext } from '@/lib/domain/context';
import { jsonResponse } from '@/lib/utils/api-response';
import type { UserRole } from '@/lib/constants';
import type { DomainContext } from '@/lib/domain/context';

export interface DomainAuthContext {
  userId: string;
  businessId: string;
  role: UserRole;
  email: string;
  name: string;
  domain: string;
  isSuperAdmin: boolean;
}

export async function requireDomainAuth(): Promise<DomainAuthContext | Response> {
  const domainContextResult = await getDomainContext();
  
  if ('error' in domainContextResult) {
    return jsonResponse(
      { success: false, message: domainContextResult.message },
      domainContextResult.error === 'DOMAIN_NOT_FOUND' ? 404 : 403
    );
  }

  const domainContext = domainContextResult;
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
  }

  if (session.user.isSuperAdmin) {
    return jsonResponse(
      { success: false, message: 'Super admin cannot access business routes via domain' },
      403
    );
  }

  if (session.user.businessId !== domainContext.businessId) {
    return jsonResponse(
      { 
        success: false, 
        message: 'User does not belong to the business associated with this domain' 
      },
      403
    );
  }

  return {
    userId: session.user.id,
    businessId: domainContext.businessId,
    role: session.user.role as UserRole,
    email: session.user.email,
    name: session.user.name,
    domain: domainContext.domain,
    isSuperAdmin: false,
  };
}

export async function requireDomainPermission(
  permission: 'sell' | 'view_own_sales' | 'void_own_sale' | 'record_purchase' | 'breakdown_purchase' | 'adjust_stock' | 'view_all_sales' | 'view_profit' | 'manage_items' | 'manage_users' | 'business_settings'
): Promise<DomainAuthContext | Response> {
  const auth = await requireDomainAuth();
  
  if (auth instanceof Response) {
    return auth;
  }

  const { hasPermission } = await import('./permissions');
  
  if (!hasPermission(auth.role, permission)) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  return auth;
}

export async function getBusinessIdFromDomain(): Promise<string | null> {
  const context = await getDomainContext();
  
  if ('error' in context) {
    return null;
  }

  return context.businessId;
}

export function isAuthResponse(value: DomainAuthContext | Response): value is Response {
  return value instanceof Response;
}
