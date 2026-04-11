import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireRole, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(['owner']);
  if (isAuthResponse(auth)) return auth;

  const { id } = await params;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM external_api_keys WHERE id = ? AND business_id = ?`,
    [id, auth.businessId]
  );
  if (!row) {
    return jsonResponse({ success: false, message: 'Key not found' }, 404);
  }

  await execute(`UPDATE external_api_keys SET active = 0 WHERE id = ?`, [id]);
  return jsonResponse({ success: true, message: 'API key revoked' });
}
