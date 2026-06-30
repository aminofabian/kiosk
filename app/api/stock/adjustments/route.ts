import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { ADJUSTMENT_REASONS, type AdjustmentReason } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

const LOSS_REASONS = new Set(['spoilage', 'theft', 'damage', 'other']);

interface AdjustmentRow {
  id: string;
  business_id: string;
  item_id: string;
  system_stock: number;
  actual_stock: number;
  difference: number;
  reason: AdjustmentReason;
  notes: string | null;
  adjusted_by: string;
  created_at: number;
  item_name: string;
  item_unit_type: string;
  adjusted_by_name: string;
  buy_price_estimate: number;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'superadmin') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const reason = searchParams.get('reason');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const search = searchParams.get('search')?.trim().toLowerCase();
    const sort = searchParams.get('sort') || 'created_at_desc';

    const params: (string | number)[] = [];
    const whereClauses: string[] = ['sa.business_id = ?'];
    params.push(auth.businessId);

    if (reason) {
      if (!ADJUSTMENT_REASONS.includes(reason as AdjustmentReason)) {
        return jsonResponse({ success: false, message: 'Invalid reason' }, 400);
      }
      whereClauses.push('sa.reason = ?');
      params.push(reason);
    }

    if (start) {
      const startTs = parseInt(start, 10);
      if (!Number.isNaN(startTs)) {
        whereClauses.push('sa.created_at >= ?');
        params.push(startTs);
      }
    }

    if (end) {
      const endTs = parseInt(end, 10);
      if (!Number.isNaN(endTs)) {
        whereClauses.push('sa.created_at <= ?');
        params.push(endTs);
      }
    }

    if (search) {
      whereClauses.push('LOWER(i.name) LIKE ?');
      params.push(`%${search}%`);
    }

    const orderBy = sort === 'created_at_asc' ? 'sa.created_at ASC' : 'sa.created_at DESC';

    const whereSql = whereClauses.join(' AND ');

    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM stock_adjustments sa
       JOIN items i ON sa.item_id = i.id
       WHERE ${whereSql}`,
      params
    );

    const total = countRow?.total ?? 0;

    const rows = await query<AdjustmentRow>(
      `SELECT
        sa.*,
        i.name as item_name,
        i.unit_type as item_unit_type,
        u.name as adjusted_by_name,
        COALESCE(
          (SELECT ib.buy_price_per_unit
           FROM inventory_batches ib
           WHERE ib.item_id = sa.item_id
           ORDER BY ib.received_at DESC
           LIMIT 1),
          (SELECT pb.buy_price_per_unit
           FROM purchase_breakdowns pb
           JOIN purchase_items pi ON pb.purchase_item_id = pi.id
           JOIN purchases p ON pi.purchase_id = p.id
           WHERE pb.item_id = sa.item_id AND p.business_id = ?
           ORDER BY pb.confirmed_at DESC
           LIMIT 1),
          (SELECT si.buy_price_per_unit
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
           WHERE si.item_id = sa.item_id AND s.business_id = ? AND si.buy_price_per_unit > 0
           ORDER BY s.sale_date DESC
           LIMIT 1),
          0
        ) as buy_price_estimate
       FROM stock_adjustments sa
       JOIN items i ON sa.item_id = i.id
       JOIN users u ON sa.adjusted_by = u.id
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [auth.businessId, auth.businessId, ...params, limit, offset]
    );

    const data = rows.map((row) => {
      const isLoss = row.difference < 0 && LOSS_REASONS.has(row.reason);
      const estimatedCost = isLoss
        ? Math.abs(row.difference) * (row.buy_price_estimate || 0)
        : 0;
      return {
        ...row,
        estimated_cost: estimatedCost,
        is_loss: isLoss,
      };
    });

    return jsonResponse({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch stock adjustments',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
