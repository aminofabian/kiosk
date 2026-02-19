import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const daysParam = parseInt(request.nextUrl.searchParams.get('days') || '7', 10);
    const days = Number.isNaN(daysParam) ? 7 : Math.min(Math.max(daysParam, 1), 30);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const sinceSeconds = nowSeconds - days * 24 * 60 * 60;

    // Top selling items: only sellable items (variants or standalone), exclude parents that have variants
    const rawTopItems = await query<any>(
      `SELECT 
        i.*,
        COALESCE(sold.quantity_sold, 0) as quantity_sold
       FROM items i
       INNER JOIN (
         SELECT si.item_id, SUM(si.quantity_sold) as quantity_sold
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.business_id = ?
           AND s.status = 'completed'
           AND s.sale_date >= ?
         GROUP BY si.item_id
       ) sold ON sold.item_id = i.id
       WHERE i.business_id = ?
         AND i.active = 1
         AND NOT (
           i.parent_item_id IS NULL
           AND EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = i.id AND v.active = 1)
         )
       ORDER BY sold.quantity_sold DESC
       LIMIT 30`,
      [auth.businessId, sinceSeconds, auth.businessId]
    );

    // Defensive: re-verify each item exists and is active
    const validIds = await query<{ id: string }>(
      'SELECT id FROM items WHERE business_id = ? AND active = 1',
      [auth.businessId]
    );
    const validSet = new Set(validIds.map((r) => r.id));
    const topItems = rawTopItems.filter((item: { id: string }) => validSet.has(item.id));

    // Low stock items (simple threshold)
    const lowStockItems = await query<any>(
      `SELECT i.*
       FROM items i
       WHERE i.business_id = ?
         AND i.active = 1
         AND i.min_stock_level IS NOT NULL
         AND i.current_stock <= i.min_stock_level
       ORDER BY i.current_stock ASC
       LIMIT 8`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: {
        topItems,
        lowStockItems,
      },
    });
  } catch (error) {
    console.error('Error fetching POS insights:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch POS insights',
      },
      500
    );
  }
}

