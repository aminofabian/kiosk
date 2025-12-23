import { headers } from 'next/headers';
import { resolveDomainToBusiness } from './resolve';
import type { DomainResolutionResult, DomainResolutionError } from './resolve';
import type { Business } from '@/lib/db/types';

export interface DomainContext {
  businessId: string;
  business: Business;
  domain: string;
  isDefault: boolean;
  isPublic: boolean;
}

export async function getDomainContext(): Promise<DomainContext | DomainResolutionError> {
  const headersList = await headers();
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host');

  const resolution = await resolveDomainToBusiness(hostname);

  if ('error' in resolution) {
    return resolution;
  }

  return {
    businessId: resolution.businessId,
    business: resolution.business,
    domain: resolution.domain,
    isDefault: resolution.isDefault,
    isPublic: resolution.isPublic,
  };
}

export async function requireDomainContext(): Promise<DomainContext> {
  const context = await getDomainContext();

  if ('error' in context) {
    throw new Error(context.message);
  }

  return context;
}

export async function getBusinessIdFromDomain(): Promise<string | null> {
  const context = await getDomainContext();
  
  if ('error' in context) {
    return null;
  }

  return context.businessId;
}
