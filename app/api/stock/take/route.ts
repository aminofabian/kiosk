import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('adjust_stock');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: 'Items are required' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const results = [];

    // Process each item
    for (const itemData of items) {
      const { itemId, actualStock, reason, notes } = itemData;

      if (!itemId || actualStock === undefined || !reason) {
        continue; // Skip invalid items
      }

      // Get current system stock
      const item = await queryOne<{ id: string; current_stock: number }>(
        'SELECT id, current_stock FROM items WHERE id = ? AND business_id = ?',
        [itemId, auth.businessId]
      );

      if (!item) {
        continue; // Skip if item not found
      }

      const systemStock = item.current_stock;
      const difference = actualStock - systemStock;

      // Only create adjustment if there's a difference
      if (difference !== 0) {
        const adjustmentId = generateUUID();

        // Create stock adjustment record (matching schema)
        await execute(
          `INSERT INTO stock_adjustments (
            id, business_id, item_id, system_stock, actual_stock,
            difference, reason, notes, adjusted_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            adjustmentId,
            auth.businessId,
            itemId,
            systemStock,
            actualStock,
            difference,
            reason,
            notes || null,
            auth.userId,
            now,
          ]
        );

        // Update item stock
        await execute(
          `UPDATE items 
           SET current_stock = ? 
           WHERE id = ? AND business_id = ?`,
          [Math.max(0, actualStock), itemId, auth.businessId]
        );

        results.push({
          itemId,
          adjustmentId,
          systemStock,
          actualStock,
          difference,
        });
      } else {
        // No difference, just record success
        results.push({
          itemId,
          systemStock,
          actualStock,
          difference: 0,
          note: 'No adjustment needed',
        });
      }
    }

    return jsonResponse({
      success: true,
      message: `Stock take completed for ${items.length} item(s)`,
      data: {
        processed: results.length,
        adjustments: results.filter((r) => r.difference !== 0).length,
        results,
      },
    });
  } catch (error) {
    console.error('Error processing stock take:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to process stock take',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

