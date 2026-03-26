import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const now = Math.floor(Date.now() / 1000);

    // Batches that have already expired
    const expired = await query<{
      id: string;
      batch_number: string | null;
      item_id: string;
      item_name: string;
      unit_type: string;
      supplier_name: string | null;
      quantity_remaining: number;
      expiry_date: number;
      received_at: number;
    }>(
      `SELECT ib.id, ib.batch_number, ib.item_id, i.name as item_name,
              i.unit_type, s.name as supplier_name, ib.quantity_remaining,
              ib.expiry_date, ib.received_at
       FROM inventory_batches ib
       JOIN items i ON ib.item_id = i.id
       LEFT JOIN suppliers s ON ib.supplier_id = s.id
       WHERE ib.business_id = ?
         AND ib.status = 'active'
         AND ib.expiry_date IS NOT NULL
         AND ib.quantity_remaining > 0
         AND ib.expiry_date < ?
       ORDER BY ib.expiry_date ASC`,
      [auth.businessId, now]
    );

    // Batches expiring soon: within the last 1/4 of their shelf life but not yet expired
    const expiringSoon = await query<{
      id: string;
      batch_number: string | null;
      item_id: string;
      item_name: string;
      unit_type: string;
      supplier_name: string | null;
      quantity_remaining: number;
      expiry_date: number;
      received_at: number;
    }>(
      `SELECT ib.id, ib.batch_number, ib.item_id, i.name as item_name,
              i.unit_type, s.name as supplier_name, ib.quantity_remaining,
              ib.expiry_date, ib.received_at
       FROM inventory_batches ib
       JOIN items i ON ib.item_id = i.id
       LEFT JOIN suppliers s ON ib.supplier_id = s.id
       WHERE ib.business_id = ?
         AND ib.status = 'active'
         AND ib.expiry_date IS NOT NULL
         AND ib.quantity_remaining > 0
         AND ib.expiry_date >= ?
         AND ? >= (ib.expiry_date - ((ib.expiry_date - ib.received_at) / 4))
       ORDER BY ib.expiry_date ASC`,
      [auth.businessId, now, now]
    );

    return jsonResponse({
      success: true,
      data: {
        expired,
        expiringSoon,
        totalCount: expired.length + expiringSoon.length,
      },
    });
  } catch (error) {
    console.error('Error fetching expiring batches:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch expiring batches',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
