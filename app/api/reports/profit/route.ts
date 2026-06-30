import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission('view_profit');
    if (isAuthResponse(auth)) return auth;

    const searchParams = request.nextUrl.searchParams;
    const startTimestamp = parseInt(searchParams.get('start') || '0');
    const endTimestamp = parseInt(searchParams.get('end') || '0');
    const viewBy = searchParams.get('viewBy') || 'item';

    if (!startTimestamp || !endTimestamp) {
      return jsonResponse(
        { success: false, message: 'Start and end timestamps are required' },
        400
      );
    }

    // Get total summary with buy_price fallback and outlier cap.
    const summary = await queryOne<{
      total_sales: number;
      total_cost: number;
      total_profit: number;
    }>(
      `SELECT
        COALESCE(SUM(${saleLineRevenueSql('si')}), 0) as total_sales,
        COALESCE(SUM(${saleLineCostSql('si')}), 0) as total_cost,
        COALESCE(SUM(${saleLineProfitSql('si')}), 0) as total_profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.business_id = ?
         AND s.status = 'completed'
         AND s.sale_date >= ?
         AND s.sale_date <= ?`,
      [auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
    );

    const totalSales = summary?.total_sales || 0;
    const totalCost = summary?.total_cost || 0;
    const totalProfit = summary?.total_profit || 0;
    const profitMargin = totalSales > 0 ? totalProfit / totalSales : 0;

    let byItem: any[] = [];
    let byCategory: any[] = [];
    let byBatch: any[] = [];

    if (viewBy === 'batch') {
      // Profit by batch (stock lot)
      byBatch = await query<{
        batch_id: string;
        batch_number: string | null;
        item_id: string;
        item_name: string;
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
         LEFT JOIN suppliers s ON ib.supplier_id = s.id
         WHERE s2.business_id = ?
           AND s2.status = 'completed'
           AND s2.sale_date >= ?
           AND s2.sale_date <= ?
           AND si.inventory_batch_id IS NOT NULL
         GROUP BY ib.id, ib.batch_number, i.id, i.name, s.name
         HAVING total_sales > 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    } else if (viewBy === 'item') {
      // Profit by item with buy_price fallback
      byItem = await query<{
        item_id: string;
        item_name: string;
        quantity_sold: number;
        total_sales: number;
        total_cost: number;
        total_profit: number;
        profit_margin: number;
      }>(
        `SELECT 
          i.id as item_id,
          i.name as item_name,
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
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         WHERE s.business_id = ?
           AND s.status = 'completed'
           AND s.sale_date >= ?
           AND s.sale_date <= ?
         GROUP BY i.id, i.name
         HAVING total_sales > 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    } else {
      // Profit by category with buy_price fallback
      byCategory = await query<{
        category_id: string;
        category_name: string;
        total_sales: number;
        total_cost: number;
        total_profit: number;
        profit_margin: number;
      }>(
        `SELECT 
          c.id as category_id,
          c.name as category_name,
          COALESCE(SUM(${saleLineRevenueSql('si')}), 0) as total_sales,
          COALESCE(SUM(${saleLineCostSql('si')}), 0) as total_cost,
          COALESCE(SUM(${saleLineProfitSql('si')}), 0) as total_profit,
          CASE
            WHEN SUM(${saleLineRevenueSql('si')}) > 0
            THEN SUM(${saleLineProfitSql('si')}) / SUM(${saleLineRevenueSql('si')})
            ELSE 0
          END as profit_margin
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN items i ON si.item_id = i.id
         LEFT JOIN categories c ON i.category_id = c.id
         WHERE s.business_id = ?
           AND s.status = 'completed'
           AND s.sale_date >= ?
           AND s.sale_date <= ?
         GROUP BY c.id, c.name
         HAVING total_sales > 0
         ORDER BY total_profit DESC`,
        [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, startTimestamp, endTimestamp]
      );
    }

    return jsonResponse({
      success: true,
      data: {
        totalSales,
        totalCost,
        totalProfit,
        profitMargin,
        byItem,
        byCategory,
        byBatch,
      },
    });
  } catch (error) {
    console.error('Error fetching profit report:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch profit report',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

