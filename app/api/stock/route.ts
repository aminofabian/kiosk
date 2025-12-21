import { query } from '@/lib/db';
import type { Item } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Get items with growth data (initial stock from first batch)
    const items = await query<
      Item & { 
        category_name: string;
        initial_stock: number | null;
        first_batch_date: number | null;
      }
    >(
      `SELECT 
        i.*,
        c.name as category_name,
        first_batch.initial_quantity as initial_stock,
        first_batch.received_at as first_batch_date
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN (
         SELECT 
           ib1.item_id,
           ib1.initial_quantity,
           ib1.received_at
         FROM inventory_batches ib1
         WHERE ib1.business_id = ?
           AND ib1.received_at = (
             SELECT MIN(ib2.received_at)
             FROM inventory_batches ib2
             WHERE ib2.item_id = ib1.item_id
               AND ib2.business_id = ib1.business_id
           )
           AND ib1.created_at = (
             SELECT MIN(ib3.created_at)
             FROM inventory_batches ib3
             WHERE ib3.item_id = ib1.item_id
               AND ib3.business_id = ib1.business_id
               AND ib3.received_at = ib1.received_at
           )
       ) first_batch ON i.id = first_batch.item_id
       WHERE i.business_id = ? 
         AND i.active = 1
         AND (
           i.parent_item_id IS NOT NULL
           OR
           (i.parent_item_id IS NULL AND NOT EXISTS (
             SELECT 1 FROM items v 
             WHERE v.parent_item_id = i.id 
             AND v.business_id = i.business_id 
             AND v.active = 1
           ))
         )
       ORDER BY i.name ASC`,
      [auth.businessId, auth.businessId]
    );

    // Calculate growth data for each item
    const itemsWithGrowth = items.map(item => {
      const initialStock = item.initial_stock ?? 0;
      const currentStock = item.current_stock;
      const stockChange = currentStock - initialStock;
      const stockChangePercent = initialStock > 0 
        ? ((currentStock - initialStock) / initialStock) * 100
        : (currentStock > 0 ? 100 : null);
      
      // Calculate values (stock × sell price)
      const initialValue = initialStock * item.current_sell_price;
      const currentValue = currentStock * item.current_sell_price;
      const valueChange = currentValue - initialValue;
      const valueChangePercent = initialValue > 0 
        ? ((currentValue - initialValue) / initialValue) * 100
        : (currentValue > 0 ? 100 : null);
      
      let trend: 'growing' | 'shrinking' | 'stable' | 'new' = 'new';
      if (initialStock > 0) {
        if (currentStock > initialStock) {
          trend = 'growing';
        } else if (currentStock < initialStock) {
          trend = 'shrinking';
        } else {
          trend = 'stable';
        }
      }

      return {
        ...item,
        initial_stock: initialStock,
        stock_change: stockChange,
        stock_change_percent: stockChangePercent,
        initial_value: initialValue,
        current_value: currentValue,
        value_change: valueChange,
        value_change_percent: valueChangePercent,
        trend,
      };
    });

    return jsonResponse({
      success: true,
      data: itemsWithGrowth,
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch stock',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
