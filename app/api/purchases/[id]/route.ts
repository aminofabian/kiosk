import { NextRequest } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import type { Purchase, PurchaseItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { generateUUID } from '@/lib/utils/uuid';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('record_purchase');
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;

    const purchase = await queryOne<Purchase>(
      `SELECT * FROM purchases WHERE id = ? AND business_id = ?`,
      [purchaseId, auth.businessId]
    );

    if (!purchase) {
      return jsonResponse(
        { success: false, message: 'Purchase not found' },
        404
      );
    }

    const purchaseItems = await query<
      PurchaseItem & { item_name?: string; item_unit_type?: string }
    >(
      `SELECT 
        pi.*,
        i.name as item_name,
        i.unit_type as item_unit_type
       FROM purchase_items pi
       LEFT JOIN items i ON pi.item_id = i.id
       WHERE pi.purchase_id = ?
       ORDER BY pi.created_at ASC`,
      [purchaseId]
    );

    return jsonResponse({
      success: true,
      data: {
        purchase,
        items: purchaseItems,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('record_purchase');
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, message: 'Items array is required and cannot be empty' },
        400
      );
    }

    const purchase = await queryOne<Purchase>(
      `SELECT * FROM purchases WHERE id = ? AND business_id = ?`,
      [purchaseId, auth.businessId]
    );

    if (!purchase) {
      return jsonResponse(
        { success: false, message: 'Purchase not found' },
        404
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let totalAmountIncrease = 0;

    for (const item of items) {
      if (!item.itemName || !item.amount) {
        return jsonResponse(
          { success: false, message: 'Item name and amount are required' },
          400
        );
      }

      const purchaseItemId = generateUUID();
      await execute(
        `INSERT INTO purchase_items (
          id, purchase_id, item_id, item_name_snapshot, quantity_note,
          amount, notes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseItemId,
          purchaseId,
          item.itemId || null,
          item.itemName,
          item.quantityNote || '',
          item.amount,
          item.notes || null,
          'pending',
          now,
        ]
      );

      totalAmountIncrease += parseFloat(item.amount.toString());
    }

    const newTotalAmount = purchase.total_amount + totalAmountIncrease;
    await execute(
      `UPDATE purchases 
       SET total_amount = ? 
       WHERE id = ? AND business_id = ?`,
      [newTotalAmount, purchaseId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Items added to purchase successfully',
      data: {
        purchaseId,
        itemsAdded: items.length,
        newTotalAmount,
      },
    });
  } catch (error) {
    console.error('Error adding items to purchase:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to add items to purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

