import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/items/[id]/batches
 * Returns all active batches for an item (FIFO order) for cashier batch selection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: itemId } = await params;

    const batches = await query<{
      id: string;
      batch_number: string | null;
      quantity_remaining: number;
      buy_price_per_unit: number;
      received_at: number;
    }>(
      `SELECT id, batch_number, quantity_remaining, buy_price_per_unit, received_at
       FROM inventory_batches
       WHERE item_id = ? AND business_id = ? AND quantity_remaining > 0 AND status = 'active'
       ORDER BY received_at ASC`,
      [itemId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: batches.map((b) => ({
        id: b.id,
        batchNumber: b.batch_number || b.id.slice(0, 8),
        quantityRemaining: b.quantity_remaining,
        buyPricePerUnit: b.buy_price_per_unit,
        receivedAt: b.received_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching item batches:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch batches',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
