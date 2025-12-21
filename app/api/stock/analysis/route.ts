import { query, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { NextRequest } from 'next/server';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Get first batch date to determine business start
    const businessStart = await queryOne<{ first_date: number | null }>(
      `SELECT MIN(received_at) as first_date FROM inventory_batches WHERE business_id = ?`,
      [auth.businessId]
    );

    const firstActivityDate = businessStart?.first_date || null;
    const daysSinceStart = firstActivityDate 
      ? Math.floor((Date.now() / 1000 - firstActivityDate) / 86400)
      : 0;

    // Get per-item stock analysis: initial stock vs current stock
    const itemAnalysis = await query<{
      item_id: string;
      item_name: string;
      variant_name: string | null;
      unit_type: string;
      category_name: string;
      current_stock: number;
      current_sell_price: number;
      initial_stock: number;
      first_batch_date: number | null;
      total_ever_stocked: number;
    }>(
      `SELECT 
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        i.unit_type,
        c.name as category_name,
        i.current_stock,
        i.current_sell_price,
        COALESCE(first_batch.initial_quantity, 0) as initial_stock,
        first_batch.received_at as first_batch_date,
        COALESCE(total_stats.total_ever_stocked, 0) as total_ever_stocked
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
      LEFT JOIN (
        SELECT item_id, SUM(initial_quantity) as total_ever_stocked
        FROM inventory_batches
        WHERE business_id = ?
        GROUP BY item_id
      ) total_stats ON i.id = total_stats.item_id
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
      ORDER BY (i.current_stock - COALESCE(first_batch.initial_quantity, 0)) DESC, i.name ASC`,
      [auth.businessId, auth.businessId, auth.businessId]
    );

    // Calculate overall stock metrics
    let totalInitialStock = 0;
    let totalCurrentStock = 0;
    let totalInitialValue = 0;
    let totalCurrentValue = 0;
    let itemsWithInitialData = 0;
    let growingItems = 0;
    let shrinkingItems = 0;
    let stableItems = 0;

    const items = itemAnalysis.map((item) => {
      const stockChange = item.current_stock - item.initial_stock;
      const stockChangePercent = item.initial_stock > 0 
        ? ((item.current_stock - item.initial_stock) / item.initial_stock) * 100
        : (item.current_stock > 0 ? 100 : null);
      
      const initialValue = item.initial_stock * item.current_sell_price;
      const currentValue = item.current_stock * item.current_sell_price;

      let trend: 'growing' | 'shrinking' | 'stable' | 'new' = 'new';
      
      if (item.initial_stock > 0) {
        itemsWithInitialData++;
        totalInitialStock += item.initial_stock;
        totalCurrentStock += item.current_stock;
        totalInitialValue += initialValue;
        totalCurrentValue += currentValue;

        if (item.current_stock > item.initial_stock) {
          trend = 'growing';
          growingItems++;
        } else if (item.current_stock < item.initial_stock) {
          trend = 'shrinking';
          shrinkingItems++;
        } else {
          trend = 'stable';
          stableItems++;
        }
      } else if (item.current_stock > 0) {
        trend = 'new';
        totalCurrentStock += item.current_stock;
        totalCurrentValue += currentValue;
      }

      return {
        itemId: item.item_id,
        itemName: item.item_name,
        variantName: item.variant_name,
        unitType: item.unit_type,
        categoryName: item.category_name,
        initialStock: item.initial_stock,
        currentStock: item.current_stock,
        stockChange,
        stockChangePercent,
        initialValue,
        currentValue,
        valueChange: currentValue - initialValue,
        firstBatchDate: item.first_batch_date,
        totalEverStocked: item.total_ever_stocked,
        trend,
      };
    });

    // Calculate overall growth
    const overallStockChange = totalCurrentStock - totalInitialStock;
    const overallStockChangePercent = totalInitialStock > 0 
      ? ((totalCurrentStock - totalInitialStock) / totalInitialStock) * 100
      : null;
    const overallValueChange = totalCurrentValue - totalInitialValue;
    const overallValueChangePercent = totalInitialValue > 0 
      ? ((totalCurrentValue - totalInitialValue) / totalInitialValue) * 100
      : null;

    // Determine business trajectory based on stock growth
    let trajectory: 'expanding' | 'stable' | 'declining' | 'new' = 'new';
    if (itemsWithInitialData > 0) {
      if (overallStockChangePercent !== null && overallStockChangePercent > 20) {
        trajectory = 'expanding';
      } else if (overallStockChangePercent !== null && overallStockChangePercent < -20) {
        trajectory = 'declining';
      } else {
        trajectory = 'stable';
      }
    }

    // Get top growing items
    const topGrowing = items
      .filter(i => i.trend === 'growing' && i.stockChangePercent !== null)
      .sort((a, b) => (b.stockChangePercent ?? 0) - (a.stockChangePercent ?? 0))
      .slice(0, 5);

    // Get shrinking items (potential concern)
    const shrinking = items
      .filter(i => i.trend === 'shrinking')
      .sort((a, b) => (a.stockChangePercent ?? 0) - (b.stockChangePercent ?? 0))
      .slice(0, 5);

    // Get new items (items added after business start)
    const newItems = items
      .filter(i => i.trend === 'new' && i.currentStock > 0)
      .slice(0, 5);

    return jsonResponse({
      success: true,
      data: {
        summary: {
          firstActivityDate,
          daysSinceStart,
          trajectory,
          totalItems: items.length,
          itemsWithData: itemsWithInitialData,
          newItemsCount: items.filter(i => i.trend === 'new').length,
        },
        stockGrowth: {
          initialTotalStock: totalInitialStock,
          currentTotalStock: totalCurrentStock,
          stockChange: overallStockChange,
          stockChangePercent: overallStockChangePercent,
          initialTotalValue: totalInitialValue,
          currentTotalValue: totalCurrentValue,
          valueChange: overallValueChange,
          valueChangePercent: overallValueChangePercent,
        },
        trendBreakdown: {
          growing: growingItems,
          shrinking: shrinkingItems,
          stable: stableItems,
          new: items.filter(i => i.trend === 'new').length,
        },
        items,
        topGrowing,
        shrinking,
        newItems,
      },
    });
  } catch (error) {
    console.error('Error fetching stock analysis:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch stock analysis',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
