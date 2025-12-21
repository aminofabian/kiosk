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

    // Get overall business metrics
    const overallMetrics = await queryOne<{
      total_items: number;
      total_inventory_value: number;
      total_stock_units: number;
      total_purchased: number;
      total_purchase_value: number;
      total_sold: number;
      total_sales_revenue: number;
      total_profit: number;
      first_activity_date: number | null;
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM items WHERE business_id = ? AND active = 1 AND parent_item_id IS NOT NULL OR (parent_item_id IS NULL AND NOT EXISTS (SELECT 1 FROM items v WHERE v.parent_item_id = items.id AND v.business_id = items.business_id AND v.active = 1))) as total_items,
        COALESCE((SELECT SUM(current_stock * current_sell_price) FROM items WHERE business_id = ? AND active = 1), 0) as total_inventory_value,
        COALESCE((SELECT SUM(current_stock) FROM items WHERE business_id = ? AND active = 1), 0) as total_stock_units,
        COALESCE((SELECT SUM(initial_quantity) FROM inventory_batches WHERE business_id = ?), 0) as total_purchased,
        COALESCE((SELECT SUM(initial_quantity * buy_price_per_unit) FROM inventory_batches WHERE business_id = ?), 0) as total_purchase_value,
        COALESCE((SELECT SUM(quantity_sold) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.business_id = ? AND s.status = 'completed'), 0) as total_sold,
        COALESCE((SELECT SUM(quantity_sold * sell_price_per_unit) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.business_id = ? AND s.status = 'completed'), 0) as total_sales_revenue,
        COALESCE((SELECT SUM(profit) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.business_id = ? AND s.status = 'completed'), 0) as total_profit,
        (SELECT MIN(received_at) FROM inventory_batches WHERE business_id = ?) as first_activity_date`,
      [auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId, auth.businessId]
    );

    // Get per-item analysis with turnover data
    const itemAnalysis = await query<{
      item_id: string;
      item_name: string;
      variant_name: string | null;
      unit_type: string;
      category_name: string;
      current_stock: number;
      current_sell_price: number;
      total_purchased: number;
      total_sold: number;
      total_revenue: number;
      total_profit: number;
      first_purchase_date: number | null;
      last_sale_date: number | null;
      days_since_last_sale: number | null;
    }>(
      `SELECT 
        i.id as item_id,
        i.name as item_name,
        i.variant_name,
        i.unit_type,
        c.name as category_name,
        i.current_stock,
        i.current_sell_price,
        COALESCE(ib_stats.total_purchased, 0) as total_purchased,
        COALESCE(si_stats.total_sold, 0) as total_sold,
        COALESCE(si_stats.total_revenue, 0) as total_revenue,
        COALESCE(si_stats.total_profit, 0) as total_profit,
        ib_stats.first_purchase_date,
        si_stats.last_sale_date,
        CASE WHEN si_stats.last_sale_date IS NOT NULL 
          THEN CAST((unixepoch() - si_stats.last_sale_date) / 86400 AS INTEGER)
          ELSE NULL 
        END as days_since_last_sale
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN (
        SELECT 
          item_id,
          SUM(initial_quantity) as total_purchased,
          MIN(received_at) as first_purchase_date
        FROM inventory_batches
        WHERE business_id = ?
        GROUP BY item_id
      ) ib_stats ON i.id = ib_stats.item_id
      LEFT JOIN (
        SELECT 
          si.item_id,
          SUM(si.quantity_sold) as total_sold,
          SUM(si.quantity_sold * si.sell_price_per_unit) as total_revenue,
          SUM(si.profit) as total_profit,
          MAX(s.sale_date) as last_sale_date
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.business_id = ? AND s.status = 'completed'
        GROUP BY si.item_id
      ) si_stats ON i.id = si_stats.item_id
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
      ORDER BY si_stats.total_revenue DESC NULLS LAST, i.name ASC`,
      [auth.businessId, auth.businessId, auth.businessId]
    );

    // Calculate business health indicators
    const totalPurchased = overallMetrics?.total_purchased || 0;
    const totalSold = overallMetrics?.total_sold || 0;
    const turnoverRate = totalPurchased > 0 ? (totalSold / totalPurchased) * 100 : 0;
    const profitMargin = overallMetrics?.total_sales_revenue && overallMetrics.total_sales_revenue > 0
      ? (overallMetrics.total_profit / overallMetrics.total_sales_revenue) * 100
      : 0;

    // Categorize items by performance
    const topSellers = itemAnalysis.filter(i => i.total_sold > 0).slice(0, 5);
    const slowMoving = itemAnalysis.filter(i => {
      if (i.total_purchased === 0) return false;
      if (i.days_since_last_sale === null && i.total_sold === 0) return true;
      if (i.days_since_last_sale !== null && i.days_since_last_sale > 30) return true;
      return false;
    });
    const fastMoving = itemAnalysis.filter(i => {
      const turnover = i.total_purchased > 0 ? i.total_sold / i.total_purchased : 0;
      return turnover > 0.5 && i.total_sold > 0;
    });
    const deadStock = itemAnalysis.filter(i => 
      i.current_stock > 0 && i.total_sold === 0 && i.total_purchased > 0
    );

    // Calculate stock value distribution
    const stockWithValue = itemAnalysis.filter(i => i.current_stock > 0);
    const totalStockValue = stockWithValue.reduce((sum, i) => sum + (i.current_stock * i.current_sell_price), 0);

    return jsonResponse({
      success: true,
      data: {
        summary: {
          totalItems: overallMetrics?.total_items || 0,
          totalInventoryValue: overallMetrics?.total_inventory_value || 0,
          totalStockUnits: overallMetrics?.total_stock_units || 0,
          totalPurchased: totalPurchased,
          totalPurchaseValue: overallMetrics?.total_purchase_value || 0,
          totalSold: totalSold,
          totalSalesRevenue: overallMetrics?.total_sales_revenue || 0,
          totalProfit: overallMetrics?.total_profit || 0,
          turnoverRate: turnoverRate,
          profitMargin: profitMargin,
          firstActivityDate: overallMetrics?.first_activity_date || null,
          daysSinceStart: overallMetrics?.first_activity_date 
            ? Math.floor((Date.now() / 1000 - overallMetrics.first_activity_date) / 86400)
            : 0,
        },
        healthIndicators: {
          topSellersCount: topSellers.length,
          fastMovingCount: fastMoving.length,
          slowMovingCount: slowMoving.length,
          deadStockCount: deadStock.length,
          stockHealthScore: itemAnalysis.length > 0 
            ? Math.round(((fastMoving.length + (topSellers.length * 0.5)) / itemAnalysis.length) * 100)
            : 0,
        },
        items: itemAnalysis.map((item) => {
          const inventoryValue = item.current_stock * item.current_sell_price;
          const turnover = item.total_purchased > 0 ? (item.total_sold / item.total_purchased) * 100 : 0;
          
          let status: 'top_seller' | 'fast_moving' | 'normal' | 'slow_moving' | 'dead_stock' | 'new';
          if (item.total_sold === 0 && item.total_purchased === 0) {
            status = 'new';
          } else if (item.current_stock > 0 && item.total_sold === 0) {
            status = 'dead_stock';
          } else if (item.days_since_last_sale !== null && item.days_since_last_sale > 30) {
            status = 'slow_moving';
          } else if (turnover > 70) {
            status = 'top_seller';
          } else if (turnover > 40) {
            status = 'fast_moving';
          } else {
            status = 'normal';
          }

          return {
            itemId: item.item_id,
            itemName: item.item_name,
            variantName: item.variant_name,
            unitType: item.unit_type,
            categoryName: item.category_name,
            currentStock: item.current_stock,
            currentSellPrice: item.current_sell_price,
            inventoryValue: inventoryValue,
            totalPurchased: item.total_purchased,
            totalSold: item.total_sold,
            totalRevenue: item.total_revenue,
            totalProfit: item.total_profit,
            turnoverRate: turnover,
            firstPurchaseDate: item.first_purchase_date,
            lastSaleDate: item.last_sale_date,
            daysSinceLastSale: item.days_since_last_sale,
            status: status,
          };
        }),
        topSellers: topSellers.map(i => ({
          itemId: i.item_id,
          itemName: i.variant_name ? `${i.item_name} (${i.variant_name})` : i.item_name,
          totalSold: i.total_sold,
          revenue: i.total_revenue,
          profit: i.total_profit,
        })),
        slowMoving: slowMoving.slice(0, 5).map(i => ({
          itemId: i.item_id,
          itemName: i.variant_name ? `${i.item_name} (${i.variant_name})` : i.item_name,
          currentStock: i.current_stock,
          daysSinceLastSale: i.days_since_last_sale,
          inventoryValue: i.current_stock * i.current_sell_price,
        })),
        deadStock: deadStock.slice(0, 5).map(i => ({
          itemId: i.item_id,
          itemName: i.variant_name ? `${i.item_name} (${i.variant_name})` : i.item_name,
          currentStock: i.current_stock,
          inventoryValue: i.current_stock * i.current_sell_price,
        })),
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
