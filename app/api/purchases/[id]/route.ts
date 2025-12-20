import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { Purchase, PurchaseItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

const DEMO_BUSINESS_ID = '8527dbc7-3229-489b-82a7-f8d11532acaa';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: purchaseId } = await params;

    const purchase = await queryOne<Purchase>(
      `SELECT * FROM purchases WHERE id = ? AND business_id = ?`,
      [purchaseId, DEMO_BUSINESS_ID]
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

