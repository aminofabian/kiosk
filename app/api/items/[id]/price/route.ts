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
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;
    const body = await request.json();
    const { price, effectiveFrom } = body;

    if (!price || price <= 0) {
      return jsonResponse(
        { success: false, message: 'Price must be greater than 0' },
        400
      );
    }

    const item = await queryOne<{ id: string }>(
      'SELECT id FROM items WHERE id = ? AND business_id = ?',
      [itemId, auth.businessId]
    );

    if (!item) {
      return jsonResponse(
        { success: false, message: 'Item not found' },
        404
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const priceId = generateUUID();

    await execute(
      `INSERT INTO selling_prices (
        id, item_id, price, effective_from, set_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [priceId, itemId, price, effectiveFrom || now, auth.userId, now]
    );

    await execute(
      `UPDATE items 
       SET current_sell_price = ? 
       WHERE id = ? AND business_id = ?`,
      [price, itemId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Price updated successfully',
      data: {
        priceId,
        price,
      },
    });
  } catch (error) {
    console.error('Error updating price:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update price',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

