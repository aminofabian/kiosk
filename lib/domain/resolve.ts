import { queryOne } from '@/lib/db';
import type { Domain, Business } from '@/lib/db/types';

const DEFAULT_DOMAIN = 'kiosk.co.ke';
const DEFAULT_DOMAIN_URL = 'https://kiosk.co.ke';
const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];
const PUBLIC_DOMAINS = [DEFAULT_DOMAIN, ...LOCALHOST_DOMAINS];

export interface DomainResolutionResult {
  businessId: string;
  business: Business;
  domain: string;
  isDefault: boolean;
  isPublic: boolean;
}

export interface DomainResolutionError {
  error: 'DOMAIN_NOT_FOUND' | 'DOMAIN_SUSPENDED' | 'BUSINESS_SUSPENDED';
  domain: string;
  message: string;
}

function normalizeDomain(hostname: string | null): string {
  if (!hostname) {
    return DEFAULT_DOMAIN;
  }

  const lower = hostname.toLowerCase().trim();
  
  if (LOCALHOST_DOMAINS.includes(lower)) {
    return DEFAULT_DOMAIN;
  }

  const portIndex = lower.indexOf(':');
  if (portIndex > -1) {
    return lower.substring(0, portIndex);
  }

  return lower;
}

export function isPublicDomain(hostname: string | null): boolean {
  if (!hostname) {
    return true;
  }

  const normalized = normalizeDomain(hostname);
  return normalized === DEFAULT_DOMAIN || LOCALHOST_DOMAINS.includes(normalized.toLowerCase());
}

export async function resolveDomainToBusiness(
  hostname: string | null
): Promise<DomainResolutionResult | DomainResolutionError> {
  const normalizedDomain = normalizeDomain(hostname);

  const domainRecord = await queryOne<Domain>(
    `SELECT d.* FROM domains d WHERE d.domain = ? AND d.active = 1`,
    [normalizedDomain]
  );

  if (!domainRecord) {
    const defaultDomain = await queryOne<Domain>(
      `SELECT * FROM domains WHERE domain = ? AND active = 1 LIMIT 1`,
      [DEFAULT_DOMAIN]
    );

    if (!defaultDomain) {
      return {
        error: 'DOMAIN_NOT_FOUND',
        domain: normalizedDomain,
        message: `Domain "${normalizedDomain}" is not registered and no default business exists`,
      };
    }

    const defaultBusiness = await queryOne<Business>(
      `SELECT * FROM businesses WHERE id = ? AND active = 1`,
      [defaultDomain.business_id]
    );

    if (!defaultBusiness) {
      return {
        error: 'DOMAIN_NOT_FOUND',
        domain: normalizedDomain,
        message: `Domain "${normalizedDomain}" is not registered and default business is inactive`,
      };
    }

    return {
      businessId: defaultBusiness.id,
      business: defaultBusiness,
      domain: DEFAULT_DOMAIN,
      isDefault: true,
      isPublic: true,
    };
  }

  const business = await queryOne<Business>(
    `SELECT * FROM businesses WHERE id = ?`,
    [domainRecord.business_id]
  );

  if (!business) {
    return {
      error: 'DOMAIN_NOT_FOUND',
      domain: normalizedDomain,
      message: `Business for domain "${normalizedDomain}" not found`,
    };
  }

  if (business.active === 0) {
    return {
      error: 'BUSINESS_SUSPENDED',
      domain: normalizedDomain,
      message: `Business associated with "${normalizedDomain}" is suspended`,
    };
  }

  return {
    businessId: business.id,
    business,
    domain: normalizedDomain,
    isDefault: normalizedDomain === DEFAULT_DOMAIN,
    isPublic: normalizedDomain === DEFAULT_DOMAIN || LOCALHOST_DOMAINS.includes(normalizedDomain.toLowerCase()),
  };
}

export function extractHostname(request: { headers: Headers | { get: (key: string) => string | null } }): string | null {
  const hostHeader = request.headers.get('host');
  return hostHeader || null;
}
