import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import {
  resolvedBuyPriceSql,
  saleLineCostSql,
  saleLineProfitSql,
  saleLineRevenueSql,
} from '@/lib/utils/profit-sql';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/profit/batches?start=&end=&itemSearch=&batchFilter=
 * Returns profit by batch (stock lot) with optional product and batch number filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const startTimestamp = parseInt(searchParams.get('start') || '0');
    const endTimestamp = parseInt(searchParams.get('end') || '0');
    const itemSearch = searchParams.get('itemSearch')?.trim().toLowerCase() || '';
    const batchFilter = searchParams.get('batchFilter')?.trim().toLowerCase() || '';

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    // Build filters
    const filters: string[] = [];
    const params: (string | number)[] = [
      auth.businessId, auth.businessId, // resolvedBuyPrice in saleLineCostSql
      auth.businessId, auth.businessId, // resolvedBuyPrice in saleLineProfitSql (total_profit)
      auth.businessId, auth.businessId, // resolvedBuyPrice in saleLineProfitSql (profit_margin)
      auth.businessId, // WHERE s2.business_id
      startTimestamp, endTimestamp,
    ];

    if (itemSearch) {
      filters.push(`(LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.variant_name, '')) LIKE ? OR LOWER(COALESCE(p.name, '')) LIKE ?)`);
      const pattern = `%${itemSearch}%`;
      params.push(pattern, pattern, pattern);
    }
    if (batchFilter) {
      filters.push(`(LOWER(COALESCE(ib.batch_number, '')) LIKE ?)`);
      params.push(`%${batchFilter}%`);
    }
    const filterClause = filters.length > 0 ? ` AND ${filters.join(' AND ')}` : '';

    const batches = await query<{
      batch_id: string;
      batch_number: string | null;
      item_id: string;
      item_name: string;
      variant_name: string | null;
      parent_name: string | null;
      supplier_name: string | null;
      quantity_sold: number;
      total_sales: number;
      total_cost: number;
      total_profit: number;
      profit_margin: number;
    }>(
      `SELECT 
        ib.id as batch_id,
        ib.batch_number,
        i.id as item_id,
        i.name as item_name,
        i.variant_name as variant_name,
        p.name as parent_name,
        s.name as supplier_name,
        COALESCE(SUM(si.quantity_sold), 0) as quantity_sold,
        COALESCE(SUM(${saleLineRevenueSql('si')}), 0) as total_sales,
        COALESCE(SUM(${saleLineCostSql('si')}), 0) as total_cost,
        COALESCE(SUM(${saleLineProfitSql('si')}), 0) as total_profit,
        CASE
          WHEN SUM(${saleLineRevenueSql('si')}) > 0
          THEN SUM(${saleLineProfitSql('si')}) / SUM(${saleLineRevenueSql('si')})
          ELSE 0
        END as profit_margin
       FROM sale_items si
       JOIN sales s2 ON si.sale_id = s2.id
       JOIN inventory_batches ib ON si.inventory_batch_id = ib.id
       JOIN items i ON si.item_id = i.id
       LEFT JOIN items p ON i.parent_item_id = p.id
       LEFT JOIN suppliers s ON ib.supplier_id = s.id
       WHERE s2.business_id = ? 
         AND s2.status = 'completed'
         AND s2.sale_date >= ? 
         AND s2.sale_date <= ?
         AND si.inventory_batch_id IS NOT NULL
         ${filterClause}
       GROUP BY ib.id, ib.batch_number, i.id, i.name, i.variant_name, p.name, s.name
       HAVING total_sales > 0
       ORDER BY total_profit DESC`,
      params
    );

    return jsonResponse({
      success: true,
      data: batches.map((b) => ({
        batchId: b.batch_id,
        batchNumber: b.batch_number || b.batch_id.slice(0, 8),
        itemId: b.item_id,
        itemName: b.item_name,
        variantName: b.variant_name,
        parentName: b.parent_name,
        supplierName: b.supplier_name,
        quantitySold: b.quantity_sold,
        totalSales: b.total_sales,
        totalCost: b.total_cost,
        totalProfit: b.total_profit,
        profitMargin: b.profit_margin,
      })),
    });
  } catch (error) {
    console.error('Error fetching batch profit:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch batch profit',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
