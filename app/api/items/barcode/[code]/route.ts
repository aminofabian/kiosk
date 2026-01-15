import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import type { Item } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { code } = await params;

    if (!code || code.trim().length === 0) {
      return jsonResponse(
        { success: false, message: 'Barcode is required' },
        400
      );
    }

    const barcode = code.trim();

    // Look up item by barcode
    const item = await queryOne<Item>(
      `SELECT * FROM items 
       WHERE business_id = ? AND barcode = ? AND active = 1`,
      [auth.businessId, barcode]
    );

    if (!item) {
      return jsonResponse(
        { 
          success: false, 
          message: 'Product not found',
          barcode: barcode 
        },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to lookup barcode',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
