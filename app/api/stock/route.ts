import { query } from '@/lib/db';
import type { Item } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const items = await query<
      Item & { category_name: string }
    >(
      `SELECT 
        i.*,
        c.name as category_name
       FROM items i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.business_id = ? AND i.active = 1
       ORDER BY i.name ASC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch stock',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

