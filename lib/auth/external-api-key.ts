import { createHash, randomBytes } from 'crypto';
import { headers } from 'next/headers';
import type { Session } from 'next-auth';
import { execute, queryOne } from '@/lib/db';
import type { User as DbUser } from '@/lib/db/types';

export function hashExternalApiKeySecret(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex');
}

/** Random secret shown once when a key is created (prefix identifies rows in UI). */
export function generateExternalApiKeyPlaintext(): { plaintext: string; prefix: string } {
  const body = randomBytes(24).toString('base64url');
  const plaintext = `pos_${body}`;
  return { plaintext, prefix: plaintext.slice(0, 12) };
}

async function readApiKeyFromHeaders(): Promise<string | null> {
  const h = await headers();
  const auth = h.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const x = h.get('x-api-key')?.trim();
  return x || null;
}

/**
 * When no NextAuth session cookie is present, resolve a Session from
 * `Authorization: Bearer <secret>` or `X-API-Key: <secret>`.
 */
export async function trySessionFromExternalApiKey(): Promise<Session | null> {
  const plain = await readApiKeyFromHeaders();
  if (!plain) return null;

  const token_hash = hashExternalApiKeySecret(plain);
  const row = await queryOne<{ id: string; user_id: string }>(
    `SELECT k.id, k.user_id
     FROM external_api_keys k
     JOIN businesses b ON b.id = k.business_id AND b.active = 1
     JOIN users u ON u.id = k.user_id AND u.business_id = k.business_id AND u.active = 1
     WHERE k.token_hash = ? AND k.active = 1`,
    [token_hash]
  );
  if (!row) return null;

  const user = await queryOne<
    Pick<DbUser, 'id' | 'email' | 'name' | 'role' | 'business_id' | 'department'> & {
      business_name: string;
    }
  >(
    `SELECT u.id, u.email, u.name, u.role, u.business_id, u.department, b.name as business_name
     FROM users u
     JOIN businesses b ON b.id = u.business_id
     WHERE u.id = ? AND u.active = 1 AND b.active = 1`,
    [row.user_id]
  );
  if (!user) return null;

  void execute(`UPDATE external_api_keys SET last_used_at = unixepoch() WHERE id = ?`, [
    row.id,
  ]).catch(() => {});

  return {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      businessId: user.business_id,
      businessName: user.business_name,
      isSuperAdmin: false,
      department: user.department ?? null,
    },
  };
}
