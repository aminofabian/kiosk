const DEFAULT_DOMAIN = 'kiosk.co.ke';
const LOCALHOST_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];

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
