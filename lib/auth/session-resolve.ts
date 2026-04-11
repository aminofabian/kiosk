import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { trySessionFromExternalApiKey } from './external-api-key';
import type { Session } from 'next-auth';

/** Prefer cookie session; otherwise external API key (Bearer / X-API-Key). */
export async function resolveAppSession(): Promise<Session | null> {
  const cookieSession = await getServerSession(authOptions);
  if (cookieSession?.user) return cookieSession;
  const fromKey = await trySessionFromExternalApiKey();
  return fromKey;
}
