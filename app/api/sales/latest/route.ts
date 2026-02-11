import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

interface LatestSaleItem {
  item_name: string;
  quantity_sold: number;
  sell_price_per_unit: number;
  item_type_snapshot: string | null;
}

interface LatestSale {
  id: string;
  total_amount: number;
  sale_date: number;
  created_at: number;
  items: LatestSaleItem[];
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const startTimestamp = parseInt(searchParams.get('start') || '0');
    const endTimestamp = parseInt(searchParams.get('end') || '0');
    const itemType = searchParams.get('itemType'); // 'grocery' | 'retail' | null for all

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    const itemTypeFilter = itemType
      ? ` AND COALESCE(si.item_type_snapshot, 'retail') = ?`
      : '';
    const itemTypeParams = itemType ? [itemType] : [];

    // Get 5 latest completed sales in the date range
    // When filtering by itemType, only include sales that have at least one item of that type
    const sales = await query<{
      id: string;
      total_amount: number;
      sale_date: number;
      created_at: number;
    }>(
      `SELECT s.id, s.total_amount, s.sale_date, s.created_at
       FROM sales s
       ${itemType ? `JOIN sale_items si_check ON si_check.sale_id = s.id AND COALESCE(si_check.item_type_snapshot, 'retail') = ?` : ''}
       WHERE s.business_id = ?
         AND s.status = 'completed'
         AND s.sale_date >= ?
         AND s.sale_date <= ?
       GROUP BY s.id
       ORDER BY s.sale_date DESC, s.created_at DESC
       LIMIT 5`,
      itemType
        ? [itemType, auth.businessId, startTimestamp, endTimestamp]
        : [auth.businessId, startTimestamp, endTimestamp]
    );

    if (sales.length === 0) {
      return jsonResponse({
        success: true,
        data: { sales: [] },
      });
    }

    const saleIds = sales.map((s) => s.id);
    const placeholders = saleIds.map(() => '?').join(',');

    const items = await query<{
      sale_id: string;
      item_name: string;
      quantity_sold: number;
      sell_price_per_unit: number;
      item_type_snapshot: string | null;
    }>(
      `SELECT 
        si.sale_id,
        i.name as item_name,
        si.quantity_sold,
        si.sell_price_per_unit,
        si.item_type_snapshot
       FROM sale_items si
       JOIN items i ON si.item_id = i.id
       WHERE si.sale_id IN (${placeholders})
         ${itemTypeFilter}
       ORDER BY si.created_at ASC`,
      [...saleIds, ...itemTypeParams]
    );

    const itemsBySaleId: Record<string, LatestSaleItem[]> = {};
    for (const item of items) {
      if (!itemsBySaleId[item.sale_id]) {
        itemsBySaleId[item.sale_id] = [];
      }
      itemsBySaleId[item.sale_id].push({
        item_name: item.item_name,
        quantity_sold: item.quantity_sold,
        sell_price_per_unit: item.sell_price_per_unit,
        item_type_snapshot: item.item_type_snapshot,
      });
    }

    const result: LatestSale[] = sales.map((s) => {
      const saleItems = itemsBySaleId[s.id] || [];
      const displayedAmount = itemType
        ? saleItems.reduce(
            (sum, i) => sum + i.quantity_sold * i.sell_price_per_unit,
            0
          )
        : s.total_amount;
      return {
        id: s.id,
        total_amount: displayedAmount,
        sale_date: s.sale_date,
        created_at: s.created_at,
        items: saleItems,
      };
    });

    return jsonResponse({
      success: true,
      data: { sales: result },
    });
  } catch (error) {
    console.error('Error fetching latest sales:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch latest sales',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
