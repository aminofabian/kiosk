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

    // Get items with growth data (initial stock from first batch and current buy price)
    const items = await query<
      Item & { 
        category_name: string;
        initial_stock: number | null;
        initial_buy_price: number | null;
        current_buy_price: number | null;
        first_batch_date: number | null;
      }
    >(
      `SELECT 
        i.*,
        c.name as category_name,
        first_batch.initial_quantity as initial_stock,
        first_batch.buy_price_per_unit as initial_buy_price,
        first_batch.received_at as first_batch_date,
        current_batch.buy_price_per_unit as current_buy_price
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       LEFT JOIN (
         SELECT 
           ib1.item_id,
           ib1.initial_quantity,
           ib1.buy_price_per_unit,
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
       LEFT JOIN (
         SELECT 
           ib1.item_id,
           ib1.buy_price_per_unit
         FROM inventory_batches ib1
         WHERE ib1.business_id = ?
           AND ib1.quantity_remaining > 0
           AND ib1.received_at = (
             SELECT MAX(ib2.received_at)
             FROM inventory_batches ib2
             WHERE ib2.item_id = ib1.item_id
               AND ib2.business_id = ib1.business_id
               AND ib2.quantity_remaining > 0
           )
           AND ib1.created_at = (
             SELECT MAX(ib3.created_at)
             FROM inventory_batches ib3
             WHERE ib3.item_id = ib1.item_id
               AND ib3.business_id = ib1.business_id
               AND ib3.received_at = ib1.received_at
               AND ib3.quantity_remaining > 0
           )
       ) current_batch ON i.id = current_batch.item_id
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
      [auth.businessId, auth.businessId, auth.businessId]
    );

    // Get current buy prices for items that don't have batches with remaining stock
    const itemsNeedingBuyPrice = items.filter(item => !item.current_buy_price && item.current_stock > 0);
    const buyPriceMap = new Map<string, number>();
    
    if (itemsNeedingBuyPrice.length > 0) {
      const itemIds = itemsNeedingBuyPrice.map(i => i.id);
      const placeholders = itemIds.map(() => '?').join(',');
      const recentBatches = await query<{ item_id: string; buy_price_per_unit: number }>(
        `SELECT 
          ib1.item_id,
          ib1.buy_price_per_unit
         FROM inventory_batches ib1
         WHERE ib1.business_id = ?
           AND ib1.item_id IN (${placeholders})
           AND ib1.received_at = (
             SELECT MAX(ib2.received_at)
             FROM inventory_batches ib2
             WHERE ib2.item_id = ib1.item_id
               AND ib2.business_id = ib1.business_id
           )
         GROUP BY ib1.item_id`,
        [auth.businessId, ...itemIds]
      );
      
      recentBatches.forEach(batch => {
        buyPriceMap.set(batch.item_id, batch.buy_price_per_unit);
      });
    }

    // Calculate growth data for each item
    const itemsWithGrowth = items.map(item => {
      const initialStock = item.initial_stock ?? 0;
      const currentStock = item.current_stock;
      const stockChange = currentStock - initialStock;
      const stockChangePercent = initialStock > 0 
        ? ((currentStock - initialStock) / initialStock) * 100
        : (currentStock > 0 ? 100 : null);
      
      // Get current buy price (from batch with stock, or most recent batch, or fallback to initial)
      const currentBuyPrice = item.current_buy_price ?? buyPriceMap.get(item.id) ?? item.initial_buy_price ?? 0;
      
      // Calculate values
      // Initial value uses buy price from first batch (cost basis at start)
      const initialBuyPrice = item.initial_buy_price ?? 0;
      const initialValue = initialStock * initialBuyPrice;
      
      // Stock value uses current buy price (current cost basis)
      const stockValue = currentStock * currentBuyPrice;
      
      // Sales value uses current sell price (potential revenue)
      const salesValue = currentStock * item.current_sell_price;
      
      // Value change compares sales value to stock value (profit potential)
      const valueChange = salesValue - stockValue;
      const valueChangePercent = stockValue > 0 
        ? ((salesValue - stockValue) / stockValue) * 100
        : (salesValue > 0 ? 100 : null);
      
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
        stock_value: stockValue,
        sales_value: salesValue,
        current_value: salesValue, // Keep for backward compatibility
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
