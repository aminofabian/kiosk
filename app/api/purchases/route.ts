import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { Purchase } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requirePermission('record_purchase');
    if (isAuthResponse(auth)) return auth;

    const purchases = await query<Purchase>(
      `SELECT * FROM purchases 
       WHERE business_id = ? 
       ORDER BY purchase_date DESC, created_at DESC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: purchases,
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch purchases',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('record_purchase');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const {
      supplierName,
      purchaseDate,
      totalAmount,
      extraCosts,
      notes,
      items,
    } = body;

    if (!purchaseDate || !totalAmount || !items || items.length === 0) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const purchaseId = generateUUID();

    await execute(
      `INSERT INTO purchases (
        id, business_id, recorded_by, supplier_name, purchase_date,
        total_amount, extra_costs, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseId,
        auth.businessId,
        auth.userId,
        supplierName || null,
        purchaseDate,
        totalAmount,
        extraCosts || 0,
        notes || null,
        'pending',
        now,
      ]
    );

    for (const item of items) {
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
          item.quantityNote,
          item.amount,
          item.notes || null,
          'pending',
          now,
        ]
      );
    }

    return jsonResponse({
      success: true,
      message: 'Purchase created successfully',
      data: {
        purchaseId,
      },
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create purchase',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

