import { NextRequest } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, requireRole, isAuthResponse } from '@/lib/auth/api-auth';
import {
  generateExternalApiKeyPlaintext,
  hashExternalApiKeySecret,
} from '@/lib/auth/external-api-key';
import type { ExternalApiKey } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  const auth = await requireRole(['owner']);
  if (isAuthResponse(auth)) return auth;

  const rows = await query<
    Pick<ExternalApiKey, 'id' | 'label' | 'token_prefix' | 'active' | 'created_at' | 'last_used_at'> & {
      user_email: string;
    }
  >(
    `SELECT k.id, k.label, k.token_prefix, k.active, k.created_at, k.last_used_at, u.email as user_email
     FROM external_api_keys k
     JOIN users u ON u.id = k.user_id
     WHERE k.business_id = ?
     ORDER BY k.created_at DESC`,
    [auth.businessId]
  );

  return jsonResponse({ success: true, data: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(['owner']);
  if (isAuthResponse(auth)) return auth;

  let body: { label?: unknown; userId?: unknown } = {};
  try {
    body = (await request.json()) as { label?: unknown; userId?: unknown };
  } catch {
    body = {};
  }

  const label =
    typeof body.label === 'string' ? body.label.trim().slice(0, 120) || null : null;
  let userId = auth.userId;
  if (typeof body.userId === 'string' && body.userId !== auth.userId) {
    const other = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = ? AND business_id = ? AND active = 1`,
      [body.userId, auth.businessId]
    );
    if (!other) {
      return jsonResponse({ success: false, message: 'Invalid userId for this business' }, 400);
    }
    userId = other.id;
  }

  const { plaintext, prefix } = generateExternalApiKeyPlaintext();
  const id = generateUUID();
  const token_hash = hashExternalApiKeySecret(plaintext);

  await execute(
    `INSERT INTO external_api_keys (id, business_id, user_id, label, token_hash, token_prefix, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch())`,
    [id, auth.businessId, userId, label, token_hash, prefix]
  );

  return jsonResponse({
    success: true,
    data: {
      id,
      token: plaintext,
      tokenPrefix: prefix,
      label,
      userId,
      message: 'Store this token securely; it is not shown again.',
    },
  });
}
