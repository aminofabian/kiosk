import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { Sale, SaleItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: saleId } = await params;

    const sale = await queryOne<
      Sale & { business_name: string }
    >(
      `SELECT 
        s.*,
        b.name as business_name
       FROM sales s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = ? AND s.business_id = ?`,
      [saleId, auth.businessId]
    );

    if (!sale) {
      return jsonResponse(
        { success: false, message: 'Sale not found' },
        404
      );
    }

    const saleItems = await query<
      SaleItem & { item_name: string; item_unit_type: string }
    >(
      `SELECT 
        si.*,
        i.name as item_name,
        i.unit_type as item_unit_type
       FROM sale_items si
       JOIN items i ON si.item_id = i.id
       WHERE si.sale_id = ?
       ORDER BY si.created_at ASC`,
      [saleId]
    );

    return jsonResponse({
      success: true,
      data: {
        sale,
        items: saleItems,
      },
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch sale',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

