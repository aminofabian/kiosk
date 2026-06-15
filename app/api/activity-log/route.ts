import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_all_sales');
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conditions: string[] = ['a.business_id = ?'];
    const params: (string | number)[] = [auth.businessId];

    if (entityType) {
      conditions.push('a.entity_type = ?');
      params.push(entityType);
    }
    if (from) {
      conditions.push('a.created_at >= ?');
      params.push(parseInt(from, 10));
    }
    if (to) {
      conditions.push('a.created_at <= ?');
      params.push(parseInt(to, 10));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<
      {
        id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        entity_name_snapshot: string | null;
        details: string | null;
        performed_by: string;
        created_at: number;
        performer_name: string;
      }
    >(
      `SELECT 
        a.id, a.action, a.entity_type, a.entity_id, a.entity_name_snapshot,
        a.details, a.performed_by, a.created_at, u.name as performer_name
       FROM activity_log a
       LEFT JOIN users u ON a.performed_by = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM activity_log a ${whereClause}`,
      params
    );
    const total = totalResult[0]?.count ?? 0;

    const items = rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityNameSnapshot: r.entity_name_snapshot,
      details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
      performedBy: r.performed_by,
      performerName: r.performer_name,
      createdAt: r.created_at,
    }));

    return jsonResponse({
      success: true,
      data: { items, total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch activity log',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
