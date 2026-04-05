import type { NextRequest } from 'next/server';

/**
 * Canonical public site URL for redirects and payment callbacks (Pesapal, etc.).
 * Prefer proxy headers when Origin is missing or wrong.
 */
export function getPublicSiteUrl(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && /^https?:\/\//i.test(explicit)) {
    return explicit.replace(/\/$/, '');
  }

  const origin = request.headers.get('origin');
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/$/, '');
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostRaw = forwardedHost || request.headers.get('host') || '';
  const host = hostRaw.split(',')[0]?.trim() || '';
  if (host) {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isLocal =
      host.startsWith('localhost') ||
      host.startsWith('127.') ||
      host.startsWith('0.0.0.0');
    const proto =
      forwardedProto?.split(',')[0]?.trim() ||
      (isLocal ? 'http' : 'https');
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, '')}`;
  }

  return '';
}
