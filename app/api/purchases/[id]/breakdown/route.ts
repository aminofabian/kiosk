import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('breakdown_purchase');
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;
    const body = await request.json();
    const {
      purchaseItemId,
      itemId,
      usableQuantity,
      wastageQuantity,
      buyPricePerUnit,
      notes,
    } = body;

    if (!purchaseItemId || !itemId || !usableQuantity || !buyPricePerUnit) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const breakdownId = generateUUID();
    const batchId = generateUUID();

    await execute(
      `INSERT INTO purchase_breakdowns (
        id, purchase_item_id, item_id, usable_quantity, wastage_quantity,
        buy_price_per_unit, notes, confirmed_by, confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        breakdownId,
        purchaseItemId,
        itemId,
        usableQuantity,
        wastageQuantity || 0,
        buyPricePerUnit,
        notes || null,
        auth.userId,
        now,
      ]
    );

    await execute(
      `INSERT INTO inventory_batches (
        id, business_id, item_id, source_breakdown_id, initial_quantity,
        quantity_remaining, buy_price_per_unit, received_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        auth.businessId,
        itemId,
        breakdownId,
        usableQuantity,
        usableQuantity,
        buyPricePerUnit,
        now,
        now,
      ]
    );

    await execute(
      `UPDATE items 
       SET current_stock = current_stock + ? 
       WHERE id = ? AND business_id = ?`,
      [usableQuantity, itemId, auth.businessId]
    );

    // If wastage > 0, create stock adjustment record
    if (wastageQuantity && wastageQuantity > 0) {
      const wastageAdjustmentId = generateUUID();
      // Get current stock after adding usable quantity
      const currentItem = await queryOne<{ current_stock: number }>(
        'SELECT current_stock FROM items WHERE id = ? AND business_id = ?',
        [itemId, auth.businessId]
      );
      
      if (currentItem) {
        const systemStock = currentItem.current_stock;
        const actualStock = systemStock - wastageQuantity; // Deduct wastage
        const difference = -wastageQuantity; // Negative difference

        await execute(
          `INSERT INTO stock_adjustments (
            id, business_id, item_id, system_stock, actual_stock,
            difference, reason, notes, adjusted_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            wastageAdjustmentId,
            auth.businessId,
            itemId,
            systemStock,
            actualStock,
            difference,
            'spoilage', // Wastage is always spoilage
            notes ? `Wastage from purchase breakdown: ${notes}` : 'Wastage from purchase breakdown',
            auth.userId,
            now,
          ]
        );

        // Update item stock to reflect wastage
        await execute(
          `UPDATE items 
           SET current_stock = ? 
           WHERE id = ? AND business_id = ?`,
          [actualStock, itemId, auth.businessId]
        );
      }
    }

    // Update purchase_item: set status and link item_id if not already set
    await execute(
      `UPDATE purchase_items 
       SET status = 'broken_down', item_id = COALESCE(item_id, ?)
       WHERE id = ?`,
      [itemId, purchaseItemId]
    );

    // Check current purchase status and remaining pending items
    const purchase = await queryOne<{ status: string }>(
      `SELECT status FROM purchases WHERE id = ?`,
      [purchaseId]
    );

    const pendingCount = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM purchase_items 
       WHERE purchase_id = ? AND status = 'pending'`,
      [purchaseId]
    );

    // Determine new status based on current status and pending count
    let newStatus = purchase?.status || 'pending';
    if (pendingCount && pendingCount.count === 0) {
      // All items broken down
      newStatus = 'complete';
    } else if (purchase?.status === 'pending') {
      // First breakdown - transition to partial
      newStatus = 'partial';
    } else if (purchase?.status === 'partial') {
      // Already partial, stay partial until complete
      newStatus = 'partial';
    }

    await execute(
      `UPDATE purchases 
       SET status = ? 
       WHERE id = ?`,
      [newStatus, purchaseId]
    );

    return jsonResponse({
      success: true,
      message: 'Breakdown created successfully',
      data: {
        breakdownId,
        batchId,
        purchaseStatus: newStatus,
      },
    });
  } catch (error) {
    console.error('Error creating breakdown:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create breakdown',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

